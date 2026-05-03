# Summon cards

Summon cards create new pieces on empty squares. They expand your army mid-match instead of moving what you already have.

See [`keywords.md`](keywords.md) for keyword definitions and [`docs/design/pieces.md`](../design/pieces.md) for piece behavior.

## Conjure Pawn

- **Cost:** 1
- **Rarity:** Common
- **Target:** empty square in your own half (ranks 1–4)
- **Effect:** Summon a pawn on the chosen empty square. **Consume.**
- **Design note:** the cheap end of the summon family — a body on the board for one energy. Useful for blocking a check, plugging a hole in your pawn structure, or just feeding a Martyr's Gift later in the match.

## Conjure Knight

- **Cost:** 3
- **Rarity:** Rare
- **Target:** empty square in your own half (ranks 1–4)
- **Effect:** Summon a knight on the chosen empty square. **Consume.**
- **Design note:** a flexible material-injection card. The half-board restriction prevents drops directly onto the opponent's back rank — the summoned knight has to march. In Skirmish, the summoned knight does *not* enter the persistent roster (it lives only for this match), keeping piece-draft economy intact. Consume so it doesn't loop into infinite knights.

## Conjure Bishop

- **Cost:** 3
- **Rarity:** Rare
- **Target:** empty square in your own half (ranks 1–4)
- **Effect:** Summon a bishop on the chosen empty square. **Consume.**
- **Design note:** the long-diagonal answer to the knight's L-shape. Drop a fianchettoed bishop into a key diagonal mid-game; same half-board restriction keeps it from teleporting straight into the enemy camp.

## Conjure Rook

- **Cost:** 4
- **Rarity:** Rare
- **Target:** empty square in your own half (ranks 1–4)
- **Effect:** Summon a rook on the chosen empty square. **Consume.**
- **Design note:** the heaviest summon. A full rook on an open file is enormous tempo — the 4-cost and consume are deliberate so it stays a once-per-match swing card.
