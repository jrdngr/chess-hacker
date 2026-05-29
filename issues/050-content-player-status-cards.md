# CH-050: No cards apply player→enemy status effects (whole system unused)

- **Category:** Game Design — Content
- **Severity:** high
- **Status:** Open

## Locations

- `docs/design/status-effects.md`
- `src/game/status/`

## Problem

0 cards apply player-side status effects despite a fully built side-symmetric system. All 5 statuses are boss→player only, so a whole built system is dead content.

## Recommendation

Author cards that apply Freeze/Root/Disarm/etc. to enemy pieces.

## Proposed Content

Proposed cards — Worm (Cost 7 Rare: every 3 turns freeze a random enemy minor); Rootkit (Cost 10 Rare: on enemy capture, opponent loses 1 energy next turn). Both reuse existing trigger + effect plumbing.

## Related Issues

- CH-054 — [content-keyword-payoffs](054-content-keyword-payoffs.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
