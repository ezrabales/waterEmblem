# Overlays, colour, and threat display

## The convention, from Nintendo

*Fire Emblem* (GBA, FE7) instruction booklet, p.15:

> "Movement range is displayed in **blue**, and attack range is in **red**. The
> areas you can affect with staves are in **green**. You can view movement and
> attack ranges for any unit on-screen, whether it's your own, the enemy's, or
> neutral."

Three things worth extracting:

- Green for staff range is **original**, not a later addition.
- Per-unit range inspection was a day-one feature. The all-enemies toggle came
  later, as a convenience layer on top.
- **Red is not "tiles I can attack from".** It is the weapon-range dilation of
  the movement set, *minus* the movement set. Two different questions, two
  different sets.

Rendering is described everywhere as a **filter**: a translucent fill over the
tile, never an outline. In the GBA source it is an enum
(`LIMITVIEW_BLUE/RED/GREEN`) drawn on BG2 with hardware alpha and a 32-frame
palette cycle, which is where the shimmer comes from.

## Why we did not copy it

Advance Wars uses **green** for movement, not blue. *Days of Ruin* manual:

> "Tap a unit to display the unit's movement range, which will appear **in
> green**. Enemy units that can be attacked are displayed on a red background."

The reason is structural: Advance Wars colour-codes its *armies* (Orange Star,
Blue Moon, Green Earth, Yellow Comet, Black Hole), so it cannot spend blue and
red on overlays as well.

**Our factions are blue and red.** So the same constraint applies, and the rule
generalises:

> Pick the faction palette first. Give the overlays what is left.

## What we did instead: colour the decision

Triangle Strategy partitions the movement range by threat rather than drawing a
separate danger layer. From Nintendo's own tips page:

> "**Blue spaces** indicate that your unit will be **safe** on that square."
> "**Purple spaces** … warn that the space is **in range of an enemy attack**."
> "**Red lines** let you know **which enemy units could attack you**."

Three properties the alternatives lack:

- Always on, without extra screen space, because it recolours a layer you were
  already reading.
- Binary, so overlapping enemy ranges can never stack into an unreadable wash.
- It never shows you a threatened tile you cannot actually reach.

Attribution is deferred to hover, where arcs connect the tile to exactly the
enemies that reach it. Wesnoth converged on the same idea from the other
direction: 1.14.7 made "Show Enemy Moves" highlight the enemy units that can
reach the highlighted hex.

## The threat mode almost nobody has

Battle for Wesnoth ships two commands:

| Command | Key | Manual wording |
|---|---|---|
| `showenemymoves` | Ctrl+V | where the enemy can move next turn |
| `bestenemymoves` | **Ctrl+B** | **"Show potential enemy moves, if your units were not on the map."** |

Ctrl+B recomputes the danger zone **with your own units erased**. That answers
the most common complaint about danger overlays, which a Three Houses player
put exactly:

> "When I move a unit out of an enemy's way **their danger zone grows larger**
> and can suddenly attack a previously safe unit… Is there a way to make the
> game assume all my units are already out of the way?"

There isn't, in any Fire Emblem. The standard overlay tells you where you are
safe; this one tells you where you are safe **after you move**, which is the
decision you are actually making.

It cost one line, because `threatRange` already takes the unit list:

```js
threatRange(0, grid, units.filter(u => u.owner !== 0))
```

## Over-report, deliberately

Two engines disagree about whether a tile occupied by an enemy's *own ally*
counts as somewhere that enemy could attack from:

- **Fire Emblem 8** excludes every occupied tile. Under-reports in dense clusters.
- **lt-maker** applies no occupancy filter. Over-reports.

We over-report. **Under-reporting a threat is the failure that loses players.**
Over-reporting merely makes them cautious.

Both engines agree on the half that matters: *your* units hard-block the enemy
flood fill.

## Colourblindness

This is the genre's long-running failure. Fire Emblem players have asked for a
colourblind mode since the GameBoy Advance era; **no entry has ever shipped
one**. Tactics Ogre Reborn drew the same complaint:

> "No color blind options — I am red/green colorblind, and all forms of unit
> health blend together."

Roughly 8% of men have a colour vision deficiency, and our overlays carry four
distinct meanings. So every overlay in `shared/palettes.js` carries a **pattern
as well as a hue**, and there are two colourblind-safe palettes: blue/orange for
deuteranopia and protanopia, red/teal for tritanopia.

Wesnoth's answer is user-configurable highlight colours. Ours is the same idea:
palette is a viewer preference, stored per browser, never sent over the wire.

## Two facts on one glyph

XCOM's cover shield is the best compact encoding found anywhere:

- **Shape** carries how much protection you have (half shield, full shield, none).
- **Colour** carries whether that protection is currently defeated (yellow =
  flanked now, red = *will be* flanked if you move here).

Two orthogonal facts, one icon, and the shields are directional so you read the
geometry rather than a summary number. Worth stealing if we ever add cover.

## Unit state

Fire Emblem GBA manual, p.13:

> "All units are either **blue** (yours), **red** (enemies), or **green**
> (other). **Gray units are those that have already moved for that turn.**"

Fire Emblem also **stops the idle animation** on a greyed unit. Two channels,
not one. Advance Wars says the same: "the unit changes to a darker colour.
Darkened units cannot receive further orders until the next turn."

## Gaps

- Whether Fire Emblem's overlay animates on appear (grows outward, pulses).
  No written source exists; it would take frame-stepping an emulator capture.
- Whether the Fire Emblem info panel repositions to avoid the cursor.
- Per-title overlay colours for Path of Radiance, Radiant Dawn, Fates, Echoes.
- Fire Emblem's invalid-move sound cue. Extracted SFX sets exist; no
  description does.
