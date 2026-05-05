# Spatial cards

Spatial cards paint the board: walls, sanctuaries, traps, and other square-based effects. They change what squares mean.

See [`keywords.md`](keywords.md) for keyword definitions and [`docs/design/board.md`](../design/board.md) for the overlay system.

## Barricade

- **Cost:** 1
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Wall** on an empty square. Lasts 3 turns.
- **Design note:** the workhorse spatial card — cheap, common, and the entry point for understanding wall mechanics. Three turns is enough to seal a key file or block a sliding attack without permanently warping the board.

## Hallowed Ground

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** empty square
- **Effect:** Place a **Sanctuary** on an empty square. Lasts 3 turns.
- **Design note:** defensive answer to forks and pins — park a high-value piece on Sanctuary and the opponent must spend tempo redirecting. Pairs naturally with Iron Guard for layered protection of the same piece.

## Spike Pit

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **captured**. Lasts 4 turns.
- **Design note:** the trap with the strongest single-trigger payoff. Combos with Marionette to force a high-value enemy piece into the trap. The 4-turn duration matters: this is meant to be a long-armed threat the opponent must navigate around.

## Snare

- **Cost:** 1
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **frozen** for 1 turn. Lasts 3 turns.
- **Design note:** the introductory trap card — cheap, low-stakes, teaches the trigger pattern. The freeze it applies is the same Freeze as Frostbite, so the player learns one effect across two cards.

## Spring Trap

- **Cost:** 1
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **pushed** back 1 square along its movement path. Lasts 3 turns.
- **Design note:** the displacement trap. Useful for fork-prevention and as a low-cost way to break opposing tempo without removing material. Push direction is opposite the piece's movement vector — a knight pushed back lands on its origin square if it's empty.

## Standing Stone

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** empty square
- **Effect:** Place a **Standing Stone** on an empty square. While you have a friendly piece on it or any orthogonally adjacent square, gain +1 energy at the start of your turn. Lasts 4 turns.
- **Design note:** the prototype's first zone-control card. The aura encourages parking a piece near the stone, turning a positional choice into a tempo bonus. The orthogonal-only adjacency keeps it from blanket-buffing a whole castled cluster — you have to hold the line through the stone, not just stand near it.
