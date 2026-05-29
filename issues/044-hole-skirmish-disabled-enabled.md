# CH-044: Skirmish is marked disabled in docs but enabled in code

- **Category:** Game Design — Design Hole
- **Severity:** medium
- **Status:** Open

## Locations

- `src/components/ModeSelect.tsx:14-30`
- `docs/design/modes.md:3,59`

## Problem

Docs say Skirmish is disabled but ModeSelect.tsx:14-30 enables it; modes.md line 3 vs line 59 self-contradict.

## Recommendation

Decide whether Skirmish ships enabled, then make modes.md internally consistent and matching the code.

---

_Source: `docs/reviews/2026-05-29-comprehensive-review.md`_
