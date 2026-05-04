# Cards reference

Per-card reference for choss. The mechanics doc is [`docs/design/cards.md`](../design/cards.md); the keyword definitions are [`keywords.md`](keywords.md); this folder is the per-card breakdown grouped by type.

## Layout

- [`keywords.md`](keywords.md) — every effect keyword (Freeze, Root, Disarm, Compel, Shield, Haste, Empower, Wall, Sanctuary, Trap, Generator, Revive, Self-replicating) with full rules and edge cases.
- [`starter-deck.md`](starter-deck.md) — the 20 cards every fresh run begins with.
- One file per card type:
  - [`tempo.md`](tempo.md) — extra/chained moves
  - [`spatial.md`](spatial.md) — walls, sanctuaries, traps
  - [`movement-extension.md`](movement-extension.md) — additional movement patterns (incl. the Soul family)
  - [`disruption.md`](disruption.md) — debuffs on enemy pieces
  - [`resource.md`](resource.md) — energy, draw, deck manipulation
  - [`defensive.md`](defensive.md) — shields and wards
  - [`burst.md`](burst.md) — high-cost, transformative (incl. destroy)
  - [`sacrifice.md`](sacrifice.md) — destroy own piece for an effect
  - [`summon.md`](summon.md) — create new pieces (currently empty in the prototype)
  - [`swap.md`](swap.md) — non-standard piece movement / displacement
  - [`generators.md`](generators.md) — cards that create cards
  - [`revival.md`](revival.md) — cards that pull from the spent pile back to hand
  - [`self-replicators.md`](self-replicators.md) — cards that put a fresh copy of themselves in the draw pile

## All cards

36 cards total (23 pre-existing + 2 destroy + 9 mitigation + 3 shiv tokens, less the merged Lightning Strike).

| Card | Type | Cost | Rarity | Effect summary |
|---|---|---|---|---|
| [Reconnaissance](resource.md#reconnaissance) | Resource | 1 | Common | Draw 2. |
| [Foresight](resource.md#foresight) | Resource | 0 | Common | Scry top 3 of deck. |
| [Frostbite](disruption.md#frostbite) | Disruption | 2 | Common | Freeze enemy piece. |
| [Tangled Roots](disruption.md#tangled-roots) | Disruption | 1 | Common | Root enemy piece. |
| [Fumble](disruption.md#fumble) | Disruption | 1 | Common | Disarm enemy piece. |
| [Provoke](disruption.md#provoke) | Disruption | 2 | Uncommon | Compel enemy piece. |
| [Barricade](spatial.md#barricade) | Spatial | 1 | Common | Wall on square, 3 turns. |
| [Hallowed Ground](spatial.md#hallowed-ground) | Spatial | 2 | Uncommon | Sanctuary on square, 3 turns. |
| [Spike Pit](spatial.md#spike-pit) | Spatial | 2 | Uncommon | Trap (capture), 4 turns. |
| [Snare](spatial.md#snare) | Spatial | 1 | Common | Trap (freeze), 3 turns. |
| [Spring Trap](spatial.md#spring-trap) | Spatial | 1 | Common | Trap (push), 3 turns. |
| [Quickstep](tempo.md#quickstep) | Tempo | 2 | Common | Own piece takes 2 actions (moves and captures). |
| [Crooked Path](movement-extension.md#crooked-path) | Movement-extension | 2 | Common | Empower own piece w/ knight L (this turn). |
| [Iron Guard](defensive.md#iron-guard) | Defensive | 1 | Common | Shield own piece. |
| [Cheap Destroy](burst.md#cheap-destroy) | Burst | 4 | Rare | Destroy enemy non-King piece your forces are attacking. |
| [Big Destroy](burst.md#big-destroy) | Burst | 10 | Rare | Destroy any enemy non-King piece. Draft-pool only. |
| [Martyr's Gift](sacrifice.md#martyrs-gift) | Sacrifice | 1 | Uncommon | Destroy own piece; +2 cards, +1 energy. |
| [Pawn Soul](movement-extension.md#pawn-soul) | Movement-extension | 1 | Common | Empower own piece w/ pawn movement (this turn, single-use). |
| [Knight Soul](movement-extension.md#knight-soul) | Movement-extension | 3 | Rare | Empower own piece w/ knight L (this turn, single-use). |
| [Bishop Soul](movement-extension.md#bishop-soul) | Movement-extension | 3 | Rare | Empower own piece w/ diagonal slide (this turn, single-use). |
| [Rook Soul](movement-extension.md#rook-soul) | Movement-extension | 4 | Rare | Empower own piece w/ straight slide (this turn, single-use). |
| [Queen Soul](movement-extension.md#queen-soul) | Movement-extension | 5 | Rare | Empower own piece w/ queen movement (this turn, single-use). |
| [Switch Files](swap.md#switch-files) | Swap/Displace | 2 | Uncommon | Swap two of your own pieces. |
| [Marionette](swap.md#marionette) | Swap/Displace | 5 | Rare | Move an enemy piece by its legal moves. |
| [Improvise](generators.md#improvise) | Resource | 1 | Common | Add a random common card to your hand. |
| [Trick Bag](generators.md#trick-bag) | Resource | 2 | Uncommon | Add three shiv-pool cards to your hand. |
| [Mark Target](generators.md#mark-target) | Disruption | 2 | Uncommon | Root enemy non-King for 2 turns; add Vine Pull to hand. |
| [Vine Pull](generators.md#vine-pull) | Swap/Displace | 2 | Uncommon | Swap one of your pieces with a rooted enemy. |
| [Recall](revival.md#recall) | Resource | 1 | Common | Return a random spent card to hand. |
| [Recover](revival.md#recover) | Resource | 4 | Uncommon | Choose a spent card to return to hand. |
| [Pace](self-replicators.md#pace) | Resource | 1 | Common | Scry 1; shuffle a copy of Pace into draw. |
| [Hum](self-replicators.md#hum) | Resource | 1 | Common | Draw 1; shuffle a copy of Hum into draw. |
| [Drift](self-replicators.md#drift) | Spatial | 1 | Uncommon | Wall a square for 1 turn; shuffle a copy of Drift into draw. |
| [Shiv: Strike](generators.md#shiv-pool) | Resource | 1 | Common | Gain 1 energy. Shiv-pool only. |
| [Shiv: Step](generators.md#shiv-pool) | Resource | 1 | Common | Draw 1. Shiv-pool only. |
| [Shiv: Snag](generators.md#shiv-pool) | Disruption | 1 | Common | Disarm an enemy piece. Shiv-pool only. |

## Counts

- **By rarity:** 23 Common, 7 Uncommon, 6 Rare.
- **By type:** Resource 11, Disruption 6, Spatial 6, Tempo 1, Movement-extension 6, Defensive 1, Burst 2, Sacrifice 1, Summon 0, Swap 3.
- **By cost (0–10):** 1× 0-cost, 22× 1-cost, 9× 2-cost, 2× 3-cost, 2× 4-cost, 1× 5-cost, 0× 6-cost, 0× 7-cost, 0× 8/9-cost, 1× 10-cost.

Note: shiv-pool tokens (`shiv-strike`, `shiv-step`, `shiv-snag`) are data-only and only enter play via Trick Bag. They do not appear in the starter deck or draft pool.
