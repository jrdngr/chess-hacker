# Cards & Energy

The card system is the central self-expression mechanic. Cards augment chess; they don't replace it. This doc specifies the resource system, the play model, the disposal system, and the card-effect taxonomy.

## Hand and deck

- **Hand size:** 5 cards.
- **Draw timing:** at the **start of each player turn**, discard every non-curse, non-retained hand card into the discard pile, then draw until your hand is at 5. (A card played during a turn does not get refilled until the next turn unless an effect explicitly says so.)
- **Run-start deck:** 20 cards — multiples of cheap utilities. See [`../cards/starter-deck.md`](../cards/starter-deck.md) for the composition and rationale.
- **Adding to your deck:** post-match draft (pick 1 of 3) and shop purchases. Booster packs may grant 1+ cards. Capturing an enemy piece during a match grants the matching Patch card directly into your draw pile (see "Card economy" below).
- **Removing from your deck:** shop card-removal service (scaling per use).

## Energy

- Every player turn starts with **3 energy**. Energy does **not** bank — unspent energy is wiped at end-of-turn alongside the discarded hand.
- **Cards cost 0–4 energy.** 0 cost = tone-setting cantrips (e.g. Stack Trace); 1–2 = bread-and-butter utility; 3 = strong cards; 4 = haymakers (the cap).
- **No per-turn cap on cards played** other than the energy budget and hand contents.
- Artifacts and Power cards may permanently raise the per-turn baseline (e.g. Daemon Process gives +1/turn for the rest of the match; the boss-reward "+1 energy/turn" boon does the same for the rest of the run).
- **Cache Warmup** (cost 1, +2 energy on the next turn) is the deliberate way to break the 3-energy ceiling on a future turn — the only "save up" tool in a no-banking world.

Tempo is per-turn rather than across-turn: the player decides each turn how to spend exactly 3 energy. The decision space stays interesting because card costs span 0–4, so on any given turn you might play four 0-cost cantrips, one cost-3 strong card, two cost-1+cost-2, or hold a slot open for a 4-cost haymaker (Cache Warmup setup or Power).

## When can cards be played?

In the prototype, cards are played **on the player's own turn**, before or after their chess move (or as part of the move, for cards that modify the move itself).

- **No card phase:** there is no separate "spell phase" between move-and-end-turn. Cards and the move share a single open phase on your turn; you may interleave them in any order, except that some cards explicitly modify your upcoming move and must be played *before* it.
- **No reactions:** no cards may be played on the opponent's turn in the prototype. (We may revisit this for a future expansion; see `roadmap/open-questions.md`.)
- **No opponent cards:** the AI does not play cards. Boss "curse cards" (see `bosses.md`) appear in the *player's* hand, not as an opponent deck.

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

## Disposal: discard, consume, retain, cycle

The hand is wiped at the end of every player turn and a fresh hand is drawn at the start of the next turn. Two keywords carve out exceptions to this default:

- **Consume** — a played card is removed from the match (lands in the *consumed pile*). It is not eligible for revival.
- **Retain** — a card stays in your hand at end-of-turn discards until played. The **Bookmark** card grants Retain to a chosen card in hand. No card has inherent Retain in the prototype.

Cycle rules:

1. Played cards without Consume go to the **discard pile**.
2. End-of-turn discards every non-curse, non-retained hand card into the discard pile.
3. When the draw pile is empty mid-draw, the discard pile is shuffled to form a new draw pile and drawing continues. The consumed pile never re-enters the cycle.
4. Curses vanish on play (per `bosses.md`); Retain cannot be applied to a curse.

UI piles: **Draw: N | Discard: N | Consumed: N**. The discard pile is the active rotation; the consumed pile is the graveyard.

A 20-card deck cycles through itself multiple times in a typical match, so the binding resource is energy, not card supply. Banking energy for haymakers is still the central tempo lever, and Consume cards remain finite per match — capture-grants-Patch keeps the deck fresh on the way.

## Card economy

A few cards exist explicitly to manage the cycle:

- **Bookmark** (1 cost) — apply Retain to a card in your hand so it survives end-of-turn until you play it. The standard way to bank a haymaker across turns.
- **Revivers** (Restore Point, Restore from Backup) — pull a card from your discard pile back to your hand (random or chosen). Restore from Backup has Consume; Restore Point does not. Neither can reach into the consumed pile.
- **Capture-grants-Patch** — capturing an enemy non-King piece during a chess move grants the matching Patch card (Pawn → Pawn Patch, Knight → Knight Patch, etc.) into your draw pile. Patches have Consume, so each capture grants exactly one empower trigger.

See the per-archetype docs in `../cards/`:
- [`resource.md`](../cards/resource.md) — draw, scry, Bookmark.
- [`revival.md`](../cards/revival.md) — Restore Point, Restore from Backup.

## Card archetypes (the design space)

Cards group into a handful of archetypes. The prototype card pool should hit all of them:

1. **Tempo** — extra moves, chained moves, free moves on a piece.
2. **Spatial** — walls, blocked squares, zone-control buffs, "marked" squares with effects.
3. **Movement-extension** — pieces gain extra move types this turn (knight moves diagonally, bishop jumps a piece, pawn moves backward).
4. **Disruption** — freeze enemy piece, force enemy piece to move toward a square, swap two pieces.
5. **Resource / draw** — gain energy, draw cards, discard-and-redraw.
6. **Defensive / setup** — shield a piece (one-time damage immunity from capture), promote a pawn early, ward a square.
7. **Burst / win-condition** — high-cost cards that radically change the board (e.g., "destroy any enemy non-King piece", "your queen makes two moves this turn"). Sit at the cost cap (4); the player either pre-plays a Cache Warmup the prior turn or commits the full per-turn budget to a single card.
8. **Power** — Slay-the-Spire-style match-scoped passives. Cost 4. Played for keeps: card is consumed and its passive (+1 energy/turn, +1 draw/turn, +1 chess move/turn) applies for the remainder of the match.

The prototype does not need a final card list; it needs enough cards to populate the starter deck plus reasonable drafts/shops. See `roadmap/milestones.md` for the rough sizing target. The current per-card reference, grouped by type, lives in [`../cards/`](../cards/) — see [`../cards/README.md`](../cards/README.md) for the full list and [`../cards/keywords.md`](../cards/keywords.md) for keyword definitions.

## Card upgrades

Cards do **not** have upgraded versions in the prototype. Card upgrade as a shop service was considered and explicitly cut to keep the design tight. (Card removal is the only deck-shaping shop service.)

Reconsider this decision only after the basic loop is working — adding upgrade is a meaningful design and UI undertaking. See `roadmap/open-questions.md`.

## Curse cards (bosses only)

Some bosses can place **curse cards** into the player's hand mid-match. Curse cards have detrimental effects and must be played to be removed from hand. They cost 0 energy, do not count against the hand size cap, and do not enter the player's deck (they vanish when played and do not return). See `bosses.md` for boss curse-card specifics.

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
  "cost": 2,
  "rarity": "common",
  "archetype": "disruption",
  "description": "Halt an enemy process. It can't be moved on the opponent's next turn.",
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
| Hand size                    | 5                                                    |
| Draw timing                  | Discard hand at end of turn; redraw to 5 at start of next turn |
| Starting energy (every turn) | 3                                                    |
| Energy banking               | None — unspent energy is wiped at end of turn        |
| Energy cap                   | None (Power cards / Cache Warmup can drive a single turn well past the baseline) |
| Card cost range              | 0 – 4                                                |
| Cards-per-turn cap           | None beyond energy/hand                              |
| Disposal                     | Discard pile cycles into draw on empty; Consume removes for the match; Retain skips end-of-turn discard |
| Reactions on opponent turn   | None (may revisit)                                   |
| Card upgrades                | Not in prototype                                     |
| Capture-grants-Patch          | Player captures of non-King enemies grant matching Patch (Patches have Consume) |
