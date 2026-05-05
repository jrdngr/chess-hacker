# Cards & Energy

The card system is the central self-expression mechanic. Cards augment chess; they don't replace it. This doc specifies the resource system, the play model, the disposal system, and the card-effect taxonomy.

## Hand and deck

- **Hand size:** 5 cards.
- **Draw timing:** at the **start of each player turn**, discard every non-curse, non-retained hand card into the discard pile, then draw until your hand is at 5. (A card played during a turn does not get refilled until the next turn unless an effect explicitly says so.)
- **Run-start deck:** 20 cards — multiples of cheap utilities. See [`../cards/starter-deck.md`](../cards/starter-deck.md) for the composition and rationale.
- **Adding to your deck:** post-match draft (pick 1 of 3) and shop purchases. Booster packs may grant 1+ cards. Capturing an enemy piece during a match grants the matching Soul card directly into your draw pile (see "Card economy" below).
- **Removing from your deck:** shop card-removal service (scaling per use).

## Energy

- Turn 1 starts with **1 energy**. Each subsequent player turn adds **+1 energy**, up to a hard cap of **10**.
- **Unspent energy banks** across turns. The natural ramp is 1 → 2 → 3 → ... → 10; the player can choose to spend or save at every step.
- **Cards cost 0–10 energy.** Most cards cost 0–2; mid cards cost 3–5; haymakers cost 7+.
- **No per-turn cap on cards played** other than the energy budget and hand contents.
- Artifacts and rare cards may grant temporary or permanent extra energy; gains still respect the cap of 10.

Banking is the central tempo mechanic. A typical line is one cheap card per turn, with mid cards every 2–3 turns and a haymaker (e.g. Big Destroy) every 7–10 turns. Saving means *not playing right now* so a future turn can land a single dominant effect.

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
- **Retain** — a card stays in your hand at end-of-turn discards until played. The **Stash** card grants Retain to a chosen card in hand. No card has inherent Retain in the prototype.

Cycle rules:

1. Played cards without Consume go to the **discard pile**.
2. End-of-turn discards every non-curse, non-retained hand card into the discard pile.
3. When the draw pile is empty mid-draw, the discard pile is shuffled to form a new draw pile and drawing continues. The consumed pile never re-enters the cycle.
4. Curses vanish on play (per `bosses.md`); Retain cannot be applied to a curse.

UI piles: **Draw: N | Discard: N | Consumed: N**. The discard pile is the active rotation; the consumed pile is the graveyard.

A 20-card deck cycles through itself multiple times in a typical match, so the binding resource is energy, not card supply. Banking energy for haymakers is still the central tempo lever, and Consume cards remain finite per match — capture-grants-Soul keeps the deck fresh on the way.

## Card economy

A few cards exist explicitly to manage the cycle:

- **Stash** (1 cost) — apply Retain to a card in your hand so it survives end-of-turn until you play it. The standard way to bank a haymaker across turns.
- **Revivers** (Recall, Recover) — pull a card from your discard pile back to your hand (random or chosen). Recover has Consume; Recall does not. Neither can reach into the consumed pile.
- **Capture-grants-Soul** — capturing an enemy non-King piece during a chess move grants the matching Soul card (Pawn → Pawn Soul, Knight → Knight Soul, etc.) into your draw pile. Souls have Consume, so each capture grants exactly one empower trigger.

See the per-archetype docs in `../cards/`:
- [`resource.md`](../cards/resource.md) — draw, scry, Stash.
- [`revival.md`](../cards/revival.md) — Recall, Recover.

## Card archetypes (the design space)

Cards group into a handful of archetypes. The prototype card pool should hit all of them:

1. **Tempo** — extra moves, chained moves, free moves on a piece.
2. **Spatial** — walls, blocked squares, zone-control buffs, "marked" squares with effects.
3. **Movement-extension** — pieces gain extra move types this turn (knight moves diagonally, bishop jumps a piece, pawn moves backward).
4. **Disruption** — freeze enemy piece, force enemy piece to move toward a square, swap two pieces.
5. **Resource / draw** — gain energy, draw cards, discard-and-redraw.
6. **Defensive / setup** — shield a piece (one-time damage immunity from capture), promote a pawn early, ward a square.
7. **Burst / win-condition** — high-cost cards that radically change the board (e.g., "destroy any enemy non-King piece", "your queen makes two moves this turn"). The upper end of the cost range; players bank energy for them.

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
  "id": "frostbite",
  "name": "Frostbite",
  "cost": 2,
  "rarity": "common",
  "archetype": "disruption",
  "description": "Freeze an enemy piece. It can't be moved on the opponent's next turn.",
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
| Starting energy (turn 1)     | 1                                                    |
| Energy gain per turn         | +1 (banks unspent)                                   |
| Energy cap                   | 10                                                   |
| Card cost range              | 0 – 10                                               |
| Cards-per-turn cap           | None beyond energy/hand                              |
| Disposal                     | Discard pile cycles into draw on empty; Consume removes for the match; Retain skips end-of-turn discard |
| Reactions on opponent turn   | None (may revisit)                                   |
| Card upgrades                | Not in prototype                                     |
| Capture-grants-Soul          | Player captures of non-King enemies grant matching Soul (Souls have Consume) |
