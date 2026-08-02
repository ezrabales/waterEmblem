// Combat math. Pure functions only: no DOM, no network, no randomness at call
// time except where a roll function is passed in explicitly.
//
// IMPORTANT: this module is imported by BOTH the client (to draw the forecast
// panel before you commit) and the server (to resolve the attack). If the two
// sides ever compute different numbers, the UI lies. One file, both consumers.

import { statsOf } from "./units.js";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Everything the UI needs to describe an exchange, without performing it.
export const forecast = (attacker, defender, opts = {}) => {
  const a = statsOf(attacker, opts.attackerTile);
  const d = statsOf(defender, opts.defenderTile);
  const dist = distance(attacker, defender);

  const inRange = dist <= a.range;
  const damage = Math.max(1, a.atk - d.def);
  const hit = clamp(a.hit - d.avo, 0, 100);
  const doubles = a.spd - d.spd >= 4;

  const canCounter = dist <= d.range;
  const counterDamage = canCounter ? Math.max(1, d.atk - a.def) : null;
  const counterHit = canCounter ? clamp(d.hit - a.avo, 0, 100) : null;
  const counterDoubles = canCounter && d.spd - a.spd >= 4;

  return {
    inRange,
    distance: dist,
    damage,
    hit,
    crit: a.crit,
    doubles,
    canCounter,
    counterDamage,
    counterHit,
    counterCrit: canCounter ? d.crit : null,
    counterDoubles,
    // worst case for each side, used to draw the predicted health loss
    defenderMaxLoss: damage * (doubles ? 2 : 1),
    attackerMaxLoss: canCounter ? counterDamage * (counterDoubles ? 2 : 1) : 0,
  };
};

// Fire Emblem's "2RN" roll: two rolls averaged, then compared to the displayed
// number. A shown 80% lands about 91% of the time, a shown 20% about 9%. People
// are poor at intuiting probability, and this makes the displayed odds behave
// the way players already assume they do.
export const trueHit = (chance, rng = Math.random) => {
  const roll = (Math.floor(rng() * 100) + Math.floor(rng() * 100)) / 2;
  return roll < chance;
};

// Resolve a full exchange. Returns the damage taken by each side plus an event
// list the client can play as an animation queue. Never mutates its inputs.
//
// `rng` is injected so the server can seed it and tests can make it
// deterministic. The server is the only place this should ever be called with
// a real random source.
export const resolveCombat = (attacker, defender, opts = {}) => {
  const rng = opts.rng ?? Math.random;
  const f = forecast(attacker, defender, opts);
  const events = [];

  if (!f.inRange) {
    return { events: [], attackerHp: attacker.hp, defenderHp: defender.hp };
  }

  let attackerHp = attacker.hp;
  let defenderHp = defender.hp;

  const strike = (from, to, dmg, chance, critChance, isCounter) => {
    if (from === "attacker" ? attackerHp <= 0 : defenderHp <= 0) return;
    if (from === "attacker" ? defenderHp <= 0 : attackerHp <= 0) return;

    const landed = trueHit(chance, rng);
    const crit = landed && trueHit(critChance, rng);
    const total = landed ? dmg * (crit ? 3 : 1) : 0;

    if (from === "attacker") defenderHp = Math.max(0, defenderHp - total);
    else attackerHp = Math.max(0, attackerHp - total);

    events.push({
      e: isCounter ? "counter" : "attack",
      from: from === "attacker" ? attacker.id : defender.id,
      to: from === "attacker" ? defender.id : attacker.id,
      hit: landed,
      crit,
      damage: total,
    });

    if (from === "attacker" && defenderHp === 0)
      events.push({ e: "death", unit: defender.id });
    if (from === "defender" && attackerHp === 0)
      events.push({ e: "death", unit: attacker.id });
  };

  // 1. attacker strikes
  strike("attacker", "defender", f.damage, f.hit, f.crit, false);
  // 2. defender counters if alive and in range
  if (f.canCounter)
    strike("defender", "attacker", f.counterDamage, f.counterHit, f.counterCrit, true);
  // 3. whoever is 4+ faster strikes again
  if (f.doubles) strike("attacker", "defender", f.damage, f.hit, f.crit, false);
  else if (f.counterDoubles)
    strike("defender", "attacker", f.counterDamage, f.counterHit, f.counterCrit, true);

  return { events, attackerHp, defenderHp };
};
