# Cards & Energy

The card system is the central self-expression mechanic. Cards augment chess; they don't replace it. This doc specifies the resource system, the play model, the disposal system, and the card-effect taxonomy.

## Hand and deck

- **Hand size:** 5 cards.
- **Draw timing:** at the **start of each player turn**, draw until your hand is at 5. (A card played during a turn does not get refilled until the next turn unless an effect explicitly says so.)
- **Run-start deck:** 20 cards — multiples of cheap utilities + four common empty-deck-mitigation cards. See [`../cards/starter-deck.md`](../cards/starter-deck.md) for the composition and rationale.
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

## Disposal: every card consumes

**Universal rule:** when a card is played, it is removed for the rest of the match. There is no discard pile. There is no reshuffle. Multiples in the deck are how the player gets repeatable effects.

- **No `consume` flag on cards** — it would be redundant. Every card consumes.
- **No reshuffle.** When the draw pile empties, draws fizzle. The match continues card-free — the player still has chess to play.
- **Pile UI labels:** "Spent: N" replaces "Discard: N". The deck count is also visible so the player can see how much card supply remains.

The thematic reading: the spells run out, you finish with steel. Combined with banking energy, every play is a deliberate, finite use of two scarce resources (energy budget + card supply). A 20-card deck means roughly 20 plays over a match, so each play matters.

Empty-deck mitigation (the "Card economy" section below) softens the cliff: generators create cards, revivers pull cards back from the spent pile, self-replicators keep a copy of themselves rotating, and capture-grants-Soul lets every captured enemy piece feed your deck.

## Card economy

Card-supply tools so a careful player can extend the match's card phase well past 20 plays:

- **Generators** (Improvise, Trick Bag, Mark Target) create new cards in your hand: a random common, three "shiv" tokens, or a specific synergy follow-up.
- **Revivers** (Recall, Recover) pull a card from your spent pile back to your hand — random or chosen.
- **Self-replicators** (Pace, Hum, Drift) shuffle a copy of themselves into your draw pile when played, so each one stays in rotation.
- **Capture-grants-Soul.** Capturing an enemy non-King piece during a chess move grants the matching Soul card (Pawn → Pawn Soul, Knight → Knight Soul, etc.) into your draw pile. King is never captured (game ends); all other enemy types map.

See the per-archetype docs in `../cards/`:
- [`generators.md`](../cards/generators.md) — Improvise, Trick Bag, Mark Target, Vine Pull, the Shiv pool.
- [`revival.md`](../cards/revival.md) — Recall, Recover.
- [`self-replicators.md`](../cards/self-replicators.md) — Pace, Hum, Drift.

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
| Draw timing                  | Refill to 5 at start of player turn                  |
| Starting energy (turn 1)     | 1                                                    |
| Energy gain per turn         | +1 (banks unspent)                                   |
| Energy cap                   | 10                                                   |
| Card cost range              | 0 – 10                                               |
| Cards-per-turn cap           | None beyond energy/hand                              |
| Disposal                     | Every card consumes; no reshuffle                    |
| Reactions on opponent turn   | None (may revisit)                                   |
| Card upgrades                | Not in prototype                                     |
| Capture-grants-Soul          | Player captures of non-King enemies grant matching Soul |
