# Cards & Energy

The card system is the central self-expression mechanic. Cards augment chess; they don't replace it. This doc specifies the resource system, the play model, the disposal system, and the card-effect taxonomy.

## Hand and deck

- **Hand size:** 5 cards.
- **Draw timing:** at the **start of each player turn**, draw until your hand is at 5. (A card played during a turn does not get refilled until the next turn unless an effect explicitly says so.)
- **Run-start deck:** the prototype currently starts with one of every card in the library (19 cards). See [`../cards/starter-deck.md`](../cards/starter-deck.md) for the composition and rationale; this will narrow once drafts and the shop start contributing copies.
- **Adding to your deck:** post-match draft (pick 1 of 3) and shop purchases. Booster packs may grant 1+ cards.
- **Removing from your deck:** shop card-removal service (scaling per use).

## Energy

- Each turn the player begins with **3 energy**.
- **Cards cost 0–4 energy.** Most cards cost 0–2; rare/powerful cards cost 3–4.
- **Unspent energy disappears at end of turn** — it does not bank or carry over.
- **No per-turn cap on cards played** other than the energy budget and hand contents.
- Artifacts and rare cards may grant temporary or permanent extra energy. (Energy ramp is a recognized build axis.)

A starting turn budget of 3 lets the player play one premium card, two mid-cost cards, three cheap cards, or any combination. The cap of 4 on individual cards means a player must save energy or scale energy via artifacts to play the most powerful single cards.

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

## Disposal: cycle vs consume

Most cards **cycle**: when played, they go to a discard pile. When the deck runs out, the discard reshuffles into the deck. This means a card you bought in act 1 will be drawn many times across the run.

Some cards **consume**: when played, they are removed from the deck for the rest of the match (or the rest of the run, for a small subset). Consume cards are typically more powerful for their cost — they trade reusability for raw effect.

- **Default disposal:** cycle.
- **Consume keyword:** appears on cards that are consumed. The keyword is visible at all times on the card.
- **Match-consume vs run-consume:** most consumes are match-only (return at the start of the next match); run-consume is rare and reserved for specific game-changing cards.

Reshuffle policy: when the player needs to draw and the draw pile is empty, the discard pile is shuffled into a new draw pile *immediately and silently*. There is no penalty for reshuffling.

## Card archetypes (the design space)

Cards group into a handful of archetypes. The prototype card pool should hit all of them:

1. **Tempo** — extra moves, chained moves, free moves on a piece.
2. **Spatial** — walls, blocked squares, zone-control buffs, "marked" squares with effects.
3. **Movement-extension** — pieces gain extra move types this turn (knight moves diagonally, bishop jumps a piece, pawn moves backward).
4. **Disruption** — freeze enemy piece, force enemy piece to move toward a square, swap two pieces.
5. **Resource / draw** — gain energy, draw cards, discard-and-redraw.
6. **Defensive / setup** — shield a piece (one-time damage immunity from capture), promote a pawn early, ward a square.
7. **Burst / win-condition** — high-cost cards that radically change the board (e.g., "summon a knight on a chosen empty square", "your queen makes two moves this turn"). Often consume.

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
  "consume": false,
  "description": "Freeze an enemy piece. It can't be moved on the opponent's next turn.",
  "target": { "kind": "enemy-piece" },
  "effect": { "kind": "freeze-piece" }
}
```

The runtime types behind these fields live in `src/game/types.ts`; the
validator in `library.ts` is the canonical list of acceptable `target.kind`
and `effect.kind` values for the prototype.

## Summary numbers (prototype starting values)

| Knob                         | Value                                      |
|------------------------------|--------------------------------------------|
| Hand size                    | 5                                          |
| Draw timing                  | Refill to 5 at start of player turn        |
| Energy per turn              | 3                                          |
| Energy carryover             | None (resets each turn)                    |
| Card cost range              | 0 – 4                                      |
| Cards-per-turn cap           | None beyond energy/hand                    |
| Default disposal             | Cycle                                      |
| Reshuffle penalty            | None                                       |
| Reactions on opponent turn   | None (may revisit)                         |
| Card upgrades                | Not in prototype                           |
