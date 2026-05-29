# CH-038: Lower-severity balance items (doc drift, Boss C cliff, interest cap)

- **Category:** Game Design — Balance
- **Severity:** low
- **Status:** Open

## Locations

- `src/game/cards/data/exploit.json`
- `src/game/bosses/library.ts`
- `src/game/shop/shop.ts:39-41`

## Problem

(a) Doc/code drift: starter deck size (10 vs "12"/11 actual), Exploit cost (doc "cost-3" vs exploit.json cost 8), artifact pool (doc 12 vs 14 files), starter-deck.md references non-existent Port Scan/Bookmark. (b) Boss C stacks no-promotion + center void + Hardened + Echo + Bit Rot — a likely difficulty cliff, compounded by the flat AI. (c) Interest cap (25 gold → +5) is unreachable in early acts given tight income.

## Recommendation

Reconcile the doc numbers with code; re-evaluate Boss C's stacked modifiers once AI scaling lands; revisit the interest breakpoint against realistic income.

## Related Issues

- CH-041 — [doc-starter-deck-nonexistent](041-doc-starter-deck-nonexistent.md)
- CH-045 — [hole-boss-c-forced-loss](045-hole-boss-c-forced-loss.md)
- CH-031 — [bal-ai-difficulty-flat](031-bal-ai-difficulty-flat.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
