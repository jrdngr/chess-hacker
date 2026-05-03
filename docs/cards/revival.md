# Revival

Cards that return one of your **spent** cards (already played, sitting in the spent pile) back to your hand. Under consume-all every played card otherwise stays gone for the rest of the match — revival is the only way to replay a previously-used card.

## Recall

- **Cost:** 1 energy
- **Rarity:** Common
- **Type:** Resource
- **Target:** None
- **Effect:** Return a **random** card from your spent pile to your hand. No-op if the spent pile is empty.

The cheap, blind revive. Best after a long sequence of plays — the more you've spent, the richer the pool to draw from.

## Recover

- **Cost:** 4 energy
- **Rarity:** Uncommon
- **Type:** Resource
- **Target:** None (UI prompt for choice)
- **Effect:** A modal opens showing every card in your spent pile; pick one to return to your hand.

Targeted revival. The energy cost reflects the precision: you're effectively *re-buying* a card you've already paid for once.

## Why they exist

Revival keeps the highest-leverage plays from being one-shots. If your deck has a Lightning Strike (cost 7) and you've already cashed it, Recover at cost 4 plus another 7 banking turns can bring it back for a second swing — an 11-energy total but with an entire match between the two casts. Random revival via Recall is cheaper but riskier; chosen revival via Recover is the deliberate counterpunch.

Mechanically, the spent card moves from `consumedPile` back to `hand`. It's the same card instance — no copies are generated.
