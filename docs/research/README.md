# Research

Before writing the rules layer we surveyed how the genre actually solves these
problems, rather than guessing. These notes are the findings, with sources, and
they record **why** the code looks the way it does.

The fourth note is a different kind of document: it surveyed the literature and
then **measured our own engine**, so its numbers are original rather than cited.

Where a claim could not be sourced, it says so. Several widely repeated pieces
of folklore turned out to be wrong, and those are flagged rather than quietly
dropped.

| File | Covers |
|---|---|
| [`overlays-and-threat.md`](overlays-and-threat.md) | Colour conventions, movement and attack overlays, danger zones, colourblindness |
| [`undo-and-commit.md`](undo-and-commit.md) | When a move becomes irreversible, and how to allow generous undo without enabling save-scumming |
| [`movement-and-combat.md`](movement-and-combat.md) | Pathfinding, terrain costs, the hit-chance lie, forecast panel layout |
| [`ai-and-balance.md`](ai-and-balance.md) | What kind of AI opponent to build, and whether simulated balance testing can be trusted |

## The four findings that changed the code

**1. Faction colours and overlay colours cannot share hues.**
Nintendo's convention is blue movement, red attack. Advance Wars breaks it and
uses green for movement, because its *armies* are colour-coded and it cannot
spend blue and red twice. Ours are blue and red too. This is why the overlays
sit on teal, purple, amber and magenta instead.

**2. Rewind must not reroll.**
Tactics Ogre Reborn seeds its RNG so that replaying the same action after a
rewind gives the same result. That is what lets it offer a generous undo
without players farming criticals. `shared/game.js` seeds from the action's
position in the log for exactly this reason.

**3. The undo boundary has a precise rule, and it is not "before you attack".**
A move is undoable until it changes what the player *knows* or what the world
*contains*. Reveal, resource gain and dice roll are the three lock triggers.
Until one fires, a move is UI state, not game state.

**4. The unit triangle had only two legs. It has three now.**
Measured, not surveyed — the first finding here that came from running the rules
rather than reading about someone else's. Cavalry's move 7 defeats the archer's
range 2 outright, so the archer-beats-cavalry leg did not exist and the triangle
read "cavalry > everything > archer", with a Nash mix of 100% cavalry. Archers
now deal effective damage to horses (`effective: { horse: 6 }` in `units.js`),
which flips that matchup from 2.1% to 84.9% and makes the beat-relation an
actual cycle at both 1v1 and army scale. The remaining problem — that all three
legs are near-absolute at ~99% — is recorded in the note and deliberately not
acted on.

## Method and honesty

The research was done by agents reading primary sources: scanned Nintendo
instruction manuals, official Square Enix play guides, the Fire Emblem 8
decompilation, the Battle for Wesnoth manual, GDC postmortems, and developer
interviews. Wiki and forum material is cited where it corroborates or where no
primary source exists.

`ai-and-balance.md` adds a second method: a search-oriented mirror of the rules,
verified against `shared/` at 504 forecast comparisons with 0 mismatches, then
run for thousands of self-play games. Every number in that note that is not
attributed to a paper was measured that way, and the agent and weights behind
each one are recorded alongside it.

Known gaps are listed at the end of each file. They are gaps, not omissions.
