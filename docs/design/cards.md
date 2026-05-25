# Cards & Energy

The card system is the central self-expression mechanic. Cards augment chess; they don't replace it. This doc specifies the resource system, the play model, the disposal system, and the card-effect taxonomy.

## Hand and deck

- **Hand size limit:** 7 cards.
- **Starting hand:** 3 cards drawn at match start.
- **Draw timing:** at the **start of each player turn**, draw 2 cards (stopping early if the hand reaches 7).
- **Discard timing:** at the **start of each player turn** (immediately after drawing), the player must discard exactly 1 card from hand. This lets the player curate their hand before acting. Skipped if hand has 0–1 cards after drawing.
- **Cards persist** between turns — unplayed cards stay in hand.
- **Run-start deck:** 10 cards. The pre-game draft flow lets the player either pick one of three pre-made themed decks (Sysadmin, Hackathon, Architect — each 6 commons / 3 uncommons / 1 rare with a bundled artifact) or build a deck from scratch by drafting 1-of-3 ten times (also 6 commons / 3 uncommons / 1 rare) followed by an uncommon-artifact pick. See [`../cards/starter-deck.md`](../cards/starter-deck.md) for the composition of each pre-made deck and the rationale.
- **Adding to your deck:** the shop is the only source of new cards between matches — single-card offers and booster packs (open the pack, pick 1 from its contents).
- **Removing from your deck:** shop card-removal service (scaling per use).

## Energy

Energy is a **persistent pool** that accumulates across turns.

- **Passive income:** +1 energy at the start of each player turn.
- **Capture income:** capturing an enemy piece grants energy equal to its **standard chess piece value** — Pawn = 1, Knight = 3, Bishop = 3, Rook = 5, Queen = 9. Capture energy is granted immediately when the capture resolves.
- **Starting energy:** 0 per match.
- **Energy cap:** 20. Energy cannot exceed 20; excess is lost. This creates spend-before-you-capture pressure — if your pool is nearly full and a big capture is coming, spend down first or waste the energy.
- **Cards cost 0–15 energy.** See the cost tiers below.
- **No per-turn cap on cards played** other than the energy budget and hand contents.
- Artifacts and Power cards may permanently raise the per-turn baseline (e.g. +1 energy/turn for the rest of the match).

### Card cost tiers

| Tier     | Cost  | Role                                                          |
|----------|-------|---------------------------------------------------------------|
| Free     | 0     | Cantrips, small utility                                       |
| Cheap    | 1–3   | Bread and butter, playable on passive income                  |
| Medium   | 4–6   | Requires a couple turns of saving or a minor-piece capture    |
| Expensive| 8–10  | Needs a rook capture or significant banking                   |
| Haymaker | 12–15 | Queen-capture territory. Major commitment.                    |

Tempo spans multiple turns: the player decides when to spend energy and when to bank it. The decision space is rich because chess captures feed the energy pool at variable rates — aggressive play is rewarded with more card-game resources, but only if you have cards worth spending on.

## When can cards be played?

In the prototype, cards are played **on the player's own turn**, before or after their chess move (or as part of the move, for cards that modify the move itself).

- **No card phase:** there is no separate "spell phase" between move-and-end-turn. Cards and the move share a single open phase on your turn; you may interleave them in any order, except that some cards explicitly modify your upcoming move and must be played *before* it.
- **No reactions:** no cards may be played on the opponent's turn in the prototype. (We may revisit this for a future expansion; see `roadmap/open-questions.md`.)
- **No opponent cards:** the AI does not play cards. Bosses apply persistent **status effects** to the player (see `bosses.md` and `status-effects.md`); they do not have a deck.

## Targeting

A card declares one or more **target slots** when played. Common target types:

| Target type      | Examples of cards using it                                            |
|------------------|-----------------------------------------------------------------------|
| Square           | "Place a wall on a chosen square."                                    |
| Piece (own)      | "Choose a knight; this turn it can also move 1 square diagonally."    |
| Piece (enemy)    | "Choose an enemy pawn; freeze it (skip its next move)."               |
| Move overlay     | "This turn, your bishop may pass through one allied piece."           |
| Hand card        | "Discard a card; draw 2."                                             |
| Global / no-target | "Gain +1 energy this turn."                                          |

A card may have multiple targets in sequence (e.g., choose own piece, then choose destination square). When previewing a card, the UI must indicate exactly which legal targets are valid (see `technical/architecture.md`).

## Disposal: discard, consume, cycle

Cards persist in hand between turns. After drawing at the start of each turn, the player must discard 1 card (forced discard) before playing cards or making a chess move. Cards may also be consumed during the turn.

- **Consume** — a played card is removed from the match (lands in the *consumed pile*). It is not eligible for revival.
- **Forced discard** — at the start of every player turn (after drawing), the player must discard exactly 1 card from hand. Skipped if hand has 0–1 cards. This ensures steady deck cycling even with persistent hands.

Cycle rules:

1. Played cards without Consume go to the **discard pile**.
2. Start-of-turn forced discard goes to the discard pile.
3. When the draw pile is empty mid-draw, the discard pile is shuffled to form a new draw pile and drawing continues. The consumed pile never re-enters the cycle.

UI piles: **Draw: N | Discard: N | Consumed: N**. The discard pile is the active rotation; the consumed pile is the graveyard.

With draw 2 per turn, a 10-card deck cycles through itself roughly every 5 turns. Consume cards thin the deck permanently, causing remaining cards to appear more frequently — deck-thinning is a deliberate strategy.

## Card economy

- **Restore from Backup** (cost 2, Consume) — choose a discarded card to return to hand. Useful for retrieving cards lost to forced discards.

See the per-archetype docs in `../cards/`:
- [`resource.md`](../cards/resource.md) — scry, Restore from Backup.

## Card archetypes (the design space)

Cards group into a handful of archetypes. The prototype card pool should hit all of them:

1. **Tempo** — extra moves, chained moves, free moves on a piece.
2. **Spatial** — walls, blocked squares, zone-control buffs, "marked" squares with effects.
3. **Movement-extension** — pieces gain extra move types this turn (pawn moves diagonally, etc.).
4. **Disruption** — freeze enemy piece, force enemy piece to move toward a square, swap two pieces.
5. **Resource** — scry, retrieve from discard.
6. **Defensive / setup** — shield a piece (one-time damage immunity from capture), ward a square.
7. **Burst / win-condition** — high-cost cards that radically change the board (e.g., "destroy any enemy non-King piece"). Sit at the expensive–haymaker tiers (8–15 cost); the player needs major captures or patient saving to reach them.
8. **Power** — Slay-the-Spire-style match-scoped passives. Cost 10–12. Played for keeps: card is consumed and its passive applies for the remainder of the match.

The prototype does not need a final card list; it needs enough cards to populate the starter deck plus reasonable drafts/shops. See `roadmap/milestones.md` for the rough sizing target. The current per-card reference, grouped by type, lives in [`../cards/`](../cards/) — see [`../cards/README.md`](../cards/README.md) for the full list and [`../cards/keywords.md`](../cards/keywords.md) for keyword definitions.

## Card upgrades

Cards **do** have a single canonical upgraded version, Slay-the-Spire style.
Upgrades are obtained exclusively through the **shop Smith service** — there is
no draft, boss-reward, or event-room route in the prototype. See
[`economy.md`](./economy.md) for Smith pricing.

- **One tier:** every card has exactly one `+` variant. No further upgrades —
  Searing-Blow-style infinite scaling is out of scope.
- **Per-slot, not per-card:** upgrading a card swaps the chosen deck slot to
  its `+` variant. Other copies of the same base card in the deck are
  unaffected. If you have two copies of Freeze Process and upgrade one, the
  other stays a base card.
- **Single-source:** `+` variants never appear in shop card offers or booster
  packs — they enter the deck only via the Smith service.

### Authoring

The upgrade for each card is authored inline in the card's JSON as an
optional `upgrade` block listing **only the fields that change** relative to
the base:

```json
{
  "id": "freeze-process",
  "name": "Freeze Process",
  "cost": 4,
  "description": "Freeze enemy piece (no move next turn).",
  "target": { "kind": "enemy-piece" },
  "effect": { "kind": "freeze-piece" },
  "upgrade": {
    "description": "Freeze enemy piece for 2 turns.",
    "effect": { "kind": "freeze-piece", "durationTurns": 2 }
  }
}
```

At startup, the library expansion in `src/game/cards/library.ts` produces a
full `freeze-process+` card from this block and registers it. Override
semantics are **field-level full replacement** — overriding `effect`
replaces the whole effect block (the discriminated union makes partial
merges intractable). `id`, `name`, and `archetype` are NOT author-overridable
— the system derives them as `<id>+`, `<name>+`, and same-archetype.

Every base card MUST define an `upgrade` block; missing entries fail card
library loading at startup. See `cards/README.md` for a quick visual key.

## Boss disruption (status effects, not cards)

Bosses don't have decks. Instead, they apply **status effects** to the player at match start — passive triggers that fire automatically on game events (turn start, on-check, on-capture, etc.) and apply detrimental effects in place. See `bosses.md` and `status-effects.md`.

## Where cards live in the codebase

Card definitions are **human-readable JSON**, one file per card, in
`src/game/cards/data/`. The filename (without extension) must match the card's
`id`. Adding a new card means dropping a new JSON file in that folder — no
code changes are needed; `src/game/cards/library.ts` discovers files via a
glob and validates every card at startup, throwing a clear error message that
points at the offending file if anything is malformed.

Decks compose cards by id. The starter deck lives at
`src/game/cards/decks/starter.json` as a list of `{ id, count }` entries.

A card JSON has the shape:

```json
{
  "id": "freeze-process",
  "name": "Freeze Process",
  "cost": 4,
  "rarity": "common",
  "archetype": "disruption",
  "description": "Freeze enemy piece (no move next turn).",
  "target": { "kind": "enemy-piece" },
  "effect": { "kind": "freeze-piece" }
}
```

The runtime types behind these fields live in `src/game/types.ts`; the
validator in `library.ts` is the canonical list of acceptable `target.kind`
and `effect.kind` values for the prototype.

## Summary numbers (prototype starting values)

| Knob                         | Value                                                |
|------------------------------|------------------------------------------------------|
| Hand size limit              | 7                                                    |
| Starting hand                | 3 cards drawn at match start                         |
| Draw per turn                | 2 cards at start of turn (up to hand limit)          |
| Forced discard               | 1 card at start of turn, after drawing (player's choice; skipped if hand ≤ 1) |
| Card persistence             | Unplayed cards stay in hand between turns             |
| Starting energy              | 0 per match                                          |
| Passive energy               | +1 per turn                                          |
| Capture energy               | +piece value (P=1, N=3, B=3, R=5, Q=9)              |
| Energy cap                   | 20                                                   |
| Energy banking               | Yes — energy persists between turns                  |
| Card cost range              | 0 – 15                                               |
| Cards-per-turn cap           | None beyond energy/hand                              |
| Disposal                     | Discard pile cycles into draw on empty; Consume removes for the match; forced discard 1/turn at start of turn |
| Reactions on opponent turn   | None (may revisit)                                   |
| Card upgrades                | Shop Smith service; one `+` tier per card. See `economy.md`. |
