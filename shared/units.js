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
  },
};

// Terrain: cost is movement points to enter, def is a defence bonus while
// standing there. `null` cost means impassable.
export const TERRAIN = {
  plain: { label: "Plain", cost: 1, def: 0 },
  road: { label: "Road", cost: 1, def: 0 },
  forest: { label: "Forest", cost: 2, def: 1 },
  hill: { label: "Hill", cost: 2, def: 1 },
  mountain: { label: "Mountain", cost: 3, def: 2 },
  water: { label: "Water", cost: null, def: 0 },
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
