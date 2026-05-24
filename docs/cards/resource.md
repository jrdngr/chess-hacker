# Resource cards

Resource cards manipulate the deck or provide information. They don't act on the board directly — they support everything else.

See [`keywords.md`](keywords.md) for keyword definitions.

## Stack Trace

- **Cost:** 0
- **Rarity:** Common
- **Target:** none
- **Effect:** Look at the top 3 cards of your deck; put them back in any order.
- **Design note:** A 0-cost cantrip — pure information, no board effect. Sets the deck-shaping tone of the run. Doesn't draw, *fixes* what you'll draw. With cycling, scrying lets you push your strongest cards toward the top of the next cycle.

## Insert Probe

- **Cost:** 6
- **Rarity:** Uncommon
- **Target:** none
- **Keywords:** Consume
- **Effect:** Reveal the engine's eval bar and best move arrow for 3 turns.
- **Upgrade (Insert Probe+):** Lasts 5 turns.
- **Design note:** pure information card — doesn't alter the board, but gives the player Stockfish-grade analysis for a limited window. Cost 6 + Consume ensures it's a deliberate investment. The eval bar shows the position score; the best-move arrow highlights the engine's recommended move. Both update reactively if the board changes (walls placed, pieces moved by other cards). If the dev panel's "Show Eval Bar" and "Show Best Move" toggles are both already on, the card still consumes but adds no additional effect.
