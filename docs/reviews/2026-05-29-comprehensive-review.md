# Chess Hacker — Comprehensive Code & Design Review

## Executive Summary

- **Two high-impact correctness bugs in the card→board bridge.** SSH Tunnel (teleport-piece) is implemented as a remove+place pair, so it (a) records the player's own teleported piece into the "destroyed" captured pool — banking a free resurrectable copy and even enabling a second king via Git Revert — and (b) silently strips the piece's per-square buffs (`src/components/Match/sideEffects.ts:157-171`, `src/game/cards/effectHandlers.ts:583-596`). Bit Flip (convert-piece) flips an enemy piece without clearing the statuses on its square, so a pre-applied freeze/root keeps hampering the now-friendly piece (`src/components/Match/sideEffects.ts:278-283`).
- **Sanctuary/Shield protection is bypassed by en passant.** The protection filter keys on the move destination, not the EP victim's square, so a shielded pawn can be captured en passant — a direct divergence from the documented "cannot be captured" guarantee (`src/game/chess/rules.ts:555`, `:820-834`).
- **The difficulty curve is broken at its core.** Stockfish runs at a fixed depth 6 for all 9 matches and the entire Ascension/heat ladder is stored but never read by any pricing/depth/hand-size code — so a depth-6 engine crushes the player in match 1 and every Ascension level is mechanically identical to Ascension 0 (`src/components/Match/useAiLoop.ts:170`, `src/game/types.ts:554`).
- **Documented economy levers don't exist.** Performance/feat gold bonuses are specced in `economy.md` but never awarded; income is flat win-bonus + interest only, making the run economy one-dimensional and starving deck growth (`src/game/progression/run.ts:184-201`).
- **Pervasive low-level duplication.** Square-coordinate math, the `"abcdefgh"` file string, the 3x3 king-adjacency loop, `PIECE_VALUE` (4 copies with intentional pawn=0/1 drift), and the rarity-weighted pick loop are all reimplemented across many files despite canonical helpers existing in `rules.ts`.
- **Untested high-risk surfaces.** `useAiLoop` boss/Echo/void-square/fallback branches, the `sacrifice-detonate` adjacency effect, `cardValidator.ts`, and several chess draw/special-move paths have no behavioral tests; one flagship test ("Self Destruct") silently no-ops on its RNG seed and never calls `playCard`.
- **The "+1 Draw" boss boon lies to the player** — it is wired to `hand-size-bonus` instead of `draw-per-turn-bonus`, so it does not do what its label or the docs say (`src/game/progression/run.ts:331-339`).
- **Large doc/code drift.** `starter-deck.md` documents cards that don't exist (Port Scan, Bookmark, Heartbleed, etc.), the artifact slot cap is 20 in code vs 5 in most docs, and several top-level docs describe an obsolete card/energy/hand model. Per CLAUDE.md docs are canonical, so these are findings.
- **Content is thin and lopsided.** Whole built systems are unused (player-applied status effects: 0 cards; board square-effects: 0 cards; zone buffs: 1 card), the artifact pool is 14 vs a 26-40 target, and there are only 3 fixed bosses.
- **Persistence is fully specced but unimplemented** — a refresh mid-run loses everything. The roadmap explicitly defers it, so it is a known-future gap rather than shipped-broken.

---

## Code Review

### Abstractions

No standalone abstraction findings were raised beyond the duplication cluster below (the canonical-helpers-exist-but-aren't-used pattern); see Duplication.

### Duplication

#### Square coordinate parsing reimplemented inline in 7+ files — **medium**
- **Locations:** `src/game/chess/rules.ts:40,46`, `src/game/cards/match.ts:589,599-602`, `src/game/cards/effectHandlers.ts:544-545,681-682`, `src/game/overlays/zoneBuffs.ts:49-50`, `src/components/Match/targeting.ts:61-62`, `src/components/Match/derivations.ts:98-99`, `src/components/Match/useDevSandbox.ts:190-195`
- **Problem:** `rules.ts` exports canonical `squareName(file,rank)` and `squareCoords(s)` (re-exported via `engine.ts:41`), yet modules decode/encode squares by hand (`s.charCodeAt(0) - "a".charCodeAt(0)`, `Number(s.slice(1))`). Worse, conventions diverge: `squareCoords` returns a 0-indexed rank while hand-rolled versions keep 1-indexed, and `useDevSandbox` uses yet another 0-indexed convention — so a mechanical refactor to the shared helper would silently shift ranks at several sites.
- **Recommendation:** Add a small coord module (`fileOf`, `rankOf` with one fixed indexing convention, `squareAt(file,rank)`) and route all inline call sites through it.
- *Caveat (partially verified count):* `useCardPlay.ts:285` only decodes a rank for a back-rank check, not a full coordinate, so the true count is ~7 files, not 8+.

#### The `"abcdefgh"` / `FILE_LETTERS` / `FILES` constant redefined in ~7 modules — **medium**
- **Locations:** `src/game/chess/rules.ts:36`, `src/game/cards/effectHandlers.ts:664`, `src/game/cards/match.ts:440,543`, `src/game/chess/positions.ts:150`, `src/game/progression/placement.ts:134`, `src/game/overlays/zoneBuffs.ts:34`, `src/components/Match/targeting.ts:71`, `src/components/Match/derivations.ts:107`
- **Problem:** `rules.ts:36` defines `FILES`; `effectHandlers.ts:664` defines `FILE_LETTERS = "abcdefgh"`; `match.ts` inlines `const FILES = "abcdefgh"` twice (lines 440, 543); `positions.ts` and `placement.ts` each have private byte-identical `squareName`/`sq`; UI modules use the bare literal repeatedly. `rules.ts:40` already exports a canonical `squareName` (used by `usePlacement.ts:10`), so the duplication is avoidable.
- **Recommendation:** Export one `FILES` constant / `squareAt` builder and import everywhere; delete the local copies.
- *Caveat:* The "wider boards silently break" hazard is latent only — `STANDARD_SIZE` is fixed at 8x8. The duplication itself is the confirmed issue.

#### 3x3 king-adjacent enumeration hand-rolled — **low** (downgraded from medium)
- **Locations:** confirmed near-identical copies at `src/game/cards/effectHandlers.ts:546-557` and `src/components/Match/targeting.ts:64-76`; related-but-distinct table/inclusive variants at `effectHandlers.ts:683-714`, `src/game/overlays/zoneBuffs.ts:43-63` (`KING_RADIUS_OFFSETS`), `src/components/Match/derivations.ts:97-111`.
- **Problem:** The `for df in -1..1, for dr in -1..1, skip center, bounds-check, build square` pattern is copy-pasted (2 literal copies) and expressed as offset tables elsewhere. `derivations.ts` hardcodes 0..7/1..8 bounds while others read dynamic size, so on non-8x8 boards the overlay builder enumerates squares in a different frame than the rule/effect layers.
- **Recommendation:** Extract `kingAdjacentSquares(center, size)` + a `withinBounds` predicate; unify `KING_RADIUS_OFFSETS`/`kingSteps` into one exported table.
- *Caveat:* The title's "4 places" is overstated — only 2 are literal copies; `match.ts:597-604 isKingAdjacent` is a pure distance check, not this pattern.

#### `PIECE_VALUE` defined 4 times with pawn=0/1 drift — **medium**
- **Locations:** `src/game/cards/match.ts:63-70` (`PIECE_ENERGY_VALUES`, pawn=1), `src/game/progression/skirmish.ts:17-24` (`SKIRMISH_PIECE_VALUE`, pawn=1), `src/game/progression/standard.ts:23-30` (`PIECE_VALUE`, pawn=0), `src/components/Board/material.ts:5-12` (`PIECE_VALUE`, pawn=1)
- **Problem:** Four independent literals; knight/bishop/rook/queen/king rows are byte-identical, and the only divergence (pawn=0 in `standard.ts`) is intentional but invisible at each call site. A tuning change to any shared row must be edited in 4 files; two even share the name `PIECE_VALUE`.
- **Recommendation:** Define one `CLASSICAL_PIECE_VALUE` (pawn=1) and derive variants explicitly, e.g. `STANDARD_BUDGET_VALUE = { ...CLASSICAL_PIECE_VALUE, pawn: 0 }`.

#### Rarity-weighted distinct-pick loop copy-pasted — **low** (confirmed; severity adjusted)
- **Locations:** `src/game/progression/run.ts:233-258` (`pickRandomCards`), `src/game/artifacts/library.ts:470-502` (`pickRandomArtifacts`)
- **Problem:** Structurally identical loops with the same hardcoded thresholds `r < 0.05` (rare) / `r < 0.3` (uncommon). The artifact version's own comment (`library.ts:464`) admits it "Mirrors the card-pool weighting in `progression/run.ts`." Only difference: the artifact version takes an `excludeIds` param.
- **Recommendation:** Extract a generic `pickRandomByRarity<T extends {id; rarity}>(...)` or at minimum hoist 0.05/0.3 to a named shared constant.

#### Additional low/nit duplication (unverified but cited)
- Private `squareName`/`sq` helpers duplicated in `positions.ts:149-151` and `placement.ts:133-135` (**low**).
- Knight/king/rook offset tables redefined in `effectHandlers.ts:683-702` and `zoneBuffs.ts:85-92` vs canonical-but-unexported tables in `rules.ts:321-344` (**low**).
- Fisher-Yates shuffle implemented twice: `match.ts:96-101` (`shuffle`) and `positions.ts:163-168` (`shuffleInPlace`) (**low**).
- Chess960 back-rank legality re-implemented in `placement.ts:19-61` (validate) vs `positions.ts:32-86` (generate) (**low**).
- Piece-name title-casing repeated 3x in `Match.tsx:1504,1524,1544` vs `PieceDraft.tsx:15`'s `PIECE_NAMES` (**nit**).

### Logic — Chess

#### Sanctuary / Shield protection bypassed by en passant — **medium**
- **Locations:** `src/game/chess/rules.ts:555`, `:820-834`; victim removed at `:1055`
- **Problem:** The pseudo-legal filter enforcing Shield/Sanctuary checks `m.to`: `if (m.isCapture && (sanc.has(m.to) || sh.has(m.to))) continue;`. For en passant, the captured pawn sits on `m.epVictim`, not `m.to` (the empty EP target square). Shields follow a piece on a move via `relocateStatuses`, so a shielded pawn double-pushing to e4 carries its shield; the opponent's EP capture has `m.to = e3` (empty) and deletes the shielded pawn on e4. This contradicts `docs/cards/keywords.md:53,97` and `docs/cards/spatial.md:20`.
- **Recommendation:** Guard the EP victim: `if (m.isCapture) { const victimSq = m.epVictim ?? m.to; if (sanc.has(victimSq) || sh.has(victimSq)) continue; }`. Add a regression test.

#### Lower-severity chess edge cases (unverified)
- `outcome()` reports stalemate (draw) for any king-less side with no moves, not just the empty placement board; commit 94765ae works around this in `Match.tsx` via a `placement.active` guard rather than fixing the engine (`engine.ts:436-465`, `rules.ts:505-509`) — **low**.
- `promotionRank` opponent-side mirror formula `size.ranks - override` is likely inverted, but currently dead/unreachable (`rules.ts:64-75,150-154`) — **low**.
- Root + Empower stacking: a rooted+empowered piece silently loses all empower moves (empower moves are never captures, and Root drops non-captures); confirm this is intended (`rules.ts:526-558,867-915`) — **nit**.
- SAN disambiguation runs the Compel filter, which can under-disambiguate SAN when a Compel overlay is active; display-only (`engine.ts:541-551`, `rules.ts:1145-1158`) — **nit**.

### Logic — Cards / Economy

#### SSH Tunnel (teleport-piece) records the teleported own piece as "destroyed" and drops its buffs — **high**
- **Locations:** `src/game/cards/effectHandlers.ts:583-596`, `src/components/Match/sideEffects.ts:157-171`, `src/game/cards/data/ssh-tunnel.json`
- **Problem:** `teleport-piece` emits `{remove-piece, first}` then `{place-piece, second}`. SSH Tunnel always targets OWN pieces, so the remove-piece handler pushes `{type, side:"player", reason:"destroyed"}` into `capturedPieces` for a piece still on the board. The paired place-piece never relocates statuses (unlike swap/foreign-move), so Shield/Haste/Empower/Lightning are stripped. The `resurrect-piece` handler (`effectHandlers.ts:609-624`) filters only by `side === "player"` — it does not exclude `reason:"destroyed"` or `type === "king"` (unlike `summon-piece` at `:331-332`), so Git Revert can resurrect the phantom; with SSH Tunnel+ (king allowed) this seeds a second player king.
- **Recommendation:** Add a dedicated `move-piece`/teleport side effect using `engine.displacePiece` + `relocateStatuses`, or special-case teleport so the remove does not push to `capturedPieces` and the place relocates statuses.

#### Bit Flip (convert-piece) keeps enemy-applied statuses on the converted piece — **medium**
- **Locations:** `src/components/Match/sideEffects.ts:278-283`, predicates at `src/game/cards/match.ts:997-1015`, `src/game/cards/data/bit-flip.json`
- **Problem:** `convert-piece` does `removePiece` + `placePiece(side:"player")` but never calls `clearStatusesOn(fx.square)` — unlike sibling destructive handlers (`garbage-collect` at `:273-274`, `remove-random-own-minor` at `:306-307`). Status entries are keyed by square only (the `side` field is never consulted by `isFrozen`/`isRooted`/etc., and `deriveOverlaySets` builds square-only sets), so a freeze/root applied to an enemy minor before Bit Flip persists and now suppresses the player's newly-acquired piece.
- **Recommendation:** Call `clearStatusesOn(next, fx.square)` after converting.

#### Lower-severity card/economy issues (unverified)
- `resurrect-piece` removes by an index into the *unfiltered* `capturedPieces` while the UI supplies a *filtered* index; latent today because all push sites use `side:"player"` (`effectHandlers.ts:609-625`, `Match.tsx:1539-1548`) — **low**.
- `pending-energy-loss-on-no-capture` ignores its validated `amount` and hardcodes a penalty of 1 (`effectHandlers.ts:439-446`, `match.ts:351`, `cardValidator.ts:575-583`) — **low**.
- Card-destroyed enemy pieces increment `playerCaptureCount` (Heartbleed) but do NOT fire draw-on-capture/energy-on-capture artifacts, which only trigger on chess-move captures — the two "on capture" systems disagree (`sideEffects.ts:167-169,268-271`, `useCardPlay.ts:298-303`) — **low**.
- `place-zone-buff` with `autoPlace` whiffs (no buff, no refund) if every candidate square is walled, after the card cost is paid and the card consumed (`effectHandlers.ts:272-304`, `match.ts:724-743`) — **nit**.

### Test Coverage

#### `useAiLoop` boss/edge branches are untested — **high**
- **Locations:** `src/components/Match/useAiLoop.ts:206-306`; happy-path-only tests at `src/components/Match.test.tsx:193-302`
- **Problem:** The most consequential UI branching is uncovered: random-legal-move fallback on engine failure/malformed UCI (`:206-213`), Boss C void-square destruction + `clearStatusesOn` (`:245-252`), Boss B captures-grant-captured-energy queuing (`:255-264`), Git-Revert capturedPieces tracking on AI captures (`:266-274`), and the Echo loop that decrements `bossExtraMoves` and re-forces the opponent turn (`:297-304`). No test renders `<Match>` with an `activeBoss`. A regression in the Echo loop could infinite-loop the AI turn; a fallback regression could lock the game on "thinking…".
- **Recommendation:** Add tests via the injectable `createAi` param: empty-UCI → legal fallback; AI moves onto a void square → removed + statuses cleared; capture-energy modifier → `pendingPlayerEnergyOnTurnStart` increments; `bossExtraMoves>0` → turn forced back to opponent until the queue drains.

#### `cardValidator.ts` (1077 lines) has no direct tests — **medium**
- **Locations:** `src/game/cards/cardValidator.ts:1010-1077`, `src/game/cards/library.ts:67-141`
- **Problem:** `validateCard` is the gatekeeper turning raw JSON into typed Cards, run over the whole library at module load and on every synthesized upgrade. It owns 16 `VALID_*` allow-lists and per-effect-kind validation, but the only coverage is the implicit "the real library happens to validate" path. No test asserts that a malformed card (bad rarity, unknown effect kind, missing required field, invalid zone-buff pattern, out-of-range cost, target/effect mismatch) is *rejected* — so a too-permissive regression goes uncaught.
- **Recommendation:** Add table-driven `cardValidator.test.ts` (valid minimal card per archetype passes; each enum rejects out-of-set; each required-field effect rejects when missing). Mirror for the untested `status/validate.ts`.

#### Chess draw rules & special-move execution under-tested — **medium**
- **Locations:** `src/game/chess/engine.ts:455-462`, `engine.test.ts:60-132`, `rules.test.ts:32`
- **Problem:** Engine detects fifty-move (`:458-459`), threefold (`:461-462`), and insufficient material, but tests cover only insufficient material. No test produces a 50-move or threefold draw. En passant is never tested for legality or execution (the only hit is a FEN round-trip). Promotion is tested only for auto-queen — no underpromotion, and no test that the Promotion-Engine rank override actually promotes when executed via `engine.move`.
- **Recommendation:** Add engine tests for halfmove→100 draw, threefold, EP enumeration+execution (removes the passed pawn), underpromotion to knight/rook, and override-rank promotion through `engine.move`.

#### `targeting.ts` (`computeValidTargetSquares` / `computeBoardMode`) is pure but untested — **medium**
- **Locations:** `src/components/Match/targeting.ts:6,241`
- **Problem:** Two React-free pure functions drive every card-targeting click (~20 target-kind branches with wall/own-half/adjacency/attacked-by filters), with no direct tests; only a few of the highest-traffic branches are touched indirectly via `Match.test.tsx`. Incorrect target computation would let players target illegal squares or block legal ones.
- **Recommendation:** Add `targeting.test.ts` covering each target-kind family against a fixture position, and `computeBoardMode` for move / card-targeting / display-only states.

#### Save/load persistence unimplemented and untested — **low** (downgraded from high)
- **Locations:** `docs/technical/persistence.md:1-128`, `src/game/progression/run.ts:1-104`, `src/state/palette.ts:44-92`
- **Problem:** The spec (two localStorage keys, per-action save points, resume-on-boot, versioning/migration) is fully written, but no `SavedRun`/`MetaState` type or save/load/migrate code exists; the only localStorage usage is palette toggles. A refresh mid-run loses the entire run and all meta-progression.
- *Caveat:* `docs/roadmap/milestones.md:137` explicitly defers save/resume to a follow-up milestone, so this is a known-future gap, not a coverage hole in shipped functionality.
- **Recommendation:** When built, add `persistence.ts` + colocated tests (round-trip, ID-rehydration with dropped-ID, version-mismatch invalidation). Until then, keep the deferral recorded.

#### Boss in-match mechanics validated only statically — **medium** (partially valid)
- **Locations:** `src/game/bosses/library.test.ts:6-58`, `src/game/bosses/library.ts:1-40`
- **Problem:** The boss library test is shape-only (valid notation, recognized modifier kinds). Two runtime mechanics genuinely lack any behavioral test: **void squares destroying pieces** (logic only in `useCardPlay.ts:261-268` / `useAiLoop.ts:246-250`) and the **captures-grant-captured-energy modifier** (`useAiLoop.ts:262` / `match.ts:354`), both living in untested UI hooks.
- *Caveat (refuted sub-claims):* Hazard-wall persistence IS tested (`match.bossWalls.test.ts:10-28`) and the full status-effect curse schedule IS tested (`match.statusEffects.test.ts`); "curseSchedule" is not a real construct. So the original "never driven at runtime" framing is overstated.
- **Recommendation:** Add behavior tests for void-square destruction and the capture-energy modifier specifically.

#### Other coverage gaps (unverified)
- `Run.tsx` (782-line phase machine) has only 2 smoke tests; `runHistory.ts` (307 lines) untested (`Run.test.tsx:10-30`) — **low**.

> **Refuted — excluded:** "useCardPlay/useBoardInteraction/usePlacement/useUndoRedo/useDevSandbox/useDevEditor have no tests." `Match.test.tsx` (1256 lines) renders `<Match>` and exercises card resolution, undo/redo stack invariants (including redo invalidation and exact-hand restoration), board interaction, and dev-editor placement. The narrow real residue: `usePlacement` and `useCardPlay`'s promotion-prompt branch remain uncovered.

### Test Validity

#### "Self Destruct" test silently no-ops on its seed and never runs `playCard` — **high**
- **Locations:** `src/game/cards/match.test.ts:191-216`, `match.testHelpers.ts:11`
- **Problem:** The test shuffles an 8-card deck and does `findIndex(... "self-destruct")`. With `STARTING_HAND_SIZE=3` and `makeRng(9)`, the opening hand is `[firewall, firewall, firewall]` so `idx === -1`, and `startPlayerTurn` does not draw on turn 0→1. The test takes the early-return `if (idx === -1) { expect(drawPile.some(...)).toBe(true); return; }` and never calls `playCard`, never asserts the remove-piece side effect or energy/draw. It passes by asserting only that the card exists in the deck — a near-tautology.
- **Recommendation:** Force the card into hand (single-card deck or set `st.hand` directly) and remove the silent `if (idx === -1) return` escape hatch here and at the sibling lines 223 and 420.

#### `sacrifice-detonate` core effect (adjacent-enemy destruction + drawCount) is untested — **high**
- **Locations:** `src/game/cards/effectHandlers.ts:544-562`, `src/game/cards/match.test.ts:191-216,405-437`
- **Problem:** Self Destruct's entire purpose is the 8-neighbor detonation loop and (upgraded) drawing. Both Self Destruct tests place only an isolated own pawn — no adjacent enemy — and neither uses the upgraded variant. The opponent-filter branch and the `drawCount` branch never execute. A regression breaking adjacency targeting (wrong bounds, including own pieces, removing the king) or the upgrade draw would pass green. No other test references `sacrifice-detonate`.
- **Recommendation:** Add a test sacrificing a piece with multiple adjacent enemies (including an adjacent king to confirm it is spared, and a board edge to confirm bounds) asserting the full remove-piece set; add an upgraded-variant test asserting hand grows by 2.

#### Misleading test name "draw 2, gain 2 energy" — **low** (downgraded from medium)
- **Locations:** `src/game/cards/match.test.ts:191`, `self-destruct.json:8-21`, `effectHandlers.ts:538-563`
- **Problem:** The base card is `sacrifice-detonate` with no energy gain; `drawCount:2` exists only on the upgrade. The test name describes a retired version. The actual assertions correctly match real behavior, so no bug is hidden — purely a misleading name.
- **Recommendation:** Rename to reflect actual behavior.

#### `dispatch` test "on-self-pawn-move only fires for pawn-move events" tests the opposite — **low** (downgraded from medium)
- **Locations:** `src/game/status/dispatch.test.ts:146-163`
- **Problem:** No shipped def uses `on-self-pawn-move` (the test's own comment admits this). It attaches a `throttled` (`on-self-check`) status and asserts it does NOT fire on a pawn-move — zero positive coverage of the named trigger. It adds a thin sliver of new negative coverage (wrong-event-kind rejection) but the name oversells.
- **Recommendation:** Construct a synthetic def with `on-self-pawn-move` and assert it fires, or rename the test.

#### Other validity nits (unverified)
- `every-n-turns` dispatch test never checks a non-multiple turn > N (e.g. 5,6,7), so a "fires every turn ≥ N" bug would pass (`dispatch.test.ts:77-102`) — **low**.
- Skirmish offer assertions compare runtime output to the same exported constants used to build it (tautological) (`skirmish.test.ts:73-78`) — **nit**.

---

## Game Design Review

### Balance

#### AI difficulty is flat across the run — **critical**
- `depthForDifficulty` (`src/ai/stockfish.ts:478-487`) maps to a fixed depth (easy=2/normal=6/hard=10), and `useAiLoop.ts:170` uses a single `difficulty` state initialized to `'normal'` (`Match.tsx:341,378`), never varied by match/act/ascension. A depth-6 (~1800+ Elo) Stockfish crushes the player in match 1 (6x6, tiny toolkit) and never ramps. **Fix:** scale depth or Stockfish Skill Level / UCI_Elo by `matchNumber` and `ascension`.

#### Ascension/heat system stored but entirely unimplemented — **high**
- `RunState.ascension` (`types.ts:554`, `run.ts:57,89`) is only ever *logged* (`runHistory.ts`, `Run.tsx:219`); no pricing/depth/hand-size code reads it. Every documented A1–A8 modifier is a no-op. **Fix:** implement at least A1 (shop prices ×1.2) and A2 (AI depth), or hide Ascension and mark it unbuilt in docs.

#### Performance/feat gold bonuses documented but not awarded — **high**
- `applyMatchOutcome` (`run.ts:184-201`) adds only flat `WIN_BONUS_NORMAL`/`WIN_BONUS_BOSS`; no feat is computed despite `economy.md` and `types.ts:595`. Run income ≈ 110 gold from wins + ≤40 interest, against 12–28-gold artifacts and 5–15-gold cards — deflationary and one-dimensional. **Fix:** implement 2–3 feats from the match summary, or cut them from the doc.

#### Skirmish enemy-mirroring is gameable — **medium**
- The enemy mirrors the player's *placed* composition (`placement.ts:72`, `usePlacement.ts:91-129,484-523`), so under-placing value forces a symmetric weak enemy and the value cap becomes a player-controlled dial; drafting a queen hands the enemy the same queen. **Fix:** set enemy value to the *cap* (not placed value), or give a value-equivalent non-identical roster.

#### Overclock+ undercosted — **medium**
- Overclock+ (`overclock.json`) becomes `lightning-piece, actions:2`, dropping the Disarm: two unconditional capture-enabling extra moves for 4 energy at common, chainable with capture-energy refunds. **Fix:** keep the Disarm, raise cost to 5–6, or cap to 1 capture action.

#### Single shop artifact can starve card acquisition — **medium**
- Shops are the only card source (`cards.md`) yet realistic income is ~14–20 and one artifact costs 12–28 (`shop.ts:54`), while the +5 interest breakpoint wants 25 hoarded — contradictory pulls. **Fix:** add feat gold / lower early card prices / raise win bonus; verify a player can add ~8–12 cards across 8 shops.

#### Self-Destruct at cost 2 is a cheap multi-capture clear — **medium**
- Cost 2 uncommon destroys own piece + all adjacent enemy non-kings; on cramped 6x6 boards this is a huge swing, refunded by capture-energy (3 minors = +9). **Fix:** raise to 3–4, restrict to orthogonal adjacency, or cap pieces destroyed.

#### Lower-severity balance items
- Doc/code drift: starter deck size (10 vs "12"/11 actual), Exploit cost (doc "cost-3" vs `exploit.json` cost 8), artifact pool (doc 12 vs 14 files), `starter-deck.md` references non-existent Port Scan/Bookmark (**low**).
- Boss C stacks no-promotion + center void + Hardened + Echo + Bit Rot — a likely difficulty cliff, compounded by the flat AI (**low**).
- Interest cap (25 gold → +5) is unreachable in early acts given tight income (`shop.ts:39-41`) (**low**).

### Design Holes

#### "+1 Draw" boss boon wired to hand-size, not draw-per-turn — **high**
- `run.ts:331-339` builds the boon with `hand-size-bonus` while its label and `bosses.md:113-114`/`progression.md:24` say "+1 card draw/turn." A real `draw-per-turn-bonus` effect kind exists and is read by `startPlayerTurn`. **Fix:** emit `draw-per-turn-bonus` (and possibly also `hand-size-bonus`); add a test that the boon increases cards-drawn-per-turn.

#### Artifact slot cap is 20 in code but 5 in most docs — **high**
- `types.ts:727` sets `ARTIFACT_SLOT_CAP = 20` (and `artifacts.md:16` agrees), but `README.md:66`, `glossary.md`, and the `run.ts:283` comment all say 5. A 20-cap deletes the displacement-choice mechanic. Also `pickBossArtifact` (`run.ts:285-287`) doesn't enforce the cap while `shop.ts:230` does. **Fix:** pick the real number (design assumes ~5), make it canonical, enforce consistently.

#### `starter-deck.md` documents cards/decks that don't exist — **high**
- Port Scan, Bookmark, Cache Warmup, Connection Reset, Heartbleed, kill -9 have no data files; the doc decks don't match `decks/named/*.json`; `cards.md:12` says 3 decks while code ships 5. **Fix:** either author the missing cards (most map onto existing effect kinds — JSON only) and rewrite the deck JSON, or rewrite the docs to match the 5 shipped decks.

#### Top-level docs describe an obsolete card/energy/hand model — **high**
- `README.md:64`, `glossary.md`, `overview.md:43-44`, `keywords.md:116`, `progression.md` A4 still say hand 5, draw 2 + forced discard, energy 3/turn no-banking, costs 0–4 — while code/`cards.md` say hand 7, draw 1, voluntary discard, banking with cap 20, costs 0–15. **Fix:** sweep all top-level docs to the code model.

#### Medium/low design holes
- Skirmish starting roster contradicts itself: `pieces.md:5-13` (5 pieces, soft caps) vs `modes.md:63`/`skirmish.ts:70-77` (K+3P+N+B = 6, 8-pawn hard cap only) — **medium**.
- Docs say Skirmish is disabled but `ModeSelect.tsx:14-30` enables it; `modes.md` line 3 vs line 59 self-contradict — **medium**.
- Boss C no-promotion + all-pawns endgame + draws=loss = unmitigated forced loss with no concede valve (`the-singularity.json`, `chess-rules.md:8-15,91`) — **medium**.
- No clock/move-cap + draws=loss + no concede creates dead-turn / griefable states (`chess-rules.md:15`) — **medium**.
- Skirmish exact-mirror removes opponent variety and kills the "Pandora's Box queen" fantasy (`modes.md:64,101`) — **medium**.
- Artifact pool 14 vs 26–40 target; conditional-trigger/resource domains thin (`artifacts.md:99-101`) — **medium**.
- Downgrade + promotion interaction unspecified: a downgraded piece reaching the far rank would promote via `addPawnMoves` (`rules.ts:582-585`, `keywords.md:41-45`) — **low**.
- `rollDistinct` can emit non-distinct piece offers (no exclusion between picks) (`skirmish.ts:113-134`) — **low**.
- "No reactions" leaves disruption one-sided; Boss C's Echo extra-move has zero player counter (`open-questions.md:9`) — **low**.

### Content & Gaps

- **Player-applied status effects: 0 cards** despite a fully built side-symmetric system (`status-effects.md`, `src/game/status/`). All 5 statuses are boss→player. — **high**
- **Board square-effect overlay (type #2): 0 cards** (on-enter draw, pushback, protection) (`board.md`). — **high**
- **Zone-control buffs used by exactly 1 card** (Power Node); `rank`/`square-radius-1` regions and non-energy buffs are dead (`board.md`, `types.ts:895-906`). — **high**
- **Artifact pool 14 vs 26–40 target; only 2 rares** (target 6–10); whole domains (sacrifice/summon/spatial/status triggers) absent. — **high**
- Most keywords have one enabler and no payoff card — synergy lines are stubs (Freeze/Root/Disarm/Compel/Downgrade/Haste each = 1 card). — **medium**
- Sacrifice (2 cards) and Summon (3 cards) lack density and any supporting artifact to anchor a build. — **medium**
- Only 3 fixed bosses, one per act, no archetype variety (no tempo/spatial/debuff/swarm boss). — **medium**
- Cost-curve holes at 5 (0 cards), 9, 11; thin mid-tier. — **low**
- Promotion archetype is artifact-only with no card support, and hard-countered by Boss C. — **low**

---

## Proposed New Content

### Cards

| Name | Gap Filled | Sketch |
|---|---|---|
| **Worm** | No card applies a persistent player→enemy status | Cost 7 Rare Consume Power. `every-n-turns` (n=3) on opponent turn-start → `freeze-piece` a random enemy minor. Reuses existing trigger + effect plumbing. |
| **Rootkit** | No player-side persistent debuff engine | Cost 10 Rare Consume Power. `on-self-capture` (opponent) → opponent loses 1 energy next turn. Mirror of The Whale's Memory Leak turned on the AI. |
| **Beacon** | Board overlay #2 (on-enter draw) has 0 cards | Cost 2 Common Spatial. Mark a square for 4 turns; first friendly piece ending there each turn draws 1. New `place-square-effect{onFriendlyEnter:draw 1}` on the existing overlay layer. |
| **Repulsor Field** | Board overlay #2 (pushback) unbuilt; trap herding | Cost 3 Uncommon Spatial. Enemy ending on the marked square is pushed 1 toward its side. Pairs with traps. |
| **Chokepoint** | Zone system's `rank`/file regions + non-energy buffs are dead | Cost 3 Uncommon Spatial. `place-zone-buff` on your back rank; while you out-piece the enemy on a file, hand size +1. |
| **Martyr Protocol** | Sacrifice archetype has no cheap enabler/payoff | Cost 1 Common Sacrifice. Destroy own pawn → gain 2 energy, draw 1. Reuses `sacrifice-piece`. |
| **Swarm Protocol** | Summon archetype has no wide-board payoff | Cost 6 Uncommon Summon. Summon a pawn on each empty square orthogonally adjacent to one chosen pawn (≤4). |
| **Quarantine** | Fills the empty cost-5 slot; debuff payoff | Cost 5 Uncommon. Destroy an enemy non-king that is Frozen/Rooted/Disarmed — a 2-card removal combo. |
| **Stack Smash** | Compel has no direct payoff | Cost 4 Uncommon Disruption. Compel an enemy piece; if it has no legal capture, also Disarm it next turn (compound effect). |
| **Sprint** | Promotion has no card support | Cost 2 Common. Empower a pawn with a one-time 2-square forward step from any rank. Card-based promotion acceleration. |
| **Kernel Panic** | Counterplay vs Boss C dead-end / draw=loss | Cost 12 Rare Consume Burst. If you'd lose to a draw rule / no mate path, win instead. Uses the `chess-rules.md:91` match-end override. |
| **Watchdog Timer** | Disruption is pre-emptive; Echo is uninteractive | Cost 3 Uncommon Consume. Arms on your turn; cancels the next enemy capture this opponent-turn. Pre-armed trigger, not a live reaction. |
| **Port Scan / Cache Warmup / Heartbleed / Bookmark / kill -9 / Connection Reset** | `starter-deck.md` references these non-existent cards | All map to existing effect kinds (draw 2; pending-energy-next-turn; gain-energy-per-capture; apply-retain; sacrifice-detonate variant; place-trap). JSON authoring only. |

### Artifacts

| Name | Gap Filled | Sketch |
|---|---|---|
| **Antivirus (Rate Limiter)** | No counter to cheap extra-action tempo engines | Uncommon. The 3rd+ card each turn costs +2 energy. Soft per-turn cap. |
| **Cold Storage** | Resource/match-rule domain under-represented; energy cap wastes excess | Uncommon. Energy cap 30; at match start gain ½ prior unspent energy (max 5). |
| **Loadbalancer** | Conditional triggers beyond capture/check; zone payoff | Rare. Turn-start: if you hold the center 2x2 majority, draw 1 and next card costs 1 less. |
| **Scavenger** | No sacrifice-reward artifact | Uncommon. On sacrificing own piece → gain 2 energy this turn. New `on-self-sacrifice` hook. |
| **Hive Mind** | No summon support; thin rare tier | Rare. Summon cards cost 2 less; first summoned pawn each turn gets Shield. |
| **Dead Drop** | No spatial/trap artifact | Uncommon. First Trap/Wall each match draws a card; trap-frozen enemies stay frozen +1 turn. |

### Modes / Bosses

| Name | Type | Gap Filled | Sketch |
|---|---|---|---|
| **Race Condition** | Mechanic | Flat AI | Per-match Stockfish Skill/Elo schedule (act1 ~4–6 → finale ~14–18), +1–2 per Ascension (implements A2). |
| **Bounty board** | Mechanic | No feat gold | Stacking match-summary bonuses (+5 queen capture, +4 fast win, +5 no major loss, +3 cards-in-draw-pile), cap ~12. |
| **Conscription / Asymmetric Skirmish scaling** | Mechanic | Mirror is gameable / wash | Set enemy value to the cap (or ~80% early → 100% finale) so under-placing only weakens the player. |
| **Sandbox** | Mechanic | Ascension inert | Thread `run.ascension` into shop pricing ×(1+0.2·level) as the first real Ascension modifier. |
| **The Cartographer** | Boss | No spatial boss; overlays underused | Act-2 7x7. No player Sanctuaries; a maze of 6 indestructible walls + 2 pushback squares; every-3-turns place a new wall on a random player square. |
| **The Overseer** | Boss | No player-side piece-debuff boss | Hand size −1; center zone-buff grants boss +1 energy; turn-start Disarm a random player non-pawn. Exercises the unused player-side debuff system. |

---

## Coverage Gaps / Not Reviewed

- **Dev-mode docs broadly stale vs code** (**low**): `docs/technical/dev-mode.md` names hooks `useMatchEngine`/`useCardSystem`/`useAiTurn` that don't exist (real: `useAiLoop`, `useCardPlay`, `useDevSandbox`, etc.), points at `DevPanel.tsx` instead of `DevPanel/index.tsx`, and references a `src/ai/toyAi.ts` non-8x8 fallback that doesn't exist. Update to the real hook set and the Fairy-Stockfish variant behavior.
- **CI scope and worker coverage** (**low**): `.github/workflows/ci.yml` triggers only on `main` push + PRs, so dev-branch pushes get no CI until a PR opens; and the suite only ever uses a fake Worker — the real Fairy-Stockfish worker / SharedArrayBuffer / cross-origin isolation is never booted (`stockfish.test.ts`). Add the dev branch to the push trigger and a Playwright smoke test asserting `crossOriginIsolated` and `readyok`.
- **Accessibility — confirmed non-issue** (**nit**): `Board.tsx:225-425` uses real `button`s with `role=gridcell` + descriptive `aria-label`, `role=grid/row`, and `role=status` hints. The only gap is no keyboard equivalent for drag placement/targeting (`onKeyDown` count 0). No action needed for the prototype.
- Noted-but-not-deep-reviewed from earlier parts: AI difficulty wiring, the (nonexistent) curse-AI layer, dev-sandbox undeclared variants, production headers, and a missing React error boundary.

---

## Prioritized Action List

1. **Fix SSH Tunnel teleport** (`effectHandlers.ts:583-596`, `sideEffects.ts:157-171`): stop logging the own piece as destroyed (no phantom resurrect / second king) and relocate its statuses.
2. **Scale AI difficulty by match/act/ascension** (`stockfish.ts:478`, `useAiLoop.ts:170`) — the single biggest difficulty-curve fix; prefer Skill Level / UCI_Elo.
3. **Fix the "+1 Draw" boss boon** to use `draw-per-turn-bonus` (`run.ts:331-339`) — it currently does not do what its label says.
4. **Guard Sanctuary/Shield against en passant** (`rules.ts:555`) using `m.epVictim ?? m.to`; add a regression test.
5. **Clear statuses on Bit Flip / convert-piece** (`sideEffects.ts:278-283`) so converted pieces aren't hampered by stale enemy debuffs.
6. **Test the `sacrifice-detonate` adjacency + drawCount** core (`effectHandlers.ts:544-562`) and **fix the no-op "Self Destruct" test** (`match.test.ts:191`).
7. **Add `useAiLoop` boss/Echo/void/fallback tests** (`useAiLoop.ts:206-306`) — guards against AI-turn infinite loops and "thinking…" lockups.
8. **Resolve the artifact slot cap** (5 vs 20) (`types.ts:727`) and enforce it in `pickBossArtifact` (`run.ts:285-287`).
9. **Implement feat/performance gold** in `applyMatchOutcome` (`run.ts:184-201`) to loosen the one-dimensional economy.
10. **Wire `run.ascension` into at least one modifier** (shop pricing and/or AI depth) (`types.ts:554`) — or hide Ascension and mark it unbuilt.
11. **Reconcile `starter-deck.md` and top-level docs** with code (missing cards, obsolete card/energy/hand model, deck count, Skirmish enabled).
12. **Add `cardValidator.test.ts` and `targeting.test.ts`** — gatekeepers with high blast radius and no direct coverage.
13. **Tune cheap board-clear/tempo cards** (Self-Destruct cost 2, Overclock+ 4) and add an anti-tempo counter (Rate Limiter).
14. **Author the unused-system content**: 2–3 player-applied status cards, 2–3 board square-effect cards, and more zone/sacrifice/summon support to make those built systems live.
15. **Extract shared coord/geometry + `PIECE_VALUE` modules** (`rules.ts:36-50`, the 4 piece-value tables) and add engine tests for draw rules / en passant / underpromotion.