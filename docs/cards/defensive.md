# Defensive cards

Defensive cards protect your own pieces — shields, wards, immunity — without changing geography or producing tempo.

See [`keywords.md`](keywords.md) for keyword definitions.

## Encrypted

- **Cost:** 2
- **Rarity:** Common
- **Target:** own piece
- **Effect:** Target own piece: **Shield** until the start of your next turn.
- **Design note:** the introductory Shield card. The opponent simply cannot include any move that captures the shielded piece in their next turn — no destruction of the attacker, no counterplay; the move is just illegal. Cheap and safe; pairs naturally with Trusted Zone for layered protection.

## Watchdog Timer

- **Cost:** 3
- **Rarity:** Uncommon
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** **Shield** every one of your pieces until the start of your next turn. While shielded, none of your pieces can be captured — so the opponent makes no captures this turn.
- **Upgrade (Watchdog Timer+):** The shields last 2 turns instead of 1.
- **Design note:** a pre-armed defensive ward (CH-059) and a panic button against an aggressive boss line — arm it on your turn and the opponent's next turn cannot trade off your material. Because it reuses the Shield keyword, the protection is enforced by move generation (capturing a shielded piece is simply illegal), not a live reaction. Consume keeps it scarce; cost 3 makes it a real tempo investment rather than a reflexive answer. A board-wide, one-turn counterpart to Encrypted's single-piece shield and Garrison Mode's recurring back-rank shield.

## Mutex Lock

- **Cost:** 7
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Lock the targeted piece. For each of your opponent's next 2 turns, enemy pieces cannot move to the locked piece's square or any king-step-adjacent square (a 3×3 zone centered on the locked piece). The zone re-snapshots at the end of each of your turns — it follows the locked piece if you move it. If the locked piece is destroyed (captured, sacrificed via Buffer Overflow, swapped off the board by Extract / Race Condition), the lock fizzles immediately.
- **Upgrade (Mutex Lock+):** Duration extends to 3 opponent turns. Same cost.
- **Design note:** A rolling no-go zone, distinct from Shield (which only blocks captures of one piece) and Sanctuary (which is a static square overlay). Mutex Lock blocks *every* enemy move into the 3×3 — captures and non-captures both. Sliding pieces may still slide *through* a zone square; only the destination is gated. The fizzle clause makes the lock vulnerable to player misplays (sacrificing the anchor) but not to opponent counterplay (the zone already prevents captures of the anchor). Stacks with other Mutex Locks on different pieces — zones union additively.
