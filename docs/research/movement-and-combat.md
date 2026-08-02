# Movement and combat

## Dijkstra, not breadth-first search

The reachable set uses Dijkstra. The obvious choice is a BFS flood fill, and it
is wrong once terrain costs differ.

**BFS finds the route with the fewest steps.** With a forest at 2 and a road at
1, fewest steps is not cheapest. The failure mode is nasty because the overlay
looks *almost* right, which is worse than obviously wrong.

Ranges are small (4 to 8) over a few hundred tiles, so a plain frontier scan
beats a real heap. No priority queue needed.

## Four directions

Equal-cost diagonals are strictly cheaper than two orthogonal steps, so
everyone zigzags and chokepoints stop working. Four-way also makes attack range
plain Manhattan distance, which players can count by eye.

Into the Breach reached the same conclusion for a different reason. From
Subset's GDC postmortem, under the heading **"UI Guided Design"**, the
constraints the interface imposed back on the game:

> "New Constraints — Three attack types … **Orthogonal attacks** … **Static
> enemy design:** Same Health, Same Weapon, Same Movement"
> "**Massive cuts to Weapon Design.**"

**They cut diagonal attacks because they could not draw them legibly on a
grid**, and flattened all enemies to identical stats so the overlay never had to
explain variation. Interface constraints driving combat rules, not the reverse.

Their one admitted mistake is worth remembering too: the Power Grid "**Inserted
Randomness into a 'deterministic' design** … Annoyed players."

## Terrain cost per movement type

This exists because of a bug found by running the numbers rather than reading
them. The first stat pass gave cavalry more health, more attack, the same
defence, more speed and more movement than infantry. **Strictly better at
everything**, so infantry had no reason to exist.

The genre's answer is not to nerf the stats. It is to make the map do the
balancing: cavalry owns open ground and pays for rough terrain, infantry goes
where horses cannot. Advance Wars and Fire Emblem both structure terrain as a
cost table indexed by movement type.

| Terrain | Foot | Horse | Defence |
|---|---|---|---|
| Plain / Road | 1 | 1 | 0 |
| Forest | 2 | 3 | +1 |
| Hill | 2 | 3 | +1 |
| Mountain | 3 | impassable | +2 |
| Water | impassable | impassable | 0 |

## The path preview is a cursor trail, not a recomputed path

Advance Wars GBA manual:

> "The unit will follow the path shown by the **Movement Arrow** … the red arrow
> that **traces** the route from the selected unit to its destination."

The load-bearing word is *traces*. You can steer the arrow around a chokepoint
rather than accept the shortest path.

The implementation rule, confirmed against the FE8 decompilation
(`src/bmpatharrowdisp.c`): **maintain the path as a stack.** Cursor steps to an
adjacent tile, push. Steps back onto the previous tile, pop. If pushing would
exceed the budget, or the cursor jumped non-adjacently, discard the trail and
substitute a fresh shortest path.

That last clause is where gamepad and mouse diverge. With a D-pad the trail is
free; **with a mouse you fall back to pathfinding on most frames.**

It matters mechanically as well as cosmetically: the path actually traversed
determines fog reveals and interception. Fire Emblem shipped a bug of exactly
this kind in Path of Radiance, where re-movement was calculated from the
shortest path rather than the path taken.

## Fog of war, if we ever add it

Fire Emblem's fix is the cleanest of the three the genre has tried:

> "A unit's field of vision will only be **updated after a unit performs an
> action**, such as waiting or attacking."

Because vision refreshes only on *commit*, a cancelled move leaks nothing, so
free move-cancel stays safe even in fog.

Advance Wars did not do that and paid for it. Free move-cancel plus immediate
reveal equals a free radar sweep:

> "In the first three Advance Wars games, you can scout ahead by moving your
> scouting units into spaces hidden by FoW, **but without confirming your
> action**, and then repeating the process in different spaces to lure out an
> ambush."

Nintendo tried a **cost** fix first (burn the fuel anyway), then a **commit**
fix in Days of Ruin. Fire Emblem's **timing** fix is better than both.

## The dice lie, deliberately

Fire Emblem does not roll once. It rolls **twice and averages** before comparing
to the displayed hit chance.

| Displayed | Actual |
|---|---|
| 90% | 98.1% |
| 80% | 92.2% |
| 70% | 82.3% |
| 50% | 50.5% |
| 30% | 18.3% |
| 10% | 2.1% |

1RN in FE1 to 5; **2RN from FE6 onward**. The stated rationale: it "encourages
low Hits missing and encourages high Hits hitting," which mostly benefits the
player, since player units usually have high hit and enemies low.

Players read 90% as "basically certain" and feel cheated when it misses. A
99-hit unit missing 1 in 10,000 instead of 1 in 100 is the difference between a
system that feels fair and one that feels rigged.

Shadow Dragon takes it to its logical end: during one chapter **the forecast
actively lies** when facing a disguised enemy, so it cannot be used as an
oracle.

Note: the widely repeated claim that Fates uses a hybrid formula above 50% is
**not** in Serenes Forest's true-hit tables. Do not repeat it as fact.

## Forecast panel layout

Two franchises, thirty years apart, converged on the same arrangement:

- **FFT (PS1):** two unit panels at the bottom, **attacker left, target right**,
  with the prediction drawn into the attacker's panel: predicted HP damage on
  the left, success probability on the right.
- **Tactics Ogre: Reborn:** "**left the predicted damage, right the hit rate**",
  plus status-effect icons and an elemental matchup glyph.

That is about as close to a genre standard as exists.

Fire Emblem's GBA contents, from the manual: HP, Mt (might, "**×2 for 2 attacks
in one turn**"), Hit, Crit, and a ▲/▼ glyph for the weapon triangle. Two details
usually got wrong: the triangle is a glyph not a coloured arrow, and **doubling
is appended to the might figure rather than being its own row.**

Fire Emblem Heroes is the interesting outlier. It **removed hit and crit
entirely**, making every attack a guaranteed hit, which turns the forecast from
an estimate into a promise. It then spends the freed clarity on one strong
signal: a portrait flashing red means this kills.

## Turn order

Once turn order is always visible, an observation from the Ivalice Chronicles UI
work: "**if the player can see the turn order at all times, their CT value isn't
even relevant any more.**" A visible queue makes the underlying stat readout
redundant. Worth remembering if we ever move off strict phase turns.

## Gaps

- Whether Advance Wars: Re-Boot Camp added a damage forecast.
- Tactics Ogre's movement-panel colour is nowhere stated in words for any
  version. Range panels are confirmed red in Reborn.
