# Cards reference

Per-card reference for Chess Hacker. The mechanics doc is [`docs/design/cards.md`](../design/cards.md); the keyword definitions are [`keywords.md`](keywords.md); this folder is the per-card breakdown grouped by type.

## Layout

- [`keywords.md`](keywords.md) — every effect keyword (Freeze, Root, Disarm, Compel, Shield, Haste, Empower, Downgrade, Wall, Sanctuary, Trap, Consume) with full rules and edge cases.
- [`starter-deck.md`](starter-deck.md) — the cards every fresh run begins with.
- One file per card type:
  - [`tempo.md`](tempo.md) — extra/chained moves
  - [`spatial.md`](spatial.md) — walls, sanctuaries, traps
  - [`movement-extension.md`](movement-extension.md) — additional movement patterns
  - [`disruption.md`](disruption.md) — debuffs on enemy pieces
  - [`resource.md`](resource.md) — scry, deck manipulation
  - [`defensive.md`](defensive.md) — shields and wards
  - [`burst.md`](burst.md) — high-cost, transformative (incl. destroy)
  - [`sacrifice.md`](sacrifice.md) — destroy own piece for an effect
  - [`summon.md`](summon.md) — create new pieces
  - [`swap.md`](swap.md) — non-standard piece movement / displacement
  - [`revival.md`](revival.md) — cards that pull from the discard pile back to hand
  - [`power.md`](power.md) — Slay-the-Spire-style match-scoped passives

## All cards

| Card | Type | Cost | Rarity | Effect summary |
|---|---|---|---|---|
| [Stack Trace](resource.md#foresight) | Resource | 0 | Common | Scry top 3 of deck. |
| [Reinforced Wall](spatial.md#reinforced-wall) | Spatial | 1 | Common | Wall on square, 5 turns. |
| [Side Channel](movement-extension.md#side-channel) | Movement-extension | 1 | Common | **Consume.** **Empower** own pawn w/ 1-sq diagonal step (no capture, this turn). |
| [Lateral Movement](movement-extension.md#lateral-movement) | Movement-extension | 1 | Common | **Consume.** **Empower** own pawn w/ 1-sq horizontal step (no capture, this turn). |
| [Firewall](spatial.md#barricade) | Spatial | 2 | Common | Wall on square, 3 turns. |
| [Honeypot](spatial.md#snare) | Spatial | 2 | Common | Trap (**Freeze**), 3 turns. |
| [Beacon](spatial.md#beacon) | Spatial | 2 | Common | Mark; friendly piece ending there draws 1 each turn, 4 turns. |
| [chroot](disruption.md#tangled-roots) | Disruption | 2 | Common | **Root** enemy piece. |
| [Read-Only](disruption.md#fumble) | Disruption | 2 | Common | **Disarm** enemy piece. |
| [Encrypted](defensive.md#iron-guard) | Defensive | 2 | Common | **Shield** own piece. |
| [Vanguard](movement-extension.md#vanguard) | Movement-extension | 2 | Common | **Haste** own pawn. |
| [Self-Destruct](sacrifice.md#self-destruct) | Sacrifice | 2 | Uncommon | **Consume.** Destroy own piece + all adjacent enemies. |
| [Restore from Backup](revival.md#recover) | Resource | 2 | Uncommon | **Consume.** Choose a discarded card to return to hand. |
| [Backdoor](spatial.md#backdoor) | Spatial | 3 | Uncommon | **Consume.** Place marker; free-action teleport a piece there later. |
| [Repulsor Field](spatial.md#repulsor-field) | Spatial | 3 | Uncommon | Mark; enemy ending there is pushed 1 toward its side, 4 turns. |
| [Hot Swap](tempo.md#hot-swap) | Tempo | 3 | Common | After your move, a different piece takes a **Disarmed** bonus move. |
| [Power Node](spatial.md#standing-stone) | Spatial | 3 | Uncommon | Spawns on random center square; +1 energy/turn near it, 5 turns. |
| [Freeze Process](disruption.md#frostbite) | Disruption | 4 | Common | **Freeze** enemy piece. |
| [Overclock](tempo.md#quickstep) | Tempo | 4 | Common | **Haste** a piece. First move is **Disarmed**. |
| [Phishing](disruption.md#provoke) | Disruption | 4 | Uncommon | **Compel** enemy piece. |
| [Downgrade](disruption.md#downgrade) | Disruption | 4 | Uncommon | **Downgrade** enemy piece for 2 turns. |
| [Trusted Zone](spatial.md#hallowed-ground) | Spatial | 4 | Uncommon | Sanctuary on square, 3 turns. |
| [Switch Files](swap.md#switch-files) | Swap/Displace | 4 | Uncommon | Swap two of your own pieces. |
| [Race Condition](swap.md#race-condition) | Swap/Displace | 4 | Uncommon | Swap two enemy non-King pieces. |
| [Rollback](disruption.md#rollback) | Disruption | 6 | Uncommon | Reverse the opponent's most recent move. |
| [Logic Bomb](spatial.md#spike-pit) | Spatial | 6 | Uncommon | Trap (capture), 4 turns. |
| [Fork](summon.md#fork) | Summon | 6 | Uncommon | Choose a non-King piece; summon a pawn on an adjacent empty square. |
| [Polymorphism](burst.md#polymorphism) | Burst | 6 | Rare | **Consume.** Transform friendly piece one tier up. |
| [Insert Probe](resource.md#insert-probe) | Resource | 6 | Uncommon | **Consume.** Reveal eval bar + best move for 3 turns. |
| [Sudo](tempo.md#sudo) | Tempo | 7 | Rare | **Consume.** Pawn acts as queen for one move this turn; reverts after. |
| [SSH Tunnel](movement-extension.md#ssh-tunnel) | Movement-extension | 7 | Rare | **Consume.** Teleport own piece to any empty square. |
| [Mutex Lock](defensive.md#mutex-lock) | Defensive | 7 | Rare | Lock own piece — 3×3 no-go zone around it for 2 opponent turns. |
| [Extract](swap.md#extract) | Swap/Displace | 7 | Uncommon | Swap one of your pieces with any enemy non-King piece. |
| [Remote Access](swap.md#marionette) | Swap/Displace | 7 | Rare | **Consume.** Move an enemy piece by its legal moves. |
| [Buffer Overflow](sacrifice.md#buffer-overflow) | Sacrifice | 7 | Rare | **Consume.** Destroy own piece; adjacent friendlies each get a free action. |
| [Worm](disruption.md#worm) | Disruption | 7 | Rare | **Consume.** Every 3 turns, **Freeze** a random enemy minor. |
| [Exploit](burst.md#cheap-destroy) | Burst | 8 | Rare | **Consume.** Destroy an attacked enemy non-King piece. |
| [Reinforce](summon.md#reinforce) | Summon | 8 | Rare | Summon a pawn on any empty square in your half. |
| [Git Revert](summon.md#git-revert) | Summon | 8 | Rare | **Consume.** Resurrect a captured/destroyed piece to your half. |
| [Bit Flip](disruption.md#bit-flip) | Disruption | 10 | Rare | **Consume.** Convert enemy minor piece to your side. |
| [Rootkit](disruption.md#rootkit) | Disruption | 10 | Rare | **Consume.** On enemy capture, **Freeze** a random enemy piece. |
| [Garrison Mode](power.md#garrison-mode) | Power | 10 | Rare | **Consume.** Each turn-start, **Shield** your rank-1 pieces (except king). |
| [Format C:](burst.md#big-destroy) | Burst | 12 | Rare | **Consume.** Destroy any enemy non-King piece. |
| [Intrusion Detection](power.md#intrusion-detection) | Power | 12 | Rare | **Consume.** Each turn-start, **Root** enemies that entered your half. |
| [Garbage Collect](burst.md#garbage-collect) | Burst | 15 | Rare | **Consume.** Destroy every enemy non-King piece attacked by your pieces. |

## Counts

- **By Consume:** 20 cards have Consume; the rest cycle through the discard pile.
- **By type:** Resource 3, Disruption 9, Spatial 9, Tempo 3, Movement-extension 4, Defensive 2, Burst 4, Sacrifice 2, Summon 3, Swap 4, Power 2.
- **By cost (0–15):** 1× 0-cost, 3× 1-cost, 8× 2-cost, 5× 3-cost, 7× 4-cost, 0× 5-cost, 5× 6-cost, 7× 7-cost, 3× 8-cost, 3× 10-cost, 2× 12-cost, 1× 15-cost.
