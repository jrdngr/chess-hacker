# Cards reference

Per-card reference for choss. The mechanics doc is [`docs/design/cards.md`](../design/cards.md); the keyword definitions are [`keywords.md`](keywords.md); this folder is the per-card breakdown grouped by type.

## Layout

- [`keywords.md`](keywords.md) — every effect keyword (Freeze, Root, Disarm, Compel, Shield, Haste, Empower, Wall, Sanctuary, Trap, Cycle, Consume) with full rules and edge cases.
- [`starter-deck.md`](starter-deck.md) — the 10 cards every fresh run begins with.
- One file per card type:
  - [`tempo.md`](tempo.md) — extra/chained moves
  - [`spatial.md`](spatial.md) — walls, sanctuaries, traps
  - [`movement-extension.md`](movement-extension.md) — additional movement patterns
  - [`disruption.md`](disruption.md) — debuffs on enemy pieces
  - [`resource.md`](resource.md) — energy, draw, deck manipulation
  - [`defensive.md`](defensive.md) — shields and wards
  - [`burst.md`](burst.md) — high-cost, transformative
  - [`sacrifice.md`](sacrifice.md) — destroy own piece for an effect
  - [`summon.md`](summon.md) — create new pieces
  - [`swap.md`](swap.md) — non-standard piece movement / displacement

## All cards

19 cards total: 3 carried over plus 16 new this pass.

| Card | Type | Cost | Rarity | Effect summary |
|---|---|---|---|---|
| [Reconnaissance](resource.md#reconnaissance) | Resource | 1 | Common | Draw 2. |
| [Foresight](resource.md#foresight) | Resource | 0 | Common | Scry top 3 of deck. |
| [Frostbite](disruption.md#frostbite) | Disruption | 2 | Common | Freeze enemy piece. |
| [Frozen Roots](disruption.md#frozen-roots) | Disruption | 1 | Common | Root enemy piece. |
| [Fumble](disruption.md#fumble) | Disruption | 1 | Common | Disarm enemy piece. |
| [Provoke](disruption.md#provoke) | Disruption | 2 | Uncommon | Compel enemy piece. |
| [Barricade](spatial.md#barricade) | Spatial | 1 | Common | Wall on square, 3 turns. |
| [Hallowed Ground](spatial.md#hallowed-ground) | Spatial | 2 | Uncommon | Sanctuary on square, 3 turns. |
| [Spike Pit](spatial.md#spike-pit) | Spatial | 2 | Uncommon | Trap (capture), 4 turns. |
| [Snare](spatial.md#snare) | Spatial | 1 | Common | Trap (freeze), 3 turns. |
| [Spring Trap](spatial.md#spring-trap) | Spatial | 1 | Common | Trap (push), 3 turns. |
| [Quickstep](tempo.md#quickstep) | Tempo | 2 | Common | Haste on own piece. |
| [Crooked Path](movement-extension.md#crooked-path) | Movement-extension | 1 | Common | Empower own piece w/ knight L. |
| [Iron Guard](defensive.md#iron-guard) | Defensive | 1 | Common | Shield own piece. |
| [Lightning Strike](burst.md#lightning-strike) | Burst | 4 | Rare | Own piece takes 2 actions. Consume. |
| [Martyr's Gift](sacrifice.md#martyrs-gift) | Sacrifice | 1 | Uncommon | Destroy own piece; +2 cards, +1 energy. |
| [Conjure Knight](summon.md#conjure-knight) | Summon | 3 | Rare | Summon a knight in own half. Consume. |
| [Switch Files](swap.md#switch-files) | Swap/Displace | 2 | Uncommon | Swap two of your own pieces. |
| [Marionette](swap.md#marionette) | Swap/Displace | 3 | Rare | Move an enemy piece by its legal moves. Consume. |

## Counts

- **By rarity:** 11 Common, 5 Uncommon, 3 Rare.
- **By type:** Resource 2, Disruption 4, Spatial 5, Tempo 1, Movement-extension 1, Defensive 1, Burst 1, Sacrifice 1, Summon 1, Swap 2.
- **By cost:** 1× 0-cost, 9× 1-cost, 7× 2-cost, 2× 3-cost, 1× 4-cost.
