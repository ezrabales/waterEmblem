# The AI opponent, and whether it can tell us anything true

This one is different from the other three notes. Those surveyed the genre
before we wrote code. This one **surveyed the genre and then measured our own
engine**, because the question — "can we simulate thousands of games to find out
whether the unit triangle is balanced?" — has two halves, and only one of them
is answerable from the literature.

The half that is: what kind of AI to build. The half that isn't: whether a
simulated balance result means anything. We got a firm answer to the first and
an uncomfortable, honest answer to the second.

## The bottom line

**Build a greedy per-unit utility AI with a threat map. Nothing else. Spend the
time on the evaluation function.** Every search technique we tested lost to a
well-tuned greedy AI while costing 10 to 100× the throughput.

Overkill, measured or argued: MCTS, minimax over turns, alpha-beta, ISMCTS, HTN
planning, portfolio search, Online Evolution, anything learned.

## Why search is not on the table

We measured turn-one branching on the real `shared/` rules:

```
per-unit (destination × action) options: 30 + 30 + 53 + 25 = 138
unordered joint turns (product):           1,192,500
ordered joint turns (× 4! orderings):     28,620,000
```

One turn is ~1.2M joint moves, ~29M if ordering counts. Two plies is 10¹³–10¹⁵.
Minimax over turns is not slow, it is arithmetically impossible.

The standard fix is to make the tree edge a *unit action* rather than a whole
turn — which is the shape `legalActions()` already has. The literature is blunt
that this is a trap at our branching factor. Justesen, Mahlmann & Togelius,
[Online Evolution for Multi-Action Adversarial Games](https://lup.lub.lu.se/search/files/5613107/8569741.pdf)
(2016), is the closest paper in existence to our situation — Hero Academy, 5
actions per turn, ~60 legal actions, 60⁵ ≈ 7.8×10⁸ turns. They measured MCTS at
**258,488 iterations per turn reaching an average leaf depth of 4.86 plies**.
The tree barely crosses the turn boundary, so it never gets adversarial signal
back. Head-to-head, Online Evolution beat MCTS **98–2**, and MCTS tied 1-ply
greedy at 51.5%.

There is a recurring threshold in this literature: **abstraction pays above ~16
units and loses below ~8.** Script-based UCT loses to plain UCT at 4 units and
wins 100% at 32. We have four. Search concrete actions or don't search.

One more reason search is unattractive here, which we found by running it:
**random playouts never terminate.** 0 wins in 2000 random games — every one hit
the 60-turn cap. There is no signal at the leaves, which kills plain MCTS
outright.

## What shipped games actually do

Remarkably uniform: **greedy utility scoring over enumerated single actions, no
lookahead.** The differences are only in what feeds the score.

| Game | Enumeration | Score | Lookahead | Selection |
|---|---|---|---|---|
| Fire Emblem GBA | weapons × enemies × tiles | 8 terms, 32 weight sets | one battle sim, hits assumed | argmax |
| Wargroove | all valid orders | 3 heatmaps | none, by explicit perf decision | argmax |
| XCOM 2 | BT picks move kind, tiles scored | 14 weight profiles | none | tree order + argmax |
| Battle Brothers | 60+ behaviours × targets | additive then multiplicative | none | **weighted-random above cutoff** |
| FFT | fixed pipeline | TargetValue + status table | none | argmax with ~13.7% bail |
| Gears Tactics | goals → units → abilities | fuzzy priority + WorldState | **whole-turn team plan** | assignment + BT |

Fire Emblem is fully answerable because the GBA game is decompiled — the AI is
in `src/cp_*.c` in [fireemblem8u](https://github.com/FireEmblemUniverse/fireemblem8u)
("cp" for computer player, which is why grepping for `ai.c` finds nothing). It
picks the **position first**, then simulates the fight there:

```
50 if the target's weapon cannot reach this tile   (a free hit)
+ terrainAvoid + terrainDef + terrainRes
+ Σ over radius-3 diamond: +5 per ally, −5 per enemy
− movementCost to reach
− dangerMap[y][x] / 8
```

Its kill test is deterministic and *optimistic*: the simulation hardcodes
hit→true, crit→false. "Will this kill" means "would it kill if every blow
lands."

The structural flaws are visible in the code, and they are the ones players
exploit: one unit decides and acts before the next is considered, so no unit
knows what a later ally will do; unit order is frozen at phase start; and
"stationary" enemies aren't — with the do-nothing behaviour the movement map is
still built, so aggro range is `MOV + weapon range`. That is the bait exploit,
and it is a bug in the sense that it was never designed.

Chucklefish published [Wargroove's](https://wargroove.com/the-ai-of-war/) design
directly, and it is the closest match to what we should build — three heatmaps
(threat, objective, support), then, verbatim:

> "The AI uses values from these heatmaps to score every possible valid order it
> could give next, and then chooses the highest-scoring order to execute."

On lookahead they are explicit that it was a performance decision, and they list
their failure modes candidly, including that over-estimating threat makes the AI
sit still and lose. We reproduced that failure exactly (below), which was a
useful confirmation that we had built the same thing they had.

## What we measured on our own engine

**The current rules layer is too slow for self-play**, for reasons worth
recording:

```
legalActions(4 units, turn 1)   111.06 us   →   9,000/s
applyAction(move)                28.37 us   →  35,200/s
random self-play                                19 games/s
```

Two structural costs: `key(x,y)` string keys into `Map` throughout
`movement.js`, and each move costing **three Dijkstras** — `legalActions` →
`canStopAt` → `reachable`, then `applyAction` → `validateMove` → `reachable`
again. Plus `clone()` copies the whole log every action, which is O(n²) over a
game.

A search-oriented mirror using integer tile indices (`y*w+x`) and typed arrays
runs `reachable` **5.8× faster**, and gets self-play to ~1,150 games/s single
process, ~2,900 across four. Thousands of games in seconds. Parity against the
real rules was checked at 504 forecast comparisons across every unit pair and
terrain type, 0 mismatches.

**Then search lost.** Against the best hand-tuned greedy script, side-swapped,
1400 games each:

```
1 script (null control)   50.0% ±2.6   390 g/s
3 scripts                 58.1% ±2.6   227 g/s
6 scripts                 51.5% ±2.6   136 g/s

OE(pop=12,gen=4)   vs greedy   7.5% ±3.3   189 g/s
OE(pop=48,gen=16)  vs greedy  16.3% ±4.7    18 g/s
```

Portfolio search buys at most ~8 points, and *non-monotonically* — more scripts
is worse, because the selection overfits the fixed baseline opponent.

The decisive diagnostic: Online Evolution was seeded with the greedy turn, so it
plays greedy unless its champion scores higher on the evaluation. That should
floor it at 50%. It scored **27.9–32.6%**. The evaluation function prefers turns
that lose games, and search faithfully amplified a wrong objective.

This is the literature's own finding, confirmed. Churchill's ABCD scored 0.59 →
0.80 → 0.92 with the *algorithm unchanged* and only the evaluation improved.

> **The evaluation function is the entire game. Search is a multiplier on it, in
> whichever direction it already points.**

## Designing the evaluation function

[Battle for Wesnoth](https://github.com/wesnoth/wesnoth/blob/master/src/ai/default/attack.cpp)
is the closest shipped open-source match, and the single best idea in that file
is that **the terrain penalty is a counterfactual difference** —
`terrain_quality − alternative_terrain_quality`, not an absolute terrain score.
That is what stops a unit stepping out of forest for a marginal poke.

Two further ideas we should take:

**Use √HP, not HP.** Churchill, Saffidine & Buro's
[LTD2](https://skatgame.net/mburo/ps/aiide12-combat.pdf) sums `√hp(u)·dpf(u)`.
The concavity is the point: the *last* points of damage on a unit are worth more
than the first (√100 = 10; the first 50 HP removes 2.93 of value, the next 50
removes 7.07). That is focus-fire incentive, anti-chip-damage and anti-overkill
in a single term. microRTS and Wesnoth arrive at √HP independently.

**Compute the full HP distribution, not expected damage.** Wesnoth's
[attack_prediction.cpp](https://github.com/wesnoth/wesnoth/blob/master/src/attack_prediction.cpp)
is ~20 lines, exact, and yields chance-to-kill and chance-to-die for free.
Expected damage misprices threshold effects: 12 damage against a 10 HP unit and
a 40 HP unit have identical expected damage and wildly different value. And
critically — **feed it our true 2RN hit rate, not the displayed number**, or the
AI systematically misvalues high-hit attacks. Our displayed 90% is really 98.1%.

Focus fire and overkill avoidance then need no explicit rule. They fall out.

## How good does the AI have to be?

This is the crux, and it is where the honest answer lives.

The published bar is lower than expected. Jaffe et al.,
[Evaluating Competitive Game Balance with Restricted Play](https://homes.cs.washington.edu/~zoran/jaffe2012ecg.pdf)
(2012):

> "Although AI agents are unlikely to reach top human skill levels, **moderate
> play is informative for an initial understanding of balance**… **We only wish
> to detect extreme violations of a designer's balance goals.**"

Their actual contribution is the method: stop asking the AI to imitate humans,
and instead measure the win rate of a **deliberately handicapped** agent against
an unrestricted opponent that knows the handicap. "Is the unit triangle
load-bearing?" becomes the win rate of an agent that ignores triangle bonuses
against one that exploits that fact.

### The finding that decides the method

We ran mirror self-play — identical agent both sides, 1000 seeds each:

```
aggressive   P0 51.4% ±3.4
cautious     P0 33.9% ±3.3
berserk      P0 56.1% ±3.1
focus-fire   P0 57.9% ±3.4
balanced     P0 18.9% ±3.1
turtle       1000/1000 ties (never engages)
```

Same game, same map, same rules. "Does moving first help?" ranges from a **4:1
second-player advantage to a 58/42 first-player advantage**, purely as a
function of heuristic weights. **Run one agent and you ship a confident, wrong
answer.**

So the method is to run several and report only what survives all of them:

```
matchup                          aggressive  cautious  focus-fire  balanced  invariant?
balanced vs all cavalry              30.6%      1.6%      21.8%      9.7%   YES
all infantry vs all cavalry           0.0%      0.1%       0.0%      1.7%   YES
all infantry vs all archer           99.6%     99.3%      99.9%     98.7%   YES
balanced vs all infantry             96.0%     50.2%      96.9%     76.3%   NO — flips
all cavalry vs all archer            57.4%     36.5%      54.9%     58.8%   NO — flips
```

Act on the YES rows. Report the NO rows as skill-dependent and do not touch the
balance over them. This costs nothing beyond running four weight vectors.

### Sample sizes

Two-sided α=0.05, power 0.80, against a 50% null: detecting a 55% true win rate
needs **783 games**; 52.5% needs 3,138; 51% needs 19,620. Set the detection
threshold at 55% and treat 47.5–52.5% as not distinguishable. Don't chase 51% —
you would be measuring the agent's idiosyncrasies.

Four controls, all mandatory: side-swap every pairing; reuse seeds across the
mirrored pair (common random numbers); **decide capped games by material
differential rather than discarding them** — in one run 287 of 300 games hit the
cap and the discarded games contained the entire signal; and log the agent and
its weights next to every balance number.

## The uncomfortable part: circular validity

Simulated balance is measured through whatever AI is doing the measuring. We
went looking for the accepted solution to this. **There isn't one.** The problem
is named repeatedly across the literature and never solved. No paper takes a
balancing pipeline, re-runs it end to end at several controlled agent strengths,
and reports whether the recommended change agrees. Several papers *propose* that
experiment and never run it.

What exists is one useful rule, assembled from two results:

> A **scalar strength** sweep is likely to preserve verdicts. A **style** sweep
> is not.

DeepMind's [chess variant study](https://arxiv.org/abs/2009.04374) ran 9
variants across a 60× compute range and found absolute numbers shift but *"the
relative ordering of variations follows the ranking in general decisiveness."*
Zook et al. found a first-player effect that held *"regardless of agent
strength"* while its magnitude moved. Our own agent-personality spread is a
*style* sweep — the unstable kind. The right next test is a strength sweep
inside one style.

The canonical cautionary tale is Browne's Ludi: **12 of the 19 viable evolved
games were N-in-a-row games**, and he notes that the N-in-a-row advisor was the
strongest advisor his agent had. The system evolved games that flattered its own
agent's competence. Mahlmann et al. on Dominion state it outright: *"evolution
found card sets that exploited the inability of the agents… evolution found
exploits or bugs in the agents."*

And Nelson's [floor-effect paper](https://www.kmjn.org/publications/MCTSScaling_CIG16.pdf):
across 62 games, **more than half were insensitive to MCTS budget entirely.**

### Do not target 50%

The largest human study on the question says players don't want it. Pfau & Seif
El-Nasr analysed 4.3M Guild Wars 2 combat logs across 154,145 accounts plus a
680-player survey, and found players *"strongly opposed that every playable
class should produce symmetrical performance outputs"* — explicitly flagging
this as a problem for prior work (his own) that balanced toward symmetry.

**Target viability instead**: every unit should have a matchup and a map region
where it is the right answer. Cavalry dominating everywhere is a genuine
failure. An archer winning 40% overall while owning bridge defence is not.

This matters immediately for us, because a one-dimensional benchmark is exactly
what reverses. Pfau's Baldur's Gate 3 study found that when the benchmark
widened from 1 dimension to 5, *"even classes that appeared as the weakest in
the initial benchmark… shine in their niche."*

## What this already found in our game

**The unit triangle has only two legs.** Design intent is cavalry > infantry >
archer > cavalry. The third leg does not exist:

```
Pure stat-block exchange, open plain, attacker initiates:
              vs infantry     vs cavalry     vs archer
infantry     1.8 dmg/10.8t   4.4 dmg/5.0t   4.6 dmg/3.5t
cavalry      7.0 dmg/2.8t*   5.8 dmg/3.8t   6.1 dmg/2.6t
archer       1.8 dmg/11.4t   4.1 dmg/5.3t   4.4 dmg/3.6t
(* attacker doubles)
```

The archer free-hits cavalry at range 2 for 4.1/turn and needs 5.3 free turns to
kill it. Cavalry closes 7/turn against an archer fleeing 4/turn — net 3 — so
from 12 tiles it is adjacent in about 4 turns, having taken only ~16.5 of the 22
damage it needed to take. Then it kills the archer in 2.6 turns. **Move 7 plus
doubling defeats range 2.** All-cavalry beats all-infantry 119–1; all-infantry
beats all-archer 120–0. The triangle is currently "cavalry > everything >
archer".

**Infantry mirrors are a stalemate.** 1.8 damage per exchange against 20 HP is
10.8 turns to kill. That is the root cause of games hitting the turn cap, and
why the AI's approach weight had to be tuned hard before games terminated at
all.

Per the rule above: the cavalry-dominance finding is **invariant across all four
agent personalities and follows from a threat-range inequality**, so it is safe
to act on. The "archer is weak" conclusion is softer — it was measured on one
map under annihilation rules, which is the single-dimension benchmark Pfau shows
reversing. Before buffing the archer, measure it on a second axis: chokepoint
defence at the bridges, or a seize objective.

## A methodology warning that cost an hour

The first portfolio-search result was 83.5% against greedy. It was entirely a
bug — a module-global occupancy buffer read before it was filled, leaking stale
state into the real game. The result was plausible, large, and wrong.

**A null control — the same agent against itself, which must return exactly
50.0% — caught it immediately, and nothing else would have.** Module-global
scratch buffers are the price of the typed-array speedup. Write the null control
first.

## Gaps

- **Advance Wars' actual AI is undocumented.** No usable decompilation exists;
  the best community threads are Reddit-locked. [Commander Wars](https://github.com/Robosturm/Commander_Wars)
  is a clone, not Intelligent Systems' code.
- **Into the Breach's action-selection rule was not found.** The GDC postmortem
  is design-only, and establishes it as a puzzle-generation problem rather than
  an adversary problem — so it is not a model for us anyway.
- **Prismata's balance-testing blog posts are unverifiable** — both domains now
  serve expired TLS certificates. The AIIDE paper and engine are solid; the
  balance claims are not.
- Baier & Cowling (2018) reportedly beats Online Evolution on Hero Academy, but
  it is IEEE-only. Given what we measured, not worth chasing.
- The Yannakakis & Togelius chapter on AI for playtesting went unretrieved: the
  PDF is 97 MB.
