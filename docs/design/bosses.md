# Bosses

Each act ends in a hand-crafted boss match. There are **3 bosses, one per act**, fixed (not from a pool). The act-3 boss is the **finale** and gets the strongest hand-crafted treatment.

## Structure

| Act | Match position | Boss role                 |
|-----|---------------|----------------------------|
| 1   | Match 3       | Boss A — introductory boss; teaches "boss = special rules" |
| 2   | Match 6       | Boss B — middle-game boss; tests built-up deck/roster |
| 3   | Match 9       | Boss C — finale; hardest, most spectacular |

The player **knows which boss is coming at the start of the act**. This lets them shop and draft with the boss in mind. The boss preview shows: name, signature mechanic, and the status effects the boss will apply. Specific hazards/modifiers/triggers are visible in the preview.

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

### 3. Persistent status effects

This is the boss's "passive ability layer." Bosses don't have decks — instead, they apply **status effects** to the player at match start. A status effect is a passive trigger-and-fire entry on `MatchCardState` that fires automatically the moment its trigger condition is met during gameplay.

Each status effect is defined by a `(trigger, effect)` pair:

- **Trigger** — when the status fires. Currently supported: `turn-start`, `every-n-turns`, `on-self-capture`, `on-opponent-capture`, `on-self-check`, `on-self-pawn-move`.
- **Effect** — a `CardEffect` payload. Reuses the same handler set as cards (e.g. `next-move-constraint`, `boss-extra-move`, `capture-random-own-minor`).

Properties:

- Status effects fire **automatically** the moment their trigger fires; they never sit "waiting to be played" in the player's hand.
- They are **persistent** for the whole match unless they declare a `remainingTriggers` cap (one-shot statuses) or an `expiresOnTurn` (timed statuses).
- They are **per-status once-per-turn**: each status fires at most once per target-side turn. Multiple statuses can fire on the same turn — Boss C's Echo and Bit Rot can both land on a single turn if the player checks during a turn divisible by 5.
- Triggers are **deterministic**: a check always fires `on-self-check`, never RNG-gated, so the player can plan around them.
- The system is **side-symmetric**: today only boss → player statuses ship, but the same machinery will host future cards that apply status effects to the enemy.

See [`docs/design/status-effects.md`](status-effects.md) for the full reference.

## Boss design philosophy

A boss's mechanics should:

- **Force a different play style** than normal matches. If the player can play their normal game and win the boss, the boss isn't doing its job.
- **Combine all three layers** (modifier + hazard + curse) so the boss is layered. Rarely, a boss may emphasize one layer (e.g., a boss whose entire identity is its modifier), but most should hit all three.
- **Be visible/predictable.** Players should know the boss's trick at act start and be able to plan around it. Surprise is for individual moves, not for boss identity.
- **Not depend on RNG within the match.** Status-effect triggers are deterministic (specific events), not "every turn there's a 30% chance" — players should be able to anticipate when a status will fire based on the trigger.
- **Be hand-crafted, not parameterized.** Every boss is its own unique hand-built encounter. We are not building a "boss generator."

## The three bosses (Standard mode)

Coordinates are given for the active default mode (Standard). Each boss is played on its act's board size — Boss A on 6×6, Boss B on 7×7, and Boss C on 8×8 — see `progression.md` and the per-match table in `modes.md`. Royal would place all three on 8×8 if/when re-enabled; the original 8×8 sketches for A and B are kept at the bottom of this file as a record.

### Boss A — "The Firewall" (Act 1, match 3, 6×6, K + 6P + N + B + R per side)

- **Modifier:** Walls cannot be placed by the player.
- **Hazards:** Two indestructible wall-pillars on **c3 and d4** (a diagonal pillar through the middle of the 6×6 board — same intent as the d4/e5 pillars on 8×8: split the board, force play around the pillars).
- **Status effects:** *Throttled* — fires the moment you put the boss in check, locking your next chess move out of delivering check.

Teaches: bosses break your assumptions; play around fixed hazards; sometimes cards are disabled.

Note: with only 10 pieces per side and the two central walls, mate paths get tight. Rebalance check during playtest — if Boss A becomes unwinnable, drop to a single wall pillar.

### Boss B — "The Whale" (Act 2, match 6, 7×7, K + 7P + 2 N + 2 B + 2 R per side)

- **Modifier:** Captures grant the *captured* side +1 energy next turn.
- **Hazards:** A boss-controlled zone-buff square at **d1** (the center of the player's back rank on a 7-file board). Granting boss +1 energy. Player must contest it.
- **Status effects:** *Memory Leak* — fires every 4 turns at turn start, queueing a "capture this turn or lose 1 energy next turn" penalty.

Teaches: not all captures are good. Pressure piece economy.

### Boss C — "The Singularity" (Act 3, match 9, 8x8, full armies + queen)

- **Modifier:** Promotion is disabled. Player's pawns cannot promote.
- **Hazards:** A 2x2 "void" in the center (e4, e5, d4, d5) that destroys any piece ending its turn there.
- **Status effects:**
   - *Hardened* — fires once on turn 1, blocking all 0-cost card plays for the rest of that turn.
   - *Echo* — fires the moment you check, granting the boss one extra chess move this turn.
   - *Bit Rot* — fires every 5 turns at turn start, destroying one of your minor pieces (knight or bishop) at random.

Teaches: the finale stresses every system. Decks must be tuned to handle multiple constraints simultaneously.

These coordinates are starting points. Real boss tuning happens during prototype iteration — see `roadmap/milestones.md`.

### Royal-mode coordinates (post-prototype reference)

Kept for the day Royal is re-enabled with 8x8 bosses. Boss A would use d4/e5 wall-pillars; Boss B would put its zone-buff on the center of the player's 8-file back rank (e.g. d1 or e1). Boss C is unchanged — already at 8x8.

## Boss rewards

Defeating a boss grants, in this order:

1. A **large gold bonus** (greater than performance-bonus + win-bonus normal-match payouts).
2. A **boss-reward boon pick** (Monster-Train-style): 1-of-3 fixed options. No skip. Resolves before the artifact and card draft. Options:
    - **+1 energy / turn** for the rest of the run (synthesized as an artifact with `energy-per-turn-bonus`).
    - **+1 card draw / turn** for the rest of the run (synthesized as an artifact with `hand-size-bonus`).
    - **Delete 2 cards** from the run deck (free; gates the next reward step until both deletions are spent).
3. An **artifact reward**: 1-of-3 from the boss-tier artifact pool (skewed rare).
4. A **card draft** (1-of-3) from the regular card pool. (Boss matches do not have a special card pool.)
5. (Skirmish only) A **piece draft** (1-of-3), with a slight bias toward the rare tier.

The player then visits the shop before the next match begins.

The boon pick is the structural counterpoint to the artifact pick: the artifact slate is RNG-driven and rare-skewed (so the player can angle for archetype-specific synergies), while the boon pick is a fixed three-way decision about *run shape* — more energy, more cards, or a leaner deck. Picking "+1 energy" twice across a 9-match run lands the player at a baseline of 5 energy / turn by act 3.

## What bosses don't do

- Bosses do not have decks of cards (no AI hand). They have a fixed roster of status effects that trigger on game events.
- Bosses do not heal or have HP. The win condition is checkmate, same as normal matches.
- Bosses do not have multiple phases in the prototype. (Multi-phase bosses are interesting but out of scope — see `roadmap/open-questions.md`.)
- Bosses do not use Ascension-style scaling within a single boss; they ARE the difficulty plateau of the act.

## AI for bosses

The boss AI uses the same Stockfish.wasm engine as normal matches, possibly at slightly higher depth. The boss's status-effect dispatcher is a separate scripted layer that fires deterministically on its triggers. Stockfish does not see status effects; it just plays chess. See `technical/ai.md` for the architecture.
