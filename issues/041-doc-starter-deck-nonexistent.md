# CH-041: starter-deck.md documents cards and decks that don't exist

- **Category:** Game Design — Design Hole
- **Severity:** high
- **Status:** Open

## Locations

- `docs/cards/starter-deck.md`
- `src/game/cards/data/decks/named/`
- `docs/design/cards.md:12`

## Problem

Port Scan, Bookmark, Cache Warmup, Connection Reset, Heartbleed, kill -9 have no data files; the doc decks don't match decks/named/\*.json; cards.md:12 says 3 decks while code ships 5.

## Recommendation

Either author the missing cards (most map onto existing effect kinds — JSON only) and rewrite the deck JSON, or rewrite the docs to match the 5 shipped decks. See content issue [[content-author-missing-starter-cards]].

## Related Issues

- CH-060 — [content-author-missing-starter-cards](060-content-author-missing-starter-cards.md)
- CH-042 — [doc-toplevel-obsolete-model](042-doc-toplevel-obsolete-model.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
