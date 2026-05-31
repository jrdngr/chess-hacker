# Chess Hacker — Issue Tracker

Issues derived from the comprehensive review in `docs/reviews/2026-05-29-comprehensive-review.md`. Each issue has a dedicated file in `issues/`.

**Working instructions for the agent:** Work issues **one at a time**. Open the linked file for full context (locations, problem, recommendation, related issues). After completing an issue, run the pre-commit checks in `CLAUDE.md` (`npm run format`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`), then commit with `jj commit` and mark the issue's **Status** as `Done` here and in its file. Prefer the recommended ordering below (severity-first within each section).

**Total open issues:** 63

Legend: 🔴 critical · 🟠 high · 🟡 medium · 🔵 low · ⚪ nit

## Code — Correctness

| #      | Sev | Issue                                                                                                                                      | Status |
| ------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| CH-001 | 🟠  | [SSH Tunnel teleport records own piece as destroyed and drops its buffs](issues/001-ssh-tunnel-teleport-phantom.md)                        | Done   |
| CH-002 | 🟡  | [Bit Flip (convert-piece) keeps enemy-applied statuses on the converted piece](issues/002-bit-flip-keeps-enemy-statuses.md)                | Done   |
| CH-003 | 🟡  | [Sanctuary/Shield protection is bypassed by en passant](issues/003-sanctuary-shield-en-passant.md)                                         | Done   |
| CH-004 | 🔵  | [resurrect-piece removes by an index into the unfiltered capturedPieces array](issues/004-resurrect-piece-index-mismatch.md)               | Done   |
| CH-005 | 🔵  | [pending-energy-loss-on-no-capture ignores its validated amount and hardcodes a penalty of 1](issues/005-pending-energy-loss-hardcoded.md) | Done   |
| CH-006 | 🔵  | [Card-destroyed enemy pieces don't fire on-capture artifacts](issues/006-card-capture-artifact-disagreement.md)                            | Done   |
| CH-008 | 🔵  | [outcome() reports stalemate (draw) for any king-less side with no moves](issues/008-stalemate-kingless-engine.md)                         | Done   |
| CH-009 | 🔵  | [promotionRank opponent-side mirror formula is likely inverted (dead code)](issues/009-promotion-rank-mirror-inverted.md)                  | Done   |
| CH-007 | ⚪  | [place-zone-buff autoPlace whiffs with no refund when all candidate squares are walled](issues/007-zone-buff-autoplace-whiff.md)           | Done   |
| CH-010 | ⚪  | [Root + Empower stacking silently loses all empower moves](issues/010-root-empower-stacking.md)                                            | Done   |
| CH-011 | ⚪  | [SAN disambiguation runs the Compel filter and can under-disambiguate](issues/011-san-disambiguation-compel.md)                            | Open   |

## Tests — Coverage

| #      | Sev | Issue                                                                                                                         | Status |
| ------ | --- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| CH-012 | 🟠  | [useAiLoop boss/Echo/void/fallback branches are untested](issues/012-test-useailoop-boss-branches.md)                         | Open   |
| CH-015 | 🟡  | [cardValidator.ts (1077 lines) has no direct tests](issues/015-test-cardvalidator-untested.md)                                | Open   |
| CH-017 | 🟡  | [Chess draw rules & special-move execution are under-tested](issues/017-test-chess-draw-special-moves.md)                     | Open   |
| CH-018 | 🟡  | [targeting.ts (computeValidTargetSquares / computeBoardMode) is pure but untested](issues/018-test-targeting-untested.md)     | Open   |
| CH-019 | 🟡  | [Boss in-match mechanics (void squares, capture-energy) validated only statically](issues/019-test-boss-mechanics-runtime.md) | Open   |
| CH-016 | 🔵  | [status/validate.ts has no direct tests](issues/016-test-status-validate-untested.md)                                         | Open   |
| CH-020 | 🔵  | [Run.tsx phase machine and runHistory.ts are under-tested](issues/020-test-run-runhistory.md)                                 | Open   |
| CH-024 | 🔵  | [Save/load persistence is fully specced but unimplemented and untested](issues/024-test-persistence-unimplemented.md)         | Open   |

## Tests — Validity

| #      | Sev | Issue                                                                                                                                 | Status |
| ------ | --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| CH-013 | 🟠  | ["Self Destruct" test silently no-ops on its seed and never calls playCard](issues/013-test-self-destruct-noop.md)                    | Open   |
| CH-014 | 🟠  | [sacrifice-detonate core effect (adjacent-enemy destruction + drawCount) is untested](issues/014-test-sacrifice-detonate-untested.md) | Open   |
| CH-021 | 🔵  | [Misleading test name "draw 2, gain 2 energy"](issues/021-test-name-draw2-gain2.md)                                                   | Open   |
| CH-022 | 🔵  | [dispatch test "on-self-pawn-move only fires for pawn-move events" tests the opposite](issues/022-test-dispatch-pawn-move-wrong.md)   | Open   |
| CH-023 | 🔵  | [every-n-turns test gap and tautological skirmish assertions](issues/023-test-dispatch-everyn-skirmish-tautology.md)                  | Open   |

## Refactor — Duplication

| #      | Sev | Issue                                                                                                  | Status |
| ------ | --- | ------------------------------------------------------------------------------------------------------ | ------ |
| CH-025 | 🟡  | [Square coordinate parsing reimplemented inline in 7+ files](issues/025-dup-square-coord-parsing.md)   | Open   |
| CH-026 | 🟡  | [FILES / "abcdefgh" / FILE_LETTERS constant redefined in ~7 modules](issues/026-dup-files-constant.md) | Open   |
| CH-027 | 🟡  | [PIECE_VALUE defined 4 times with pawn=0/1 drift](issues/027-dup-piece-value.md)                       | Open   |
| CH-028 | 🔵  | [3x3 king-adjacent enumeration is hand-rolled in multiple places](issues/028-dup-king-adjacency.md)    | Open   |
| CH-029 | 🔵  | [Rarity-weighted distinct-pick loop copy-pasted](issues/029-dup-rarity-pick-loop.md)                   | Open   |
| CH-030 | 🔵  | [Miscellaneous low-level duplication cleanup](issues/030-dup-misc-cleanup.md)                          | Open   |

## Game Design — Balance

| #      | Sev | Issue                                                                                                           | Status |
| ------ | --- | --------------------------------------------------------------------------------------------------------------- | ------ |
| CH-031 | 🔴  | [AI difficulty is flat across the entire run](issues/031-bal-ai-difficulty-flat.md)                             | Open   |
| CH-032 | 🟠  | [Ascension/heat system is stored but entirely unimplemented](issues/032-bal-ascension-unimplemented.md)         | Open   |
| CH-033 | 🟠  | [Performance/feat gold bonuses are documented but never awarded](issues/033-bal-feat-gold-not-awarded.md)       | Open   |
| CH-034 | 🟡  | [Skirmish enemy-mirroring is gameable and removes opponent variety](issues/034-bal-skirmish-mirror-gameable.md) | Open   |
| CH-035 | 🟡  | [Overclock+ is undercosted](issues/035-bal-overclock-undercosted.md)                                            | Open   |
| CH-036 | 🟡  | [A single shop artifact can starve card acquisition](issues/036-bal-shop-starves-cards.md)                      | Open   |
| CH-037 | 🟡  | [Self-Destruct at cost 2 is a cheap multi-capture clear](issues/037-bal-self-destruct-cheap.md)                 | Open   |
| CH-038 | 🔵  | [Lower-severity balance items (doc drift, Boss C cliff, interest cap)](issues/038-bal-low-severity-bundle.md)   | Open   |

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

## Game Design — Content

| #      | Sev | Issue                                                                                                                       | Status |
| ------ | --- | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| CH-050 | 🟠  | [No cards apply player→enemy status effects (whole system unused)](issues/050-content-player-status-cards.md)               | Open   |
| CH-051 | 🟠  | [No cards use the board square-effect overlay (type #2 unused)](issues/051-content-square-effect-cards.md)                  | Open   |
| CH-052 | 🟠  | [Zone-control buffs are used by exactly one card](issues/052-content-zone-buff-cards.md)                                    | Open   |
| CH-053 | 🟠  | [Artifact pool is 14 vs a 26-40 target, with only 2 rares](issues/053-content-artifact-pool-thin.md)                        | Open   |
| CH-054 | 🟡  | [Most keywords have one enabler and no payoff card](issues/054-content-keyword-payoffs.md)                                  | Open   |
| CH-055 | 🟡  | [Sacrifice (2 cards) and Summon (3 cards) archetypes lack density and anchors](issues/055-content-sacrifice-summon-thin.md) | Open   |
| CH-056 | 🟡  | [Only 3 fixed bosses, one per act, with no archetype variety](issues/056-content-boss-variety.md)                           | Open   |
| CH-059 | 🟡  | [No counterplay vs Boss C dead-ends / draw=loss / uninteractive Echo](issues/059-content-counterplay-boss-c.md)             | Open   |
| CH-060 | 🟡  | [Author the cards referenced by starter-deck.md that don't exist](issues/060-content-author-missing-starter-cards.md)       | Open   |
| CH-057 | 🔵  | [Cost-curve holes at 5, 9, 11; thin mid-tier](issues/057-content-cost-curve-holes.md)                                       | Open   |
| CH-058 | 🔵  | [Promotion archetype is artifact-only with no card support](issues/058-content-promotion-cards.md)                          | Open   |

## Docs / Infra

| #      | Sev | Issue                                                                                                    | Status |
| ------ | --- | -------------------------------------------------------------------------------------------------------- | ------ |
| CH-061 | 🔵  | [dev-mode.md is broadly stale vs code](issues/061-doc-devmode-stale.md)                                  | Open   |
| CH-062 | 🔵  | [CI runs only on main push/PRs and only ever uses a fake Stockfish worker](issues/062-infra-ci-scope.md) | Open   |
| CH-063 | ⚪  | [No keyboard equivalent for drag placement / card targeting](issues/063-infra-keyboard-a11y.md)          | Open   |
