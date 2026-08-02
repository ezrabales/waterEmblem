// Movement rules. Pure functions, no DOM and no network.
//
// Imported by BOTH sides: the client uses reachable() to draw the blue overlay
// and pathTo() to draw the route line, and the server uses the same reachable()
// to verify a submitted move was actually legal. Never trust a client's claim
// that it could reach a tile.
//
// Movement is a BUDGET, not a pattern. A unit may take any route it can afford.
// Terrain costs points to enter and those costs differ per movement type, which
// is what stops cavalry from being strictly better than infantry.

import { UNIT_TYPES, TERRAIN } from "./units.js";

export const key = (x, y) => `${x},${y}`;

// Four-directional. No diagonals: with equal costs a diagonal step would be
// strictly cheaper than two orthogonal ones, everyone would zigzag, and
// chokepoints would stop working.
const NEIGHBOURS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const inBounds = (grid, x, y) =>
  x >= 0 && y >= 0 && x < grid.w && y < grid.h;

export const terrainAt = (grid, x, y) =>
  inBounds(grid, x, y) ? grid.terrain[y][x] : null;

// Points to enter this tile for this movement type. null = impassable.
export const costToEnter = (grid, x, y, moveType) => {
  const t = TERRAIN[terrainAt(grid, x, y)];
  if (!t) return null;
  const c = t.cost[moveType];
  return c ?? null;
};

const occupantMap = (units) => {
  const m = new Map();
  for (const u of units) if (u.hp > 0) m.set(key(u.x, u.y), u);
  return m;
};

/**
 * Every tile `unit` can reach this turn.
 *
 * Dijkstra rather than plain BFS, because terrain costs differ. Plain BFS finds
 * the route with the fewest STEPS, which is not the cheapest route once a
 * forest costs 2 and a road costs 1 — that is the classic bug here.
 *
 * Returns Map<"x,y", { x, y, cost, prev }>. `prev` reconstructs the path.
 * Occupied tiles appear in the map (you may pass through allies) but are
 * excluded from canStopAt.
 */
export const reachable = (unit, grid, units) => {
  const t = UNIT_TYPES[unit.type];
  const occupied = occupantMap(units);
  const start = key(unit.x, unit.y);

  const best = new Map([[start, { x: unit.x, y: unit.y, cost: 0, prev: null }]]);
  // Ranges are small (4 to 8) so a simple frontier scan beats a real heap.
  const frontier = [best.get(start)];

  while (frontier.length) {
    let i = 0;
    for (let j = 1; j < frontier.length; j++)
      if (frontier[j].cost < frontier[i].cost) i = j;
    const cur = frontier.splice(i, 1)[0];

    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(grid, nx, ny)) continue;

      const step = costToEnter(grid, nx, ny, t.moveType);
      if (step === null) continue; // impassable terrain

      const blocker = occupied.get(key(nx, ny));
      if (blocker && blocker.owner !== unit.owner) continue; // enemies block

      const cost = cur.cost + step;
      if (cost > t.move) continue;

      const k = key(nx, ny);
      const seen = best.get(k);
      if (seen && seen.cost <= cost) continue;

      const node = { x: nx, y: ny, cost, prev: cur };
      best.set(k, node);
      frontier.push(node);
    }
  }
  return best;
};

/** Tiles the unit may actually END its move on: reachable and unoccupied. */
export const canStopAt = (unit, grid, units, reach = null) => {
  const r = reach ?? reachable(unit, grid, units);
  const occupied = occupantMap(units);
  const out = new Map();
  for (const [k, node] of r) {
    const other = occupied.get(k);
    if (other && other.id !== unit.id) continue; // cannot share a tile
    out.set(k, node);
  }
  return out;
};

/** Walk `prev` back from a destination. Returns [{x,y}, ...] start to end. */
export const pathTo = (reach, x, y) => {
  let node = reach.get(key(x, y));
  if (!node) return null;
  const path = [];
  while (node) {
    path.unshift({ x: node.x, y: node.y });
    node = node.prev;
  }
  return path;
};

/**
 * Every tile this unit could attack, from anywhere it could stand.
 * Union over all stoppable tiles of the ring at Manhattan distance <= range.
 * This is the red overlay, and it is deliberately a different set from the
 * blue one: where you can go, versus what you could hit once there.
 */
export const attackable = (unit, grid, units, stops = null) => {
  const t = UNIT_TYPES[unit.type];
  const from = stops ?? canStopAt(unit, grid, units);
  const out = new Set();
  for (const node of from.values()) {
    for (let dy = -t.range; dy <= t.range; dy++) {
      const span = t.range - Math.abs(dy);
      for (let dx = -span; dx <= span; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = node.x + dx;
        const y = node.y + dy;
        if (inBounds(grid, x, y)) out.add(key(x, y));
      }
    }
  }
  return out;
};

/**
 * The danger zone: every tile any of `owner`'s enemies could reach and attack.
 * Toggle this on and a player can see the whole threat picture at once, which
 * is the single biggest readability win the genre has.
 */
export const threatRange = (owner, grid, units) => {
  const out = new Set();
  for (const u of units) {
    if (u.owner === owner || u.hp <= 0) continue;
    for (const k of attackable(u, grid, units)) out.add(k);
  }
  return out;
};

/** Server-side check: was this move legal? Returns the path, or null. */
export const validateMove = (unit, grid, units, x, y) => {
  if (unit.hasMoved) return null;
  const reach = reachable(unit, grid, units);
  const stops = canStopAt(unit, grid, units, reach);
  if (!stops.has(key(x, y))) return null;
  return pathTo(reach, x, y);
};
