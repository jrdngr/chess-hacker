# Spatial cards

Spatial cards paint the board: walls, sanctuaries, traps, and other square-based effects. They change what squares mean.

See [`keywords.md`](keywords.md) for keyword definitions and [`docs/design/board.md`](../design/board.md) for the overlay system.

## Firewall

- **Cost:** 2
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Wall** on an empty square. Lasts 3 turns.
- **Design note:** the workhorse spatial card — cheap, common, and the entry point for understanding wall mechanics. Three turns is enough to seal a key file or block a sliding attack without permanently warping the board.

## Trusted Zone

- **Cost:** 4
- **Rarity:** Uncommon
- **Target:** any unwalled square (occupied is fine)
- **Effect:** Place a **Sanctuary** on a square. Pieces standing there can't be captured. Lasts 3 turns.
- **Design note:** defensive answer to forks and pins — park a high-value piece on Sanctuary and the opponent must spend tempo redirecting. Pairs naturally with Encrypted for layered protection of the same piece.

## Logic Bomb

- **Cost:** 6
- **Rarity:** Uncommon
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **captured**. Lasts 4 turns.
- **Design note:** the trap with the strongest single-trigger payoff. Combos with Remote Access to force a high-value enemy piece into the trap. The 4-turn duration matters: this is meant to be a long-armed threat the opponent must navigate around.

## Honeypot

- **Cost:** 2
- **Rarity:** Common
- **Target:** empty square
- **Effect:** Place a **Trap** on an empty square. The first enemy piece to enter is **frozen** for 1 turn. Lasts 3 turns.
- **Design note:** the introductory trap card — cheap, low-stakes, teaches the trigger pattern. The freeze it applies is the same Freeze as Freeze Process, so the player learns one effect across two cards.

## Power Node

- **Cost:** 3
- **Rarity:** Uncommon
- **Target:** none (placed automatically)
- **Effect:** A **Power Node** spawns on a random square in the center of the board (center 4×4 on an 8×8 board, scaled proportionally for smaller boards). While you have a friendly piece on it or any orthogonally adjacent square, gain +1 energy at the start of your turn. Lasts 5 turns.
- **Design note:** the prototype's first zone-control card. The random center placement creates a tactical scramble — both players must evaluate whether it's worth contesting. The aura encourages pushing a piece to the center, turning a positional choice into a tempo bonus. Cost 3 is speculative: you might not control the center, so the payoff is uncertain. Over 5 turns, the maximum return is +5 energy — a good deal if you maintain board control.

## Backdoor

- **Cost:** 3
- **Rarity:** Uncommon
- **Keywords:** **Consume**
- **Target:** empty square
- **Effect:** Place a **Backdoor** marker on the target square. The marker persists indefinitely and is visible to both players. On any future turn, as a free action (no card or energy cost), teleport any friendly non-King piece to the marked square. The marker is consumed on use. Enemy pieces can move through and onto the square freely — it is not a wall or trap.
- **Upgrade (Backdoor+):** Place markers on **2** squares (each usable once).
- **Design note:** a delayed spatial setup that rewards planning ahead. Place it early behind enemy lines; activate it later to teleport a piece into a surprise attack position. The free-action activation means it doesn't compete with your card plays on the turn you use it. Consume prevents repeat marker spam — each copy in the deck is one backdoor. The marker being visible gives the opponent counterplay: they can park a piece on the square to block the teleport (the target square must be empty when activated).
