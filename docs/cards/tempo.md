# Tempo cards

Tempo cards give pieces extra moves, chained moves, or free moves. They generate raw board-action without changing rules or geography.

See [`keywords.md`](keywords.md) for keyword definitions.

## Overclock

- **Cost:** 2
- **Rarity:** Common
- **Target:** own piece
- **Effect:** Target own piece may take **2 actions** this turn (moves and captures).
- **Design note:** the prototype's original "extra-action" card. Captures are allowed on either step — letting Overclock set up a fork and follow through, or capture twice through a thin defensive line.

## Sudo

- **Cost:** 3
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** own pawn
- **Effect:** Target friendly pawn temporarily acts as a queen this turn. It gains queen movement for its next chess move; after that move, it reverts to a pawn. If it reaches the opponent's back rank while acting as a queen, it promotes permanently (standard promotion rules).
- **Upgrade (Sudo+):** Cost 2.
- **Design note:** the fantasy of sudden power elevation — a pawn in a quiet corner suddenly threatens the whole board. The permanent-promotion edge case rewards positioning a pawn one rank from promotion and blasting it through. Consume keeps the effect scarce; the Rare rarity limits draft pool frequency.

## Hot Swap

- **Cost:** 1
- **Rarity:** Common
- **Target:** own non-King piece
- **Effect:** Play before your chess move. After your move resolves, take a bonus move with a **different** friendly piece. The bonus move cannot capture.
- **Upgrade (Hot Swap+):** The bonus move **can** capture.
- **Design note:** cheaper and less explosive than Overclock — two pieces each take one action instead of one piece taking two. The no-capture restriction on the bonus move keeps it as a repositioning tool rather than a second strike; the upgrade lifts that restriction for a kill-shot follow-up. The "different piece" constraint prevents doubling up on the same piece (that's Haste's job).
