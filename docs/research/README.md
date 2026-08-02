# Research

Before writing the rules layer we surveyed how the genre actually solves these
problems, rather than guessing. These notes are the findings, with sources, and
they record **why** the code looks the way it does.

Where a claim could not be sourced, it says so. Several widely repeated pieces
of folklore turned out to be wrong, and those are flagged rather than quietly
dropped.

| File | Covers |
|---|---|
| [`overlays-and-threat.md`](overlays-and-threat.md) | Colour conventions, movement and attack overlays, danger zones, colourblindness |
| [`undo-and-commit.md`](undo-and-commit.md) | When a move becomes irreversible, and how to allow generous undo without enabling save-scumming |
| [`movement-and-combat.md`](movement-and-combat.md) | Pathfinding, terrain costs, the hit-chance lie, forecast panel layout |

## The three findings that changed the code

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

## Method and honesty

The research was done by three agents reading primary sources: scanned Nintendo
instruction manuals, official Square Enix play guides, the Fire Emblem 8
decompilation, the Battle for Wesnoth manual, GDC postmortems, and developer
interviews. Wiki and forum material is cited where it corroborates or where no
primary source exists.

Known gaps are listed at the end of each file. They are gaps, not omissions.
