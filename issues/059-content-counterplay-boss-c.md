# CH-059: No counterplay vs Boss C dead-ends / draw=loss / uninteractive Echo

- **Category:** Game Design — Content
- **Severity:** medium
- **Status:** Open

## Locations

- `src/game/bosses/data/the-singularity.json`
- `docs/design/chess-rules.md:91`
- `docs/roadmap/open-questions.md:9`

## Problem

Players have no tools to counter Boss C's draw=loss dead-ends or its uninteractive Echo extra-move.

## Recommendation

Add rare counterplay cards that give the player an out.

## Proposed Content

Proposed cards — Kernel Panic (Cost 12 Rare Consume Burst: if you'd lose to a draw rule / no mate path, win instead — uses the chess-rules.md:91 match-end override); Watchdog Timer (Cost 3 Uncommon Consume: arms on your turn; cancels the next enemy capture this opponent-turn — pre-armed trigger, not a live reaction).

## Related Issues

- CH-045 — [hole-boss-c-forced-loss](045-hole-boss-c-forced-loss.md)
- CH-049 — [hole-no-reactions-echo](049-hole-no-reactions-echo.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
