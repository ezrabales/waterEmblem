// The reducer. This is what the server calls when a message arrives, and it is
// the only place game state changes.
//
//     applyAction(state, action, playerIndex) -> { state, events } | { error }
//
// Pure: no DOM, no network, no wall clock, and no unseeded randomness. Given
// the same state and action it always produces the same result, which is what
// makes replay, undo and deterministic tests possible at all.
//
// THE LOG IS THE GAME. Every committed action is appended to state.log, so the
// whole match is `replay(setup, log)`. That single fact buys:
//   - undo, by truncating the log and replaying
//   - spectating and reconnect, by shipping the log
//   - reproducible bug reports, by pasting the log
//   - deterministic rewind, because the RNG is seeded from the log position
//     rather than from a running generator

import { UNIT_TYPES, makeUnit } from "./units.js";
import { forecast, resolveCombat, distance } from "./combat.js";
import { validateMove, reachable, canStopAt, key } from "./movement.js";

// ---------------------------------------------------------------------------
// deterministic randomness
// ---------------------------------------------------------------------------

// mulberry32. Small, fast, good enough for hit rolls, and identical in every
// JS engine, which matters because the client and server must agree.
const prng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * The RNG for one action is a function of WHERE IT SITS IN THE LOG, not of a
 * running stream. So rewinding and repeating the same action gives the same
 * result, while taking a different action gives a different one.
 *
 * Tactics Ogre does exactly this, and it is why it can afford a generous
 * rewind without players farming criticals. Rewind is a decision undo, never
 * a dice undo.
 */
const rngFor = (state, action) =>
  prng(hash(`${state.seed}|${state.log.length}|${action.kind}|${action.unitId ?? ""}`));

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

export const newGame = ({ id, seed, grid, units }) => ({
  id,
  seed: seed ?? id,
  turn: 1,
  activePlayer: 0,
  grid,
  units: units.map((u) => ({ ...u })),
  log: [],
  winner: null,
  // Set once a die is rolled or information is revealed this turn. Until then
  // the moves since the last lock are still provisional and can be taken back.
  lockedAt: 0,
});

const clone = (s) => ({ ...s, units: s.units.map((u) => ({ ...u })), log: [...s.log] });

const unitById = (s, id) => s.units.find((u) => u.id === id && u.hp > 0);
const occupant = (s, x, y) => s.units.find((u) => u.x === x && u.y === y && u.hp > 0);
const tileAt = (s, x, y) => s.grid.terrain[y][x];

// ---------------------------------------------------------------------------
// the reducer
// ---------------------------------------------------------------------------

const ACTIONS = {
  /** { kind:"move", unitId, x, y } — reversible: no dice, no reveal. */
  move(s, a, who) {
    const u = unitById(s, a.unitId);
    if (!u) return { error: "no such unit" };
    if (u.owner !== who) return { error: "not your unit" };
    if (u.hasMoved) return { error: "already moved" };

    const path = validateMove(u, s.grid, s.units, a.x, a.y);
    if (!path) return { error: "illegal move" };

    const from = { x: u.x, y: u.y };
    u.x = a.x;
    u.y = a.y;
    u.hasMoved = true;
    return { events: [{ e: "move", unit: u.id, from, to: { x: a.x, y: a.y }, path }] };
  },

  /** { kind:"attack", unitId, targetId } — LOCKING: rolls dice. */
  attack(s, a, who) {
    const u = unitById(s, a.unitId);
    const t = unitById(s, a.targetId);
    if (!u) return { error: "no such unit" };
    if (!t) return { error: "no such target" };
    if (u.owner !== who) return { error: "not your unit" };
    if (t.owner === who) return { error: "that is your own unit" };
    if (u.hasActed) return { error: "already acted" };

    const opts = {
      attackerTile: tileAt(s, u.x, u.y),
      defenderTile: tileAt(s, t.x, t.y),
    };
    if (!forecast(u, t, opts).inRange) return { error: "out of range" };

    const r = resolveCombat(u, t, { ...opts, rng: rngFor(s, a) });
    u.hp = r.attackerHp;
    t.hp = r.defenderHp;
    u.hasActed = true;
    u.hasMoved = true;
    return { events: r.events, locking: true };
  },

  /** { kind:"wait", unitId } — ends this unit's turn. A commit, not a no-op. */
  wait(s, a, who) {
    const u = unitById(s, a.unitId);
    if (!u) return { error: "no such unit" };
    if (u.owner !== who) return { error: "not your unit" };
    if (u.hasActed) return { error: "already acted" };
    u.hasActed = true;
    u.hasMoved = true;
    return { events: [{ e: "wait", unit: u.id }] };
  },

  /** { kind:"endTurn" } — LOCKING: the turn boundary is not crossable backwards. */
  endTurn(s, a, who) {
    if (s.activePlayer !== who) return { error: "not your turn" };
    s.activePlayer = s.activePlayer === 0 ? 1 : 0;
    if (s.activePlayer === 0) s.turn += 1;
    for (const u of s.units) {
      if (u.owner === s.activePlayer) {
        u.hasMoved = false;
        u.hasActed = false;
      }
    }
    return {
      events: [{ e: "turn", turn: s.turn, player: s.activePlayer }],
      locking: true,
    };
  },
};

/**
 * Undo. Truncates the log back past every reversible action since the last
 * lock, then replays from the setup.
 *
 * The rule, which the genre converged on independently in half a dozen games:
 * a move is undoable until it changes what the player KNOWS or what the world
 * CONTAINS. Rolling dice, revealing information and gaining a resource are the
 * three lock triggers. Until one fires, a move is UI state, not game state.
 */
const undo = (state, who, setup) => {
  if (state.activePlayer !== who) return { error: "not your turn" };
  const cut = state.log.length - 1;
  if (cut < state.lockedAt) return { error: "nothing to undo" };
  const last = state.log[cut];
  if (last.by !== who) return { error: "not your action" };

  const rebuilt = replay(setup, state.log.slice(0, cut));
  return { state: rebuilt, events: [{ e: "undo", undid: last.kind, unit: last.unitId }] };
};

const checkWinner = (s) => {
  const alive = [0, 1].map((p) => s.units.some((u) => u.owner === p && u.hp > 0));
  if (!alive[0] && !alive[1]) return "draw";
  if (!alive[0]) return 1;
  if (!alive[1]) return 0;
  return null;
};

/**
 * Apply one action. Never mutates the state passed in.
 * `setup` is only needed for undo, which has to replay from the beginning.
 */
export const applyAction = (state, action, playerIndex, setup = null) => {
  if (state.winner !== null) return { error: "game over" };

  if (action.kind === "undo") {
    if (!setup) return { error: "undo needs the original setup" };
    return undo(state, playerIndex, setup);
  }

  const fn = ACTIONS[action.kind];
  if (!fn) return { error: `unknown action: ${action.kind}` };

  const next = clone(state);
  const out = fn(next, action, playerIndex);
  if (out.error) return { error: out.error };

  next.log.push({ ...action, by: playerIndex });
  if (out.locking) next.lockedAt = next.log.length;
  next.winner = checkWinner(next);
  if (next.winner !== null) out.events.push({ e: "win", player: next.winner });

  return { state: next, events: out.events };
};

/** Rebuild a game from its setup and its log. The log IS the game. */
export const replay = (setup, log) => {
  let s = newGame(setup);
  for (const entry of log) {
    const { by, ...action } = entry;
    const r = applyAction(s, action, by, setup);
    if (r.error) throw new Error(`replay diverged at ${s.log.length}: ${r.error}`);
    s = r.state;
  }
  return s;
};

/** Everything the active player is currently allowed to do. Handy for tests and AI. */
export const legalActions = (state, who) => {
  if (state.winner !== null || state.activePlayer !== who) return [];
  const out = [{ kind: "endTurn" }];
  for (const u of state.units) {
    if (u.owner !== who || u.hp <= 0 || u.hasActed) continue;
    if (!u.hasMoved) {
      for (const [k] of canStopAt(u, state.grid, state.units))
        if (k !== key(u.x, u.y)) {
          const [x, y] = k.split(",").map(Number);
          out.push({ kind: "move", unitId: u.id, x, y });
        }
    }
    for (const t of state.units)
      if (t.owner !== who && t.hp > 0 && distance(u, t) <= UNIT_TYPES[u.type].range)
        out.push({ kind: "attack", unitId: u.id, targetId: t.id });
    out.push({ kind: "wait", unitId: u.id });
  }
  return out;
};
