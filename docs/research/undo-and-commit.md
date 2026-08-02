# When a move becomes irreversible

This is the finding that shaped `shared/game.js`, and it turned out to have a
precise, sourceable rule rather than a convention.

## The rule

> **A move is undoable until it changes what the player knows or what the world
> contains.** Reveal, resource gain and dice roll are the three lock triggers.
> Until one fires, a move is UI state, not game state.

It exists in writing, in a shipped manual. *Strategic Command: American Civil
War*:

> "This option allows you to **undo a move providing that move hasn't disclosed
> any previously unseen enemy units**."

And the implementation trick from the same discussion, which is the tidy part:
**make the reveal and the lock the same event.**

> "any new information in the spotting range is only revealed after you've
> unselected the moving units, and once you do that you can no longer undo."

Square Enix states the action-flavoured version for Tactics Ogre Reborn:

> 「『移動』コマンドは、**他のコマンドを実行する前であれば、やり直すことができます**。」
> "The **Move** command can be redone as long as you have not executed another
> command."

## What the genre actually does

| Game | Undo rule | Locking event |
|---|---|---|
| Into the Breach | Movement freely undoable; weapons are not; one turn reset per battle | Firing a weapon |
| Tactics Ogre Reborn | Free move-undo before any other command, plus a rationed Chariot rewind | Any non-move command |
| FFT: Ivalice Chronicles (2025) | Undo movement before attacking, **blocked per-ability** | Attacking, or a move that granted something |
| Fire Emblem: Three Houses | No in-turn undo; Divine Pulse rewinds turns as a limited resource | n/a |
| FFT (PS1) | **None** | The commit itself |
| XCOM | **None.** A single right-click commits | The click, but see below |

**Fire Emblem's real boundary**, which no manual states in one sentence but
three sources confirm: B from the command menu returns the unit to its original
tile. Choosing any command, including **Wait**, is the commit. Advance Wars:
Dual Strike does say it in print: *"Unit movement can be canceled by pressing
the B Button."*

## XCOM is the cautionary tale

XCOM has no undo, but that is not why it frustrates people. VG247:

> "I found myself constantly **refusing to move ahead**. Any move I make could
> aggro another enemy squad I can't see… Any of these moves could be one tile
> too far."

The lock trigger is **pod activation**, and pod activation is *invisible before
you commit*. The design fault is not the missing undo button, it is that the
irreversible consequence is undetectable at decision time.

The community's response is instructive. The canonical mod, Gotcha Again,
previews flanks, overwatch triggers and pod activations on the destination tile,
and then imposes a limit on itself:

> "Both the overwatch and pod activation indicators **only take enemies
> currently visible to you into account, so they are exclusively based on
> information already available to you through the UI in the vanilla game
> (otherwise it would be cheating!)**."

**Players did not ask for undo. They asked that every consequence already
derivable from visible information be shown before commit.** That is a clean
policy and we adopt it.

Two other mods add friction *only where the move is dangerous*: a confirmation
popup that fires solely when the destination is out of cover **and** ranged
enemies are visible, and a 0.75-second dwell-time commit with a transparent
cursor while it ticks. Both good techniques. But if you need them, the real bug
is upstream.

## Rewind must not reroll

This is the finding that changed our code.

Tactics Ogre's Chariot Tarot rewinds up to 10 turns. **The replay is
deterministic**, and players confirm it:

> "taking the same action after chariot rewind will always result in the same
> outcome"; "you just need to take a **different action** before the recruit /
> kill for loot etc to have it re-roll."

So it is a **decision undo, not a dice undo**. That kills save-scumming while
still forgiving misplays, and it is cheap: seed the RNG per
`(turn, actor, action)` rather than running one generator.

Development history backs the tuning. The PSP version originally allowed 100
moves of rewind, was "deemed too lenient" and cut to 50; Reborn starts at 10 and
grows. It was added at Matsuno's suggestion, explicitly as a beginner tool, and
the enemy AI was given a random element specifically to stop exploitation.

`shared/game.js` implements this:

```js
const rngFor = (state, action) =>
  prng(hash(`${state.seed}|${state.log.length}|${action.kind}|${action.unitId}`));
```

The RNG is a function of **where the action sits in the log**, not of a running
stream. Repeat the same action after an undo and the dice agree.

## Gate the lock per-effect, not globally

Final Fantasy Tactics: The Ivalice Chronicles exempts individual abilities. The
effect text literally reads **"Movement cannot be reset for units with this
ability"** on Lifefont (recovers HP on moving), Manafont, Accrue EXP, Accrue JP
and Teleport.

That is "undo until consequence" implemented as a per-ability flag rather than a
mode. If moving generated a resource, revealed something, or rolled a die, the
move is locked. Otherwise it is free. Very clean, and directly portable if we
ever add abilities that trigger on movement.

## Two mechanisms for two failures

Tactics Ogre runs both, and keeps them separate:

- **Free move-undo before the first committing command**, for misjudged geometry.
- **A rationed, deterministic turn-rewind**, for misjudged risk.

Do not loosen the first to cover the second. We have implemented the first;
the second is available later without changing the model, because the log
already supports replay from any point.

## On the displayed hit chance

Jake Solomon, on XCOM:

> "If you see an 85 percent chance to hit, you're **not looking at that as a 15
> percent chance of missing**."
> "Random is never the way people expect it to be… We're human beings, we see
> patterns."

XCOM quietly makes a displayed 85% closer to 95% on lower difficulties. Fire
Emblem does the same thing more systematically with its two-roll average. Both
are the same admission: **the displayed number is a UX artifact tuned to player
intuition, not a readout of the model.**

## Gaps

- Triangle Strategy's exact move-undo boundary. Everything points to the
  standard flow plus its Simulation mode, but no source states it outright.
- How XCOM renders the path line to the hovered tile.
- Any Fire Emblem developer commentary on why the commit point sits where it
  does. The Kaga interviews give the philosophy ("put the weight on outcomes")
  but never address undo.
