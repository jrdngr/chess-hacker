# Cards reference

Per-card reference for Chess Hacker. The mechanics doc is [`docs/design/cards.md`](../design/cards.md); the keyword definitions are [`keywords.md`](keywords.md); this folder is the per-card breakdown grouped by type.

## Layout

- [`keywords.md`](keywords.md) — every effect keyword (Freeze, Root, Disarm, Compel, Shield, Haste, Empower, Wall, Sanctuary, Trap, Retain, Consume) with full rules and edge cases.
- [`starter-deck.md`](starter-deck.md) — the 20 cards every fresh run begins with.
- One file per card type:
  - [`tempo.md`](tempo.md) — extra/chained moves
  - [`spatial.md`](spatial.md) — walls, sanctuaries, traps
  - [`movement-extension.md`](movement-extension.md) — additional movement patterns (incl. the Patch family)
  - [`disruption.md`](disruption.md) — debuffs on enemy pieces
  - [`resource.md`](resource.md) — energy, draw, deck manipulation, retain
  - [`defensive.md`](defensive.md) — shields and wards
  - [`burst.md`](burst.md) — high-cost, transformative (incl. destroy)
  - [`sacrifice.md`](sacrifice.md) — destroy own piece for an effect
  - [`summon.md`](summon.md) — create new pieces (currently empty in the prototype)
  - [`swap.md`](swap.md) — non-standard piece movement / displacement
  - [`revival.md`](revival.md) — cards that pull from the discard pile back to hand
  - [`power.md`](power.md) — Slay-the-Spire-style match-scoped passives

## All cards

| Card | Type | Cost | Rarity | Effect summary |
|---|---|---|---|---|
| [Port Scan](resource.md#reconnaissance) | Resource | 1 | Common | Draw 2. |
| [Stack Trace](resource.md#foresight) | Resource | 0 | Common | Scry top 3 of deck. |
| [Bookmark](resource.md#stash) | Resource | 1 | Uncommon | Apply Retain to a card in your hand. |
| [Cache Warmup](resource.md#cache-warmup) | Resource | 1 | Common | +2 energy at the start of your next turn. |
| [Freeze Process](disruption.md#frostbite) | Disruption | 2 | Common | Freeze enemy piece. |
| [chroot](disruption.md#tangled-roots) | Disruption | 1 | Common | Root enemy piece. |
| [Read-Only](disruption.md#fumble) | Disruption | 1 | Common | Disarm enemy piece. |
| [Phishing](disruption.md#provoke) | Disruption | 2 | Uncommon | Compel enemy piece. |
| [Rollback](disruption.md#rollback) | Disruption | 2 | Uncommon | Reverse the opponent's most recent move. |
| [Firewall](spatial.md#barricade) | Spatial | 1 | Common | Wall on square, 3 turns. |
| [Trusted Zone](spatial.md#hallowed-ground) | Spatial | 2 | Uncommon | Sanctuary on square, 3 turns. |
| [Logic Bomb](spatial.md#spike-pit) | Spatial | 2 | Uncommon | Trap (capture), 4 turns. |
| [Honeypot](spatial.md#snare) | Spatial | 1 | Common | Trap (freeze), 3 turns. |
| [Connection Reset](spatial.md#spring-trap) | Spatial | 1 | Common | Trap (push), 3 turns. |
| [Power Node](spatial.md#standing-stone) | Spatial | 3 | Uncommon | Zone-buff: +1 energy/turn near a square, 4 turns. |
| [Overclock](tempo.md#quickstep) | Tempo | 2 | Common | Own piece takes 2 actions (moves and captures). |
| [Encrypted](defensive.md#iron-guard) | Defensive | 1 | Common | Shield own piece. |
| [Exploit](burst.md#cheap-destroy) | Burst | 3 | Rare | **Consume.** Destroy an attacked enemy non-King piece. |
| [Format C:](burst.md#big-destroy) | Burst | 4 | Rare | **Consume.** Destroy any enemy non-King piece. |
| [kill -9](sacrifice.md#martyrs-gift) | Sacrifice | 1 | Uncommon | **Consume.** Destroy own piece; +2 cards, +1 energy. |
| [Pawn Patch](movement-extension.md#pawn-soul) | Movement-extension | 1 | Common | **Consume.** Empower own piece w/ pawn movement (this turn). |
| [Knight Patch](movement-extension.md#knight-patch) | Movement-extension | 2 | Rare | **Consume.** Empower own piece w/ knight L (this turn). |
| [Bishop Patch](movement-extension.md#bishop-patch) | Movement-extension | 2 | Rare | **Consume.** Empower own piece w/ diagonal slide (this turn). |
| [Rook Patch](movement-extension.md#rook-patch) | Movement-extension | 3 | Rare | **Consume.** Empower own piece w/ straight slide (this turn). |
| [Queen Patch](movement-extension.md#queen-patch) | Movement-extension | 4 | Rare | **Consume.** Empower own piece w/ queen movement (this turn). |
| [Sprint](movement-extension.md#sprint) | Movement-extension | 1 | Common | Give Haste to a friendly piece (move twice; first move can't capture). |
| [Vanguard](movement-extension.md#vanguard) | Movement-extension | 1 | Common | Pawn-only Overclock: pawn takes 2 actions this turn. |
| [Blitz](movement-extension.md#blitz) | Movement-extension | 3 | Uncommon | All your pawns gain Haste for 3 turns. |
| [Side Channel](movement-extension.md#side-channel) | Movement-extension | 1 | Common | **Consume.** Empower own pawn w/ 1-sq diagonal step (no capture, this turn). |
| [Lateral Movement](movement-extension.md#lateral-movement) | Movement-extension | 1 | Common | **Consume.** Empower own pawn w/ 1-sq horizontal step (no capture, this turn). |
| [Reinforce](summon.md#reinforce) | Summon | 4 | Rare | Summon a pawn on any empty square in your half. |
| [Switch Files](swap.md#switch-files) | Swap/Displace | 2 | Uncommon | Swap two of your own pieces. |
| [Remote Access](swap.md#marionette) | Swap/Displace | 3 | Rare | **Consume.** Move an enemy piece by its legal moves. |
| [Extract](swap.md#extract) | Swap/Displace | 3 | Uncommon | Swap one of your pieces with any enemy non-King piece. |
| [Restore from Backup](revival.md#recover) | Resource | 1 | Uncommon | **Consume.** Choose a discarded card to return to hand. |
| [Pawn Storm Power](power.md#pawn-storm-power) | Power | 4 | Rare | **Consume.** Each turn-start, your pawns gain Haste until end of turn. |
| [Garrison Mode](power.md#garrison-mode) | Power | 4 | Rare | **Consume.** Each turn-start, your rank-1 pieces (except king) are shielded. |

## Counts

- **By Consume:** 12 cards have Consume; the rest cycle through the discard pile.
- **By type:** Resource 6, Disruption 5, Spatial 6, Tempo 1, Movement-extension 10, Defensive 1, Burst 2, Sacrifice 1, Summon 1, Swap 3, Power 2.
- **By cost (0–4):** 1× 0-cost (Stack Trace), 14× 1-cost, 8× 2-cost, 5× 3-cost, 5× 4-cost.
