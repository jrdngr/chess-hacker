# Chess Hacker — Issue Tracker

Issues derived from the comprehensive review in `docs/reviews/2026-05-29-comprehensive-review.md`. Each issue has a dedicated file in `issues/`.

**Working instructions for the agent:** Work issues **one at a time**. Open the linked file for full context (locations, problem, recommendation, related issues). After completing an issue, run the pre-commit checks in `CLAUDE.md` (`npm run format`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`), then commit with `jj commit`. As part of that commit, delete the resolved issue entirely: remove its row here and delete its file under `issues/`. Prefer the recommended ordering below (severity-first within each section).

**Total open issues:** 11

_The Code — Correctness, Tests — Coverage, Tests — Validity (CH-001…024), Refactor — Duplication (CH-025…030), Game Design — Balance (CH-031…038), and Game Design — Content (CH-050…060) sections are all resolved and have been removed from this index. Only the Game Design — Design Hole section remains open._

Legend: 🔴 critical · 🟠 high · 🟡 medium · 🔵 low · ⚪ nit

## Game Design — Design Hole

| #      | Sev | Issue                                                                                                                   | Status |
| ------ | --- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| CH-039 | 🟠  | ["+1 Draw" boss boon is wired to hand-size, not draw-per-turn](issues/039-hole-draw-boon-wrong-effect.md)               | Open   |
| CH-040 | 🟠  | [Artifact slot cap is 20 in code but 5 in most docs](issues/040-hole-artifact-slot-cap.md)                              | Open   |
| CH-041 | 🟠  | [starter-deck.md documents cards and decks that don't exist](issues/041-doc-starter-deck-nonexistent.md)                | Open   |
| CH-042 | 🟠  | [Top-level docs describe an obsolete card/energy/hand model](issues/042-doc-toplevel-obsolete-model.md)                 | Open   |
| CH-043 | 🟡  | [Skirmish starting roster contradicts itself across docs and code](issues/043-hole-skirmish-roster-contradiction.md)    | Open   |
| CH-044 | 🟡  | [Skirmish is marked disabled in docs but enabled in code](issues/044-hole-skirmish-disabled-enabled.md)                 | Open   |
| CH-045 | 🟡  | [Boss C can create an unmitigated forced loss with no concede valve](issues/045-hole-boss-c-forced-loss.md)             | Open   |
| CH-046 | 🟡  | [No clock/move-cap + draws=loss + no concede enables dead-turn/griefable states](issues/046-hole-no-clock-deadturn.md)  | Open   |
| CH-047 | 🔵  | [Downgrade + promotion interaction is unspecified](issues/047-hole-downgrade-promotion.md)                              | Open   |
| CH-048 | 🔵  | [rollDistinct can emit non-distinct piece offers](issues/048-hole-rolldistinct-nondistinct.md)                          | Open   |
| CH-049 | 🔵  | ["No reactions" leaves disruption one-sided; Boss C's Echo has no player counter](issues/049-hole-no-reactions-echo.md) | Open   |
