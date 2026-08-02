// Unit templates. These live in code, never in game state.
// Game state stores only { id, type, owner, x, y, hp, hasMoved, hasActed }.
// Balance changes happen here and apply to every unit of that type at once.

export const UNIT_TYPES = {
  infantry: {
    label: "Infantry",
    maxHp: 20,
    atk: 7,
    def: 5,
    spd: 4,
    hit: 90,
    avo: 10,
    crit: 2,
    move: 4,
    range: 1,
    moveType: "foot",
  },
  cavalry: {
    label: "Cavalry",
    maxHp: 22,
    atk: 9,
    def: 2,
    spd: 8,
    hit: 85,
    avo: 15,
    crit: 4,
    move: 7,
    range: 1,
    moveType: "horse",
  },
  archer: {
    label: "Archer",
    maxHp: 16,
    atk: 7,
    def: 2,
    spd: 6,
    hit: 85,
    avo: 10,
    crit: 3,
    move: 4,
    range: 2,
    moveType: "foot",
  },
};

// Terrain. `def` is a defence bonus while standing there. `cost` is movement
// points to enter, PER MOVEMENT TYPE. null means impassable for that type.
//
// This is the lever that balances fast units: cavalry owns open ground and
// pays for rough terrain, infantry goes where horses cannot. The map does the
// balancing rather than the stat block.
export const TERRAIN = {
  plain: { label: "Plain", def: 0, cost: { foot: 1, horse: 1 } },
  road: { label: "Road", def: 0, cost: { foot: 1, horse: 1 } },
  forest: { label: "Forest", def: 1, cost: { foot: 2, horse: 3 } },
  hill: { label: "Hill", def: 1, cost: { foot: 2, horse: 3 } },
  mountain: { label: "Mountain", def: 2, cost: { foot: 3, horse: null } },
  water: { label: "Water", def: 0, cost: { foot: null, horse: null } },
};

// Build a fresh unit instance from a template.
export const makeUnit = (id, type, owner, x, y) => {
  const t = UNIT_TYPES[type];
  if (!t) throw new Error(`unknown unit type: ${type}`);
  return {
    id,
    type,
    owner,
    x,
    y,
    hp: t.maxHp,
    hasMoved: false,
    hasActed: false,
  };
};

// Read a unit's stats: template values, plus terrain defence if a tile is given.
export const statsOf = (unit, tile) => {
  const t = UNIT_TYPES[unit.type];
  const terrainDef = tile ? (TERRAIN[tile]?.def ?? 0) : 0;
  return { ...t, def: t.def + terrainDef, maxHp: t.maxHp };
};
