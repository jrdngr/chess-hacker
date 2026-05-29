# CH-033: Performance/feat gold bonuses are documented but never awarded

- **Category:** Game Design — Balance
- **Severity:** high
- **Status:** Open

## Locations

- `src/game/progression/run.ts:184-201`
- `src/game/types.ts:595`
- `docs/design/economy.md`

## Problem

`applyMatchOutcome` adds only flat `WIN_BONUS_NORMAL`/`WIN_BONUS_BOSS`; no feat is computed despite economy.md and types.ts:595. Run income ≈ 110 gold from wins + ≤40 interest, against 12-28-gold artifacts and 5-15-gold cards — deflationary and one-dimensional.

## Recommendation

Implement 2-3 feats from the match summary, or cut them from the doc.

## Proposed Content

Proposed mechanic — Bounty board: stacking match-summary bonuses (+5 queen capture, +4 fast win, +5 no major loss, +3 cards-in-draw-pile), cap ~12.

## Related Issues

- CH-036 — [bal-shop-starves-cards](036-bal-shop-starves-cards.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
