# Defensive cards

Defensive cards protect your own pieces — shields, wards, immunity — without changing geography or producing tempo.

See [`keywords.md`](keywords.md) for keyword definitions.

## Encrypted

- **Cost:** 1
- **Rarity:** Common
- **Target:** own piece
- **Effect:** Target own piece: **Shield** until the start of your next turn.
- **Design note:** the introductory Shield card. The opponent simply cannot include any move that captures the shielded piece in their next turn — no destruction of the attacker, no counterplay; the move is just illegal. Cheap and safe; pairs naturally with Trusted Zone for layered protection.

## Mutex Lock

- **Cost:** 3
- **Rarity:** Rare
- **Target:** own piece
- **Effect:** Lock the targeted piece. For each of your opponent's next 2 turns, enemy pieces cannot move to the locked piece's square or any king-step-adjacent square (a 3×3 zone centered on the locked piece). The zone re-snapshots at the end of each of your turns — it follows the locked piece if you move it. If the locked piece is destroyed (captured, sacrificed via kill -9 / Buffer Overflow, swapped off the board by Extract / Race Condition), the lock fizzles immediately.
- **Upgrade (Mutex Lock+):** Duration extends to 3 opponent turns. Same cost.
- **Design note:** A rolling no-go zone, distinct from Shield (which only blocks captures of one piece) and Sanctuary (which is a static square overlay). Mutex Lock blocks *every* enemy move into the 3×3 — captures and non-captures both. Sliding pieces may still slide *through* a zone square; only the destination is gated. The fizzle clause makes the lock vulnerable to player misplays (sacrificing the anchor) but not to opponent counterplay (the zone already prevents captures of the anchor). Stacks with other Mutex Locks on different pieces — zones union additively.
