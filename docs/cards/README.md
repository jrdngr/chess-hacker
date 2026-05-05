# Cards reference

Per-card reference for choss. The mechanics doc is [`docs/design/cards.md`](../design/cards.md); the keyword definitions are [`keywords.md`](keywords.md); this folder is the per-card breakdown grouped by type.

## Layout

- [`keywords.md`](keywords.md) — every effect keyword (Freeze, Root, Disarm, Compel, Shield, Haste, Empower, Wall, Sanctuary, Trap, Retain, Consume) with full rules and edge cases.
- [`starter-deck.md`](starter-deck.md) — the 20 cards every fresh run begins with.
- One file per card type:
  - [`tempo.md`](tempo.md) — extra/chained moves
  - [`spatial.md`](spatial.md) — walls, sanctuaries, traps
  - [`movement-extension.md`](movement-extension.md) — additional movement patterns (incl. the Soul family)
  - [`disruption.md`](disruption.md) — debuffs on enemy pieces
  - [`resource.md`](resource.md) — energy, draw, deck manipulation, retain
  - [`defensive.md`](defensive.md) — shields and wards
  - [`burst.md`](burst.md) — high-cost, transformative (incl. destroy)
  - [`sacrifice.md`](sacrifice.md) — destroy own piece for an effect
  - [`summon.md`](summon.md) — create new pieces (currently empty in the prototype)
  - [`swap.md`](swap.md) — non-standard piece movement / displacement
  - [`revival.md`](revival.md) — cards that pull from the discard pile back to hand

## All cards

24 cards total (see [`design/cards.md`](../design/cards.md) for the cycling rules and the Retain/Consume keywords).

| Card | Type | Cost | Rarity | Effect summary |
|---|---|---|---|---|
| [Reconnaissance](resource.md#reconnaissance) | Resource | 2 | Common | Draw 2. |
| [Foresight](resource.md#foresight) | Resource | 1 | Common | Scry top 3 of deck. |
| [Stash](resource.md#stash) | Resource | 1 | Uncommon | Apply Retain to a card in your hand. |
| [Frostbite](disruption.md#frostbite) | Disruption | 2 | Common | Freeze enemy piece. |
| [Tangled Roots](disruption.md#tangled-roots) | Disruption | 1 | Common | Root enemy piece. |
| [Fumble](disruption.md#fumble) | Disruption | 1 | Common | Disarm enemy piece. |
| [Provoke](disruption.md#provoke) | Disruption | 2 | Uncommon | Compel enemy piece. |
| [Barricade](spatial.md#barricade) | Spatial | 1 | Common | Wall on square, 3 turns. |
| [Hallowed Ground](spatial.md#hallowed-ground) | Spatial | 2 | Uncommon | Sanctuary on square, 3 turns. |
| [Spike Pit](spatial.md#spike-pit) | Spatial | 2 | Uncommon | Trap (capture), 4 turns. |
| [Snare](spatial.md#snare) | Spatial | 1 | Common | Trap (freeze), 3 turns. |
| [Spring Trap](spatial.md#spring-trap) | Spatial | 1 | Common | Trap (push), 3 turns. |
| [Standing Stone](spatial.md#standing-stone) | Spatial | 2 | Uncommon | Zone-buff: +1 energy/turn near a square, 4 turns. |
| [Quickstep](tempo.md#quickstep) | Tempo | 2 | Common | Own piece takes 2 actions (moves and captures). |
| [Iron Guard](defensive.md#iron-guard) | Defensive | 1 | Common | Shield own piece. |
| [Cheap Destroy](burst.md#cheap-destroy) | Burst | 4 | Rare | **Consume.** Destroy an attacked enemy non-King piece. |
| [Big Destroy](burst.md#big-destroy) | Burst | 10 | Rare | **Consume.** Destroy any enemy non-King piece. |
| [Martyr's Gift](sacrifice.md#martyrs-gift) | Sacrifice | 1 | Uncommon | **Consume.** Destroy own piece; +2 cards, +1 energy. |
| [Pawn Soul](movement-extension.md#pawn-soul) | Movement-extension | 1 | Common | **Consume.** Empower own piece w/ pawn movement (this turn). |
| [Knight Soul](movement-extension.md#knight-soul) | Movement-extension | 3 | Rare | **Consume.** Empower own piece w/ knight L (this turn). |
| [Bishop Soul](movement-extension.md#bishop-soul) | Movement-extension | 3 | Rare | **Consume.** Empower own piece w/ diagonal slide (this turn). |
| [Rook Soul](movement-extension.md#rook-soul) | Movement-extension | 4 | Rare | **Consume.** Empower own piece w/ straight slide (this turn). |
| [Queen Soul](movement-extension.md#queen-soul) | Movement-extension | 5 | Rare | **Consume.** Empower own piece w/ queen movement (this turn). |
| [Switch Files](swap.md#switch-files) | Swap/Displace | 2 | Uncommon | Swap two of your own pieces. |
| [Marionette](swap.md#marionette) | Swap/Displace | 5 | Rare | **Consume.** Move an enemy piece by its legal moves. |
| [Vine Pull](swap.md#vine-pull) | Swap/Displace | 2 | Uncommon | Swap one of your pieces with a rooted enemy. |
| [Recall](revival.md#recall) | Resource | 1 | Common | Return a random discarded card to hand. |
| [Recover](revival.md#recover) | Resource | 4 | Uncommon | **Consume.** Choose a discarded card to return to hand. |

## Counts

- **By rarity:** 14 Common, 7 Uncommon, 6 Rare.
- **By Consume:** 10 cards have Consume; the remaining 17 cycle through the discard pile.
- **By type:** Resource 6, Disruption 4, Spatial 6, Tempo 1, Movement-extension 5, Defensive 1, Burst 2, Sacrifice 1, Summon 0, Swap 3.
- **By cost (0–10):** 0× 0-cost, 11× 1-cost, 9× 2-cost, 2× 3-cost, 2× 4-cost, 2× 5-cost, 0× 6–9-cost, 1× 10-cost.
