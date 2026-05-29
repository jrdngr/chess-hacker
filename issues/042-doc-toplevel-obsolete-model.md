# CH-042: Top-level docs describe an obsolete card/energy/hand model

- **Category:** Game Design — Design Hole
- **Severity:** high
- **Status:** Open

## Locations

- `docs/README.md:64`
- `docs/glossary.md`
- `docs/design/overview.md:43-44`
- `docs/cards/keywords.md:116`
- `docs/design/progression.md`

## Problem

README.md:64, glossary.md, overview.md:43-44, keywords.md:116, progression.md A4 still say hand 5, draw 2 + forced discard, energy 3/turn no-banking, costs 0-4 — while code/cards.md say hand 7, draw 1, voluntary discard, banking with cap 20, costs 0-15. Per CLAUDE.md docs are canonical, so these are drift findings to fix in docs.

## Recommendation

Sweep all top-level docs to the code model (hand 7, draw 1, voluntary discard, energy banking cap 20, costs 0-15).

## Related Issues

- CH-040 — [hole-artifact-slot-cap](040-hole-artifact-slot-cap.md)
- CH-041 — [doc-starter-deck-nonexistent](041-doc-starter-deck-nonexistent.md)

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
