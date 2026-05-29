# CH-060: Author the cards referenced by starter-deck.md that don't exist

- **Category:** Game Design — Content
- **Severity:** medium
- **Status:** Open

## Locations

- `docs/cards/starter-deck.md`
- `src/game/cards/data/`

## Problem

starter-deck.md references Port Scan, Cache Warmup, Heartbleed, Bookmark, kill -9, Connection Reset, none of which have data files. All map to existing effect kinds, so this is JSON authoring only (the alternative is to rewrite the docs — see [[doc-starter-deck-nonexistent]]).

## Recommendation

Author the JSON for each card using existing effect kinds: Port Scan (draw 2); Cache Warmup (pending-energy-next-turn); Heartbleed (gain-energy-per-capture); Bookmark (apply-retain); kill -9 (sacrifice-detonate variant); Connection Reset (place-trap).

## Related Issues

- CH-041 — [doc-starter-deck-nonexistent](041-doc-starter-deck-nonexistent.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
