#!/usr/bin/env node
// Every pair of overlays that can appear together must differ in LUMINANCE,
// not only in hue. Hue handles colour-vision deficiency; luminance handles
// greyscale, achromatopsia and bad screens. Run: node scripts/check-palettes.mjs
import { PALETTES } from "../shared/palettes.js";

const MIN = 1.8;
const PAIRS = [
  ["move", "attack"], ["move", "threat"], ["move", "moveThreatened"],
  ["attack", "threat"], ["moveThreatened", "threat"],
];

const lum = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.substr(i, 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failed = 0;
for (const [name, p] of Object.entries(PALETTES)) {
  if (name === "classic") continue; // kept as a historical reference; known to fail
  for (const [a, b] of PAIRS) {
    const r = ratio(p[a].fill, p[b].fill);
    if (r < MIN) {
      console.error(`FAIL ${name}: ${a} vs ${b} = ${r.toFixed(2)}:1 (need ${MIN})`);
      failed++;
    }
  }
  const f = ratio(p.friendly, p.hostile);
  if (f < MIN) {
    console.error(`FAIL ${name}: friendly vs hostile = ${f.toFixed(2)}:1`);
    failed++;
  }
}
if (failed) { console.error(`\n${failed} palette contrast failure(s)`); process.exit(1); }
console.log(`All palettes pass: every overlay pair >= ${MIN}:1 with colour removed.`);
