# Bosses

Each act ends in a hand-crafted boss match. There are **3 bosses, one per act**, fixed (not from a pool). The act-3 boss is the **finale** and gets the strongest hand-crafted treatment.

## Structure

| Act | Match position | Boss role                 |
|-----|---------------|----------------------------|
| 1   | Match 3       | Boss A — introductory boss; teaches "boss = special rules" |
| 2   | Match 6       | Boss B — middle-game boss; tests built-up deck/roster |
| 3   | Match 9       | Boss C — finale; hardest, most spectacular |

The player **knows which boss is coming at the start of the act**. This lets them shop and draft with the boss in mind. The boss preview shows: name, signature mechanic, and the curse-card pool the boss will draw from. Specific cards/hazards/modifiers are visible in the preview.

## What makes a boss "boss"

Every boss combines three layered mechanics:

### 1. Match-modifier rules

A persistent rule change that lasts the whole match. The rule is announced before the match starts. Examples:

- "Pawns may move backward."
- "Captures grant the captured side +1 energy on their next turn."
- "Walls cannot be placed by the player."
- "Both sides start with 4 cards, not 5."
- "Promotion is disabled."

### 2. Fixed board hazards

Pre-placed walls, hazards, or terrain on the board at match start. Examples:

- A wall of indestructible blocks down the d-file.
- "Hazard squares" on the corners that capture pieces ending their turn there.
- Pre-placed enemy zone-control buffs the player must dislodge.

These are visible from the start of the match. Standard cards (and the player's pieces) can interact with hazards if they're destructible, but indestructible hazards are permanent map features the player must navigate around.

### 3. Curse cards forced into the player's hand

This is the boss's "deck-equivalent." Bosses don't have decks — instead, on **specific triggers** (turn 1, after a capture, every N turns, when the player checks them, etc.), the boss inserts a **curse card** into the player's hand.

Curse-card properties:

- Cost 0 energy.
- Have detrimental effects on the player.
- Must be played to be removed from hand (the player cannot voluntarily discard them outside of a card that explicitly discards).
- They do **not** count against the hand-size cap of 5 (a curse is "bonus" beyond the cap, so a player who already has 5 cards may end up with 6 in hand).
- Once played, curses **vanish** — they do not enter the player's deck and do not return next match.

Example curse cards:

- *Self-Doubt* (0): "Lose 1 energy this turn. Cycle this card."
- *Frozen Heart* (0): "One of your bishops is frozen this turn (cannot move). Cycle this card."
- *Shaky Resolve* (0): "Discard a card at random. Cycle this card."
- *Treacherous Move* (0): "Your next chess move must be made by your queen, if legal. Otherwise, you may make any move. Cycle this card."

(*"Cycle this card"* in the curse context means it leaves the hand on play and does not return to hand or deck — equivalent to consume but used to differentiate from positive-consume cards.)

The boss may insert curses **at most once per turn** to prevent unfair pile-ons. Different bosses have different curse-injection triggers and pools.

## Boss design philosophy

A boss's mechanics should:

- **Force a different play style** than normal matches. If the player can play their normal game and win the boss, the boss isn't doing its job.
- **Combine all three layers** (modifier + hazard + curse) so the boss is layered. Rarely, a boss may emphasize one layer (e.g., a boss whose entire identity is its modifier), but most should hit all three.
- **Be visible/predictable.** Players should know the boss's trick at act start and be able to plan around it. Surprise is for individual moves, not for boss identity.
- **Not depend on RNG within the match.** Curse-card insertion timing should be deterministic (specific triggers), not "every turn there's a 30% chance" — players should be able to anticipate curses based on the trigger.
- **Be hand-crafted, not parameterized.** Every boss is its own unique hand-built encounter. We are not building a "boss generator."

## Sketch of the three bosses (illustrative — not committed)

### Boss A — "The Iron Garrison" (Act 1)

- **Modifier:** Walls cannot be placed by the player.
- **Hazards:** Two indestructible wall-pillars on d4 and e5 from match start.
- **Curses:** Whenever the player checks the boss, draws a *Stalwart* curse: "Your next move must be a non-checking move."

Teaches: bosses break your assumptions; play around fixed hazards; sometimes cards are disabled.

### Boss B — "The Gambit" (Act 2)

- **Modifier:** Captures grant the *captured* side +1 energy next turn.
- **Hazards:** Player's back rank has a "tempting" zone-buff square that the boss controls (granting boss +1 energy). Player must contest it.
- **Curses:** Every 4 turns, draws a *Greed* curse: "Capture an enemy piece this turn, or lose 1 energy next turn."

Teaches: not all captures are good. Pressure piece economy.

### Boss C — "The Final Mind" (Act 3, finale)

- **Modifier:** Promotion is disabled. Player's pawns cannot promote.
- **Hazards:** A 2x2 "void" in the center (e4, e5, d4, d5) that destroys any piece ending its turn there.
- **Curses:** Multiple triggers:
   - Turn 1: *Final Resolve* — "You may not play any 0-cost cards this turn."
   - On player check: *Echo* — "The boss makes an extra move this turn."
   - Every 5 turns: *Inevitability* — "Choose one of your minor pieces; it is captured."

Teaches: the finale stresses every system. Decks must be tuned to handle multiple constraints simultaneously.

These sketches are starting points. Real boss design happens during prototype iteration — see `roadmap/milestones.md`.

## Boss rewards

Defeating a boss grants:

1. A **large gold bonus** (greater than performance-bonus + win-bonus normal-match payouts).
2. An **artifact reward**: 1-of-3 from the boss-tier artifact pool (skewed rare).
3. A **card draft** (1-of-3) from the regular card pool. (Boss matches do not have a special card pool.)
4. (Skirmish only) A **piece draft** (1-of-3), with a slight bias toward the rare tier.

The player then visits the shop before the next match begins.

## What bosses don't do

- Bosses do not have decks of cards (no AI hand). They have fixed scripted curse insertions.
- Bosses do not heal or have HP. The win condition is checkmate, same as normal matches.
- Bosses do not have multiple phases in the prototype. (Multi-phase bosses are interesting but out of scope — see `roadmap/open-questions.md`.)
- Bosses do not use Ascension-style scaling within a single boss; they ARE the difficulty plateau of the act.

## AI for bosses

The boss AI uses the same Stockfish.wasm engine as normal matches, possibly at slightly higher depth. The boss's curse-insertion is a separate scripted layer that fires deterministically on its triggers. Stockfish does not see curse cards; it just plays chess. See `technical/ai.md` for the architecture.
