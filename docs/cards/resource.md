# Resource cards

Resource cards generate energy, draw cards, or manipulate the deck. They don't act on the board directly — they fuel everything else.

See [`keywords.md`](keywords.md) for keyword definitions.

## Port Scan

- **Cost:** 2
- **Rarity:** Common
- **Target:** none
- **Effect:** Draw 2 cards.
- **Design note:** the workhorse draw card. Net +1 card in hand for 2 energy. With cycling the drawn cards may be ones you've already played this match — the strength is acceleration through your deck, not pure card advantage. Two copies in the starter so the player almost always has draw available.

## Stack Trace

- **Cost:** 1
- **Rarity:** Common
- **Target:** none
- **Effect:** Look at the top 3 cards of your deck; put them back in any order.
- **Design note:** doesn't draw — *fixes* what you'll draw. With cycling, scrying lets you push haymakers down the pile until you can pay for them. Not in the starter (held for drafts/shop) because its value depends on the player understanding what's in their deck.

## Bookmark

- **Cost:** 1
- **Rarity:** Uncommon
- **Target:** another card in your hand
- **Effect:** Apply **Retain** to the chosen card. It stays in your hand at end-of-turn discards until you play it.
- **Design note:** the cycling-deck banking enabler. Energy banks naturally; cards do not — by default a haymaker drawn early discards if you can't afford it. Bookmark lets you dock a Format C: or Queen Patch in your hand for as long as it takes to bank the energy. Cannot target curses (they must be played to leave hand) or already-retained slots.

  Implementation: hand entries carry a per-instance `retained` flag (see `MatchCardState.hand` in `src/game/types.ts`). The flag survives end-of-turn discards but is dropped when the card is played.
