// Colour schemes. This is a CLIENT PREFERENCE, never game state: it is stored
// per browser and never sent over the wire, so two players can view the same
// match in different palettes.
//
// Slots are SEMANTIC, not per-player. Each client fills `friendly` with its own
// side and `hostile` with the other. In Fire Emblem you are always blue and the
// enemy always red; if we pinned blue to player 0, player 1 would spend the
// whole game with every instinct inverted.
//
// Two rules every palette here obeys:
//
// 1. Faction hues and overlay hues never overlap. Advance Wars uses green for
//    movement precisely because its armies own blue and red. Ours do too.
// 2. Colour is never the only channel. Every overlay also carries a pattern,
//    so the board stays readable for the ~8% of male players with a colour
//    vision deficiency. No Fire Emblem has ever shipped a colourblind mode
//    despite twenty years of requests; this is cheap and we should just do it.

export const PATTERNS = {
  solid: "none",
  hatch: "repeating-linear-gradient(-45deg, CLR 0 3px, transparent 3px 7px)",
  dots: "radial-gradient(CLR 1.2px, transparent 1.3px)",
  cross:
    "repeating-linear-gradient(45deg, CLR 0 2px, transparent 2px 6px)," +
    "repeating-linear-gradient(-45deg, CLR 0 2px, transparent 2px 6px)",
  grid: "repeating-linear-gradient(0deg, CLR 0 1px, transparent 1px 7px)," +
    "repeating-linear-gradient(90deg, CLR 0 1px, transparent 1px 7px)",
};

export const PALETTES = {
  standard: {
    label: "Standard",
    note: "Factions own blue and red, so overlays live elsewhere on the wheel.",
    friendly: "#4f9dd9",
    hostile: "#e0574a",
    neutral: "#7bc47f",
    // Triangle Strategy's idea: colour the decision, not the data.
    move: { fill: "#2fb3a8", pattern: "solid" }, // reachable and safe
    moveThreatened: { fill: "#9b6fd4", pattern: "hatch" }, // reachable but exposed
    attack: { fill: "#e8a33d", pattern: "cross" }, // what you could hit
    threat: { fill: "#d1477f", pattern: "hatch" }, // what they could hit
    support: { fill: "#7bc47f", pattern: "dots" }, // staff / heal range
    path: "#ffffff",
  },

  deuteranopia: {
    label: "Colourblind — red/green",
    note: "Blue and orange are the safest pair for deuteranopia and protanopia. No red/green anywhere.",
    friendly: "#3d8bd4",
    hostile: "#e08214",
    neutral: "#c7c7c7",
    move: { fill: "#56b4e9", pattern: "solid" },
    moveThreatened: { fill: "#9a72c4", pattern: "hatch" },
    attack: { fill: "#f0e442", pattern: "cross" },
    threat: { fill: "#d55e00", pattern: "hatch" },
    support: { fill: "#cccccc", pattern: "dots" },
    path: "#ffffff",
  },

  tritanopia: {
    label: "Colourblind — blue/yellow",
    note: "Tritanopia confuses blue with green and yellow with violet, so this leans on red and teal instead.",
    friendly: "#d94f6e",
    hostile: "#2aa198",
    neutral: "#b9b9b9",
    move: { fill: "#e07a9a", pattern: "solid" },
    moveThreatened: { fill: "#8a3050", pattern: "hatch" },
    attack: { fill: "#c94f2f", pattern: "cross" },
    threat: { fill: "#7d1128", pattern: "hatch" },
    support: { fill: "#bfbfbf", pattern: "dots" },
    path: "#ffffff",
  },

  contrast: {
    label: "High contrast",
    note: "Maximum separation and heavy patterning. Useful on a bad screen or in sunlight.",
    friendly: "#ffffff",
    hostile: "#ff2d2d",
    neutral: "#ffd400",
    move: { fill: "#00e5ff", pattern: "solid" },
    moveThreatened: { fill: "#b14cff", pattern: "cross" },
    attack: { fill: "#ffd400", pattern: "cross" },
    threat: { fill: "#ff2d2d", pattern: "grid" },
    support: { fill: "#00ff85", pattern: "dots" },
    path: "#ffffff",
  },

  classic: {
    label: "Fire Emblem classic",
    note: "Nintendo's 2003 convention: blue movement, red attack, green staves. Included for reference; it collides with our faction colours.",
    friendly: "#5b8dd9",
    hostile: "#d95b5b",
    neutral: "#6fbf73",
    move: { fill: "#5b8dd9", pattern: "solid" },
    moveThreatened: { fill: "#9b6fd4", pattern: "solid" },
    attack: { fill: "#d95b5b", pattern: "solid" },
    threat: { fill: "#b14cff", pattern: "solid" },
    support: { fill: "#6fbf73", pattern: "solid" },
    path: "#ffffff",
  },
};

export const DEFAULT_PALETTE = "standard";

/** Turn a pattern name plus colour into a CSS background-image value. */
export const patternCss = (name, colour, alpha = 0.55) => {
  const tpl = PATTERNS[name] ?? PATTERNS.solid;
  if (tpl === "none") return "none";
  return tpl.replaceAll("CLR", withAlpha(colour, alpha));
};

export const withAlpha = (hex, a) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const KEY = "waterEmblem.view";

/** Per-browser view settings. Never sent to the server. */
export const loadView = () => {
  const base = { palette: DEFAULT_PALETTE, patterns: true, side: 0 };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return base;
  }
};

export const saveView = (view) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    /* private browsing, ignore */
  }
};

/**
 * Resolve a palette for one viewer.
 * `side` is the player index this browser is playing, so `friendly` is always
 * the viewer's own units regardless of whether they are player 0 or 1.
 */
export const resolve = (view) => {
  const p = PALETTES[view.palette] ?? PALETTES[DEFAULT_PALETTE];
  return {
    ...p,
    ownerColour: (owner) =>
      owner == null ? p.neutral : owner === view.side ? p.friendly : p.hostile,
    patternFor: (slot) =>
      view.patterns ? patternCss(p[slot]?.pattern ?? "solid", p[slot]?.fill) : "none",
  };
};
