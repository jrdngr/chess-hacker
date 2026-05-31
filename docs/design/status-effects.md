# Status effects

Status effects are persistent passives attached to a side of a match. When a status's trigger condition fires during gameplay, the framework applies its effect immediately. Today only **boss → player** status effects ship (replacing the legacy curse-card-in-hand mechanism); the same system is designed to host **player → enemy** status effects in the future, applied via cards.

## Why this exists

The original boss design forced 0-cost "curse cards" into the player's hand. Those curses only took effect when the player chose to play them, which broke their intended timing — a Throttled curse that was supposed to prevent checks did nothing while it sat in hand. Status effects fix this by firing automatically the moment the trigger condition is met.

## Anatomy

A `StatusEffectDef` lives in `src/game/status/data/<id>.json`:

```json
{
  "id": "throttled",
  "name": "Throttled",
  "description": "When you check the boss, your next chess move must not deliver check.",
  "trigger": { "kind": "on-self-check" },
  "effect": { "kind": "next-move-constraint", "constraint": "must-not-check" },
  "flavor": "curse"
}
```

A live `StatusEffect` instance attached to a match adds runtime metadata (source/target sides, optional lifetime caps, fire bookkeeping) on top of the def reference.

## Trigger taxonomy

| `trigger.kind`         | Fires when…                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `turn-start`           | the **target side**'s turn begins                                          |
| `every-n-turns`        | a target-side turn-start where `(turn - firstOnTurn) % n === 0`            |
| `on-self-capture`      | the target side captured a piece                                           |
| `on-opponent-capture`  | the target side's opponent captured a piece                                |
| `on-self-check`        | the target side put the other king in check                                |
| `on-self-pawn-move`    | the target side moved a pawn (any move; capture or not)                    |

`every-n-turns` defaults `firstOnTurn` to `n` (so n=4 → fires turns 4, 8, 12…). Set `firstOnTurn` explicitly to shift the cycle.

## Effects

A status effect's `effect` field is a regular `CardEffect` from `src/game/types.ts`. The dispatcher passes it straight to the existing handler set in `src/game/cards/effectHandlers.ts`. This means anything a card can do, a status effect can do — and vice versa.

The four boss curses today reuse four existing effect kinds:

| Boss             | Status        | Effect kind                          |
| ---------------- | ------------- | ------------------------------------ |
| The Firewall (A) | `throttled`   | `next-move-constraint: must-not-check` |
| The Whale (B)    | `memory-leak` | `pending-energy-loss-on-no-capture`  |
| The Singularity (C) | `hardened` | `forbid-zero-cost-this-turn`         |
| The Singularity (C) | `bit-rot`  | `capture-random-own-minor`           |

(`echo` → `boss-extra-move` still exists as a status effect but is no longer attached to any boss — Echo was dropped from The Singularity to soften the finale, CH-038.)

## Lifetime fields

Optional fields on a live `StatusEffect`:

- **`expiresOnTurn`** — drop the status when the target's turn counter passes this value. Use for time-bound debuffs.
- **`remainingTriggers`** — drop the status after it fires this many times. Use for one-shots like Hardened (turn-1 only).
- **`oncePerTurn`** — defaults to `true`. The status fires at most once per target-side turn. Set to `false` only for triggers you actively want to spam.

The dispatcher records `lastFiredOnTurn` after each fire, used to enforce `oncePerTurn`.

## Side-symmetry

Each `StatusEffect` carries `source` and `target` sides:

- `source` — who applied the effect (`opponent` for boss curses; `player` for future player-applied debuffs on the enemy).
- `target` — whose events the trigger watches and whose state the effect mutates.

Triggers resolve relative to `target`:
- `on-self-check` matches when `event.by === target`.
- `on-opponent-capture` matches when `event.by !== target`.
- `every-n-turns` measures target-side turns.

The `target` side is forwarded to `applyEffect` as the `side` parameter. Per-piece statuses, zone buffs, and other side-aware handlers write to the correct side's state based on this parameter, so both boss → player and player → enemy status effects are supported.

## Hook points

The status framework needs to be invoked at every match event it can react to. Today's wiring:

| Hook               | Site                                            | Event fired                                       |
| ------------------ | ----------------------------------------------- | ------------------------------------------------- |
| Player turn-start  | `Match.tsx` (turn rollover, first-turn effect)  | `{ turn-start, side: "player", turn }`            |
| Player capture     | `useCardPlay.ts` after move resolution          | `{ capture, by: "player", turn }`                 |
| Player check       | `useCardPlay.ts` after move resolution          | `{ check, by: "player", turn }`                   |
| Player pawn move   | `useCardPlay.ts` after pawn move resolution     | `{ pawn-move, by: "player", turn }`               |
| Opponent capture   | `useAiLoop.ts` after AI capture                 | `{ capture, by: "opponent", turn }`               |

`Match.tsx#applyStatusEffects` is the central callback that fires the dispatcher and pipes any returned side effects through the standard `applyCardSideEffects` helper.

## Adding a new status effect

1. Drop a new JSON file at `src/game/status/data/<id>.json` with the shape shown above.
2. (Optional) reference the new id from a boss in `src/game/bosses/data/<id>.json`'s `statusEffects: [...]` array.
3. The status effect editor in the content designer can author defs end-to-end, including new trigger kinds and effect kinds via the `__designerNew` annotation flow.

If your new trigger kind needs a new event source (e.g. "on-castle"), wire the event firing in the relevant hook (`useCardPlay.ts` / `useAiLoop.ts`) and extend `StatusEvent` in `src/game/status/dispatch.ts` plus the trigger union in `src/game/types.ts`.

## What status effects are NOT

- They are not **piece statuses** (Freeze, Root, Disarm, Compel, Shield, Haste, Lightning, Empower) — those are separately tracked per-piece overlays. We may unify the two systems eventually, but today they are distinct concepts with distinct storage.
- They are not **artifacts** — artifacts are run-scoped and apply globally to every match; status effects are match-scoped and apply to one side of one match.
- They are not **cards** — they don't enter the hand or any pile.
