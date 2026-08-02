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
// 3. Every pair of overlays that can appear together is separated by LUMINANCE
//    as well as hue, at least 1.8:1. Hue alone is not enough: the obvious
//    colourblind-safe pairings are often near-isoluminant, so with colour
//    removed the layers collapse into each other. The first version of this
//    file failed at 1.03:1. `node scripts/check-palettes.mjs` enforces it.

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
    friendly: "#68a5db",
    hostile: "#a3311f",
    neutral: "#668c54",
    // Triangle Strategy's idea: colour the decision, not the data.
    move: { fill: "#1b756d", pattern: "solid" }, // reachable and safe
    moveThreatened: { fill: "#b68cdb", pattern: "hatch" }, // reachable but exposed
    attack: { fill: "#f4c473", pattern: "cross" }, // what you could hit
    threat: { fill: "#751b48", pattern: "hatch" }, // what they could hit
    support: { fill: "#d1efd6", pattern: "dots" }, // staff / heal range
    path: "#ffffff",
  },

  deuteranopia: {
    label: "Colourblind — red/green",
    note: "Blue and orange are the safest pair for deuteranopia and protanopia. No red/green anywhere.",
    friendly: "#5ba7dc",
    hostile: "#864a07",
    neutral: "#828282",
    move: { fill: "#196f9d", pattern: "solid" },
    moveThreatened: { fill: "#bb8cd3", pattern: "hatch" },
    attack: { fill: "#e8cb0a", pattern: "cross" },
    threat: { fill: "#663008", pattern: "hatch" },
    support: { fill: "#e8e8e8", pattern: "dots" },
    path: "#ffffff",
  },

  tritanopia: {
    label: "Colourblind — blue/yellow",
    note: "Tritanopia confuses blue with green and yellow with violet, so this leans on red and teal instead.",
    friendly: "#e0859c",
    hostile: "#15635e",
    neutral: "#828282",
    move: { fill: "#bc3658", pattern: "solid" },
    moveThreatened: { fill: "#c98e98", pattern: "hatch" },
    attack: { fill: "#f6c0aa", pattern: "cross" },
    threat: { fill: "#0d4744", pattern: "hatch" },
    support: { fill: "#e8e8e8", pattern: "dots" },
    path: "#ffffff",
  },

  contrast: {
    label: "High contrast",
    note: "Maximum separation and heavy patterning. Useful on a bad screen or in sunlight.",
    friendly: "#a0a0a0",
    hostile: "#b60000",
    neutral: "#9d7d00",
    move: { fill: "#007289", pattern: "solid" },
    moveThreatened: { fill: "#d974fb", pattern: "cross" },
    attack: { fill: "#eaca00", pattern: "cross" },
    threat: { fill: "#860000", pattern: "grid" },
    support: { fill: "#86ffb8", pattern: "dots" },
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
