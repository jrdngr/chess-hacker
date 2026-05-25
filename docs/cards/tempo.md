# Tempo cards

Tempo cards give pieces extra moves, chained moves, or free moves. They generate raw board-action without changing rules or geography.

See [`keywords.md`](keywords.md) for keyword definitions, especially **Haste** and **Disarm**.

## Overclock

- **Cost:** 4
- **Rarity:** Common
- **Target:** own piece
- **Effect:** **Haste** a piece. First move is **Disarmed** (can reposition but not capture; second move may capture).
- **Upgrade (Overclock+):** **Haste** a piece (Disarm removed — both moves may capture).
- **Design note:** the core "extra-action" card. The base version applies Haste with Disarm on the first move, forcing a reposition-then-strike pattern. The upgrade removes the Disarm restriction, letting the piece capture on either move. Vanguard is the pawn-only variant at lower cost.

## Sudo

- **Cost:** 7
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** own pawn
- **Effect:** Target friendly pawn temporarily acts as a queen this turn. It gains queen movement for its next chess move; after that move, it reverts to a pawn. If it reaches the opponent's back rank while acting as a queen, it promotes permanently (standard promotion rules).
- **Upgrade (Sudo+):** Cost 2.
- **Design note:** the fantasy of sudden power elevation — a pawn in a quiet corner suddenly threatens the whole board. The permanent-promotion edge case rewards positioning a pawn one rank from promotion and blasting it through. Consume keeps the effect scarce; the Rare rarity limits draft pool frequency.

## Hot Swap

- **Cost:** 3
- **Rarity:** Common
- **Target:** own non-King piece
- **Effect:** Play before your chess move. After your move resolves, take a bonus move with a **different** friendly piece. The bonus move is **Disarmed** (no capture).
- **Upgrade (Hot Swap+):** The bonus move is no longer **Disarmed** — it **can** capture.
- **Design note:** cheaper and less explosive than Overclock — two pieces each take one action instead of one piece taking two. The Disarm on the bonus move keeps it as a repositioning tool rather than a second strike; the upgrade lifts that restriction for a kill-shot follow-up. The "different piece" constraint prevents doubling up on the same piece (that's Haste's job).
