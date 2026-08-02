// A fixed, known game to develop against. Not part of the real game: it exists
// so the client can render something before a server exists, the server can
// broadcast something before a UI exists, and the rules can be tested without
// either.
//
// The map is authored as ASCII so it stays readable in a diff. A real game will
// eventually load maps from files; this is the one everybody points at today.

import { makeUnit } from "./units.js";

const LEGEND = {
  ".": "plain",
  "=": "road",
  f: "forest",
  h: "hill",
  "^": "mountain",
  "~": "water",
};

// 20 x 12. A river splits the field with exactly two bridges, so the whole
// battle is a fight over two chokepoints. Cavalry is fast in the open but
// cannot cross the mountains, and the bridges are where its speed stops
// mattering.
export const DEMO_MAP = [
  "....f....~~.....f...",
  "..ff.h...~~...h.ff..",
  "....f....~~.....f...",
  ".........==.........",
  "..^......~~......^..",
  "...h.....~~.....h...",
  "...h.....~~.....h...",
  "..^......~~......^..",
  ".........==.........",
  "....f....~~.....f...",
  "..ff.h...~~...h.ff..",
  "....f....~~.....f...",
];

export const parseMap = (rows) => ({
  w: rows[0].length,
  h: rows.length,
  terrain: rows.map((row) =>
    [...row].map((c) => {
      const t = LEGEND[c];
      if (!t) throw new Error(`unknown map character: ${c}`);
      return t;
    }),
  ),
});

export const makeDemoGame = () => ({
  id: "demo",
  turn: 1,
  activePlayer: 0,
  grid: parseMap(DEMO_MAP),
  units: [
    // player 0, west bank
    makeUnit("a1", "infantry", 0, 3, 4),
    makeUnit("a2", "infantry", 0, 3, 7),
    makeUnit("a3", "cavalry", 0, 1, 5),
    makeUnit("a4", "archer", 0, 1, 6),
    // player 1, east bank
    makeUnit("b1", "infantry", 1, 16, 4),
    makeUnit("b2", "infantry", 1, 16, 7),
    makeUnit("b3", "cavalry", 1, 18, 5),
    makeUnit("b4", "archer", 1, 18, 6),
  ],
  winner: null,
});

// A frozen copy for imports that want the object rather than a factory.
// Use makeDemoGame() when you need a fresh one, since state gets mutated by
// whatever you are testing.
export const DEMO_GAME = makeDemoGame();
