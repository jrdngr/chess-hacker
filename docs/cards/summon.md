# Summon cards

Summon cards create new pieces on empty squares. They expand your army mid-match instead of moving what you already have.

See [`keywords.md`](keywords.md) for keyword definitions and [`docs/design/pieces.md`](../design/pieces.md) for piece behavior.

## Conjure Knight

- **Cost:** 3
- **Rarity:** Rare
- **Target:** empty square in your own half (ranks 1–4)
- **Effect:** Summon a knight on the chosen empty square. **Consume.**
- **Design note:** a flexible material-injection card. The half-board restriction prevents drops directly onto the opponent's back rank — the summoned knight has to march. In Skirmish, the summoned knight does *not* enter the persistent roster (it lives only for this match), keeping piece-draft economy intact. Consume so it doesn't loop into infinite knights.
