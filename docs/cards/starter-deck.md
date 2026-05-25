# Starter Decks & Pre-Game Draft

Every run starts with a 10-card deck plus one starting artifact. The player chooses how to assemble that deck on the **Draft** screen at the top of the run:

1. Pick one of three **pre-made themed decks** (each 10 cards: 6 commons, 3 uncommons, 1 rare, plus a bundled artifact); or
2. **Draft from scratch** — pick 1 of 3 cards over 10 rounds (6 common rounds, then 3 uncommon rounds, then 1 rare round), then pick 1 of 3 uncommon artifacts.

Each pre-made deck has a "view cards" button so players can inspect contents before committing. The dev sandbox still loads a separate 12-card starter for free-play; that's the legacy starter and is unrelated to the pre-game flow.

## Pre-made decks

### Sysadmin — disruption + control
Lock down enemy tempo, deny the opponent's plans, sweep with a clean exploit at the end. **Bundled artifact:** Sysadmin Token (uncommon — disruption cards cost 1 less).

| Count | Card | Rarity | Notes |
|---|---|---|---|
| 1 | chroot | Common | Sandbox an enemy piece. |
| 1 | Read-Only | Common | Set enemy to move-only. |
| 1 | Freeze Process | Common | Skip enemy's next move. |
| 1 | Encrypted | Common | Captures illegal until next turn. |
| 1 | Port Scan | Common | Draw 2 cards. |
| 1 | Stack Trace | Common | Scry top 3 of deck. |
| 1 | Phishing | Uncommon | Compel enemy piece to move. |
| 1 | Rollback | Uncommon | Undo opponent's last move. |
| 1 | Bookmark | Uncommon | Apply Retain to a hand card. |
| 1 | Exploit | Rare | Destroy an attacked enemy non-King. |

### Hackathon — mobility + pawns
Move twice, push forward, ship the pawn rush before the opponent can react. **Bundled artifact:** Build Pipeline (uncommon — movement cards cost 1 less).

| Count | Card | Rarity | Notes |
|---|---|---|---|
| 2 | Overclock | Common | **Haste** a piece. First move is **Disarmed**. |
| 2 | Vanguard | Common | **Haste** own pawn. |
| 1 | Hot Swap | Common | **Disarmed** bonus move with a different piece. |
| 1 | Side Channel | Common | Pawn steps 1 sq diagonally (no capture). |
| 1 | Lateral Movement | Common | Pawn steps 1 sq horizontally. |
| 1 | Switch Files | Uncommon | Swap two of your own pieces. |
| 1 | Fork | Uncommon | Summon pawn adjacent to a piece. |
| 1 | Polymorphism | Rare | Transform a piece one tier up. |

### Architect — spatial + zone control
Turn squares into structure: walls, traps, sanctuaries, garrison. **Bundled artifact:** Map Editor (uncommon — spatial cards cost 1 less).

| Count | Card | Rarity | Notes |
|---|---|---|---|
| 1 | Firewall | Common | Wall on empty square (3 turns). |
| 1 | Honeypot | Common | Freeze trap (3 turns). |
| 1 | Reinforced Wall | Common | Wall on empty square (5 turns). |
| 1 | Cache Warmup | Common | +2 energy on the next turn. |
| 1 | Encrypted | Common | Captures illegal until next turn. |
| 1 | Stack Trace | Common | Scry top 3 of deck. |
| 1 | Power Node | Uncommon | Zone-buff: +1 energy/turn while controlled. |
| 1 | Logic Bomb | Uncommon | Capture trap (4 turns). |
| 1 | Trusted Zone | Uncommon | Sanctuary square — pieces can't be captured. |
| 1 | Garrison Mode | Rare | Power: rank-1 pieces gain Shield each turn. |

### Botnet — summon + sacrifice
Spawn disposable pieces, trade them for explosive value, overwhelm. **Bundled artifact:** Promotion Engine (uncommon — pawns promote at rank 7 instead of rank 8).

| Count | Card | Rarity | Notes |
|---|---|---|---|
| 1 | Port Scan | Common | Draw 2 cards. |
| 1 | Stack Trace | Common | Scry top 3 of deck. |
| 1 | Cache Warmup | Common | +2 energy on the next turn. |
| 2 | Overclock | Common | **Haste** a piece. First move is **Disarmed**. |
| 1 | Vanguard | Common | **Haste** own pawn. |
| 1 | Fork | Uncommon | Summon pawn adjacent to a non-King piece. |
| 1 | kill -9 | Uncommon | Sacrifice a piece for draw + energy. |
| 1 | Self-Destruct | Uncommon | Sacrifice a piece; destroy adjacent enemies. |
| 1 | Buffer Overflow | Rare | Sacrifice a piece; adjacent friendlies act free. |

### Pentester — resource + burst
Probe, accumulate, wait for the opening — then annihilate. **Bundled artifact:** Foothold (uncommon — hand size +1 while you have a piece on a center square).

| Count | Card | Rarity | Notes |
|---|---|---|---|
| 1 | Port Scan | Common | Draw 2 cards. |
| 1 | Stack Trace | Common | Scry top 3 of deck. |
| 1 | Cache Warmup | Common | +2 energy on the next turn. |
| 1 | Encrypted | Common | Captures illegal until next turn. |
| 1 | Hot Swap | Common | Bonus move with a different piece (no capture). |
| 1 | Connection Reset | Common | Push trap (3 turns). |
| 1 | Heartbleed | Uncommon | +1 energy per capture this match. |
| 1 | Bookmark | Uncommon | Apply Retain to a hand card. |
| 1 | Extract | Uncommon | Swap your piece with an enemy non-King. |
| 1 | Format C: | Rare | Destroy any enemy non-King piece. |

## Drafting from scratch

If the player picks **Draft new deck**, they build a deck via repeated 1-of-3 picks:

- Rounds 1–6: 3 random distinct **common** cards. Pick 1.
- Rounds 7–9: 3 random distinct **uncommon** cards. Pick 1.
- Round 10: 3 random distinct **rare** cards. Pick 1.
- Final pick: 3 random distinct **uncommon** artifacts. Pick 1.

Cards already drafted may show up again in later rounds — multiples in the deck enable repeats per `../design/cards.md`. The animation language matches the in-match Hand: cards deal in fanned (staggered) and the picked card rises to fade away while rejects glide off-screen.

## Rationale

- **Identity at run-start.** Every run begins with a clear strategic shape (control, aggro, structure, swarm, combo) instead of the same 12-card grab-bag. The pre-made decks teach the archetypes; the draft path lets a confident player roll their own.
- **Power floor.** Both paths come with a starting artifact, so the run never opens artifact-empty. Pre-made decks ship a thematically aligned uncommon; the draft path ends in an uncommon-artifact pick from the full pool.
- **No Cache Warmup or Bookmark in the curated decks (mostly).** Cache Warmup ships only with Architect (where +2-energy-next-turn buys a Garrison Mode setup turn) and Bookmark only with Sysadmin (banking Exploit across turns). The other decks are deliberately a touch pinched on tempo/banking so the shop's first purchase still matters.
- **Patches come from captures, not the deck.** Capture-grants-Patch keeps every starting deck refreshing organically during play.

## Future shape

The current pool is small enough that drafting can repeat options across rounds. As the card library grows, this is fine — it's the same trade-off as Slay the Spire's starting decks (some redundancy, lots of variety). Adding more rares is the highest-leverage expansion next, since round 10 currently picks from a 10-card pool.
