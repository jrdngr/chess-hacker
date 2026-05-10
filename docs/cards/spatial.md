# Spatial cards

Spatial cards paint the board: walls, sanctuaries, traps, and other square-based effects. They change what squares mean.

See [`keywords.md`](keywords.md) for keyword definitions and [`docs/design/board.md`](../design/board.md) for the overlay system.

## Firewall

- **Cost:** 1
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Wall** on an empty square. Lasts 3 turns.
- **Design note:** the workhorse spatial card — cheap, common, and the entry point for understanding wall mechanics. Three turns is enough to seal a key file or block a sliding attack without permanently warping the board.

## Trusted Zone

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** any unwalled square (occupied is fine)
- **Effect:** Place a **Sanctuary** on a square. Pieces standing there can't be captured. Lasts 3 turns.
- **Design note:** defensive answer to forks and pins — park a high-value piece on Sanctuary and the opponent must spend tempo redirecting. Pairs naturally with Encrypted for layered protection of the same piece.

## Logic Bomb

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **captured**. Lasts 4 turns.
- **Design note:** the trap with the strongest single-trigger payoff. Combos with Remote Access to force a high-value enemy piece into the trap. The 4-turn duration matters: this is meant to be a long-armed threat the opponent must navigate around.

## Honeypot

- **Cost:** 1
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **frozen** for 1 turn. Lasts 3 turns.
- **Design note:** the introductory trap card — cheap, low-stakes, teaches the trigger pattern. The freeze it applies is the same Freeze as Freeze Process, so the player learns one effect across two cards.

## Connection Reset

- **Cost:** 1
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **pushed** back 1 square along its movement path. Lasts 3 turns.
- **Design note:** the displacement trap. Useful for fork-prevention and as a low-cost way to break opposing tempo without removing material. Push direction is opposite the piece's movement vector — a knight pushed back lands on its origin square if it's empty.

## Power Node

- **Cost:** 3
- **Rarity:** Uncommon
- **Target:** any unwalled square (occupied is fine)
- **Effect:** Place a **Power Node** on a square. While you have a friendly piece on it or any orthogonally adjacent square, gain +1 energy at the start of your turn. Lasts 4 turns.
- **Design note:** the prototype's first zone-control card. The aura encourages parking a piece near the stone, turning a positional choice into a tempo bonus. The orthogonal-only adjacency keeps it from blanket-buffing a whole castled cluster — you have to hold the line through the stone, not just stand near it. Cost 3 (was 2) reflects how strong a persistent +1/turn is in the no-banking world: it's nearly a half-Power, and 4 turns of contested control on a fresh anchor pays back the upfront 3 energy.
