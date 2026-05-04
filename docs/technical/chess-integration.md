# Chess Engine

The chess rules + board state live in **`src/game/chess/`**, a custom in-repo engine. We originally planned to wrap chess.js (and tried it). chess.js was replaced because **wall-aware move generation** needs to participate in attacker-set computation and check evaluation — not just post-filter the move list — and chess.js doesn't expose those internals cleanly. See `stack.md` for the rationale.

The engine is split into two files:

| File | Role |
|---|---|
| `src/game/chess/rules.ts` | Pure rule layer. Move generation, check / mate / stalemate, attacker sets, FEN parse / serialize. |
| `src/game/chess/engine.ts` | `ChoseEngine` — stateful position + history + history-dependent rules (threefold repetition, 50-move). |

Both are pure TypeScript, no React or DOM. Tests in `rules.test.ts`, `engine.test.ts`, `effects.test.ts`.

## `ChoseEngine` — public surface

`engine.ts` exports a single class. Consumed by `Match.tsx` and the AI worker boundary.

```ts
class ChoseEngine {
  constructor(fen?: string);                                     // STARTING_FEN by default

  // Snapshots — used by the dev-mode undo/redo stack.
  snapshot(): EngineSnapshot;
  restore(s: EngineSnapshot): void;

  // Overlays — set every render before any rule query.
  setOverlays(
    walls: ReadonlySet<AlgebraicSquare>,
    freezes: ReadonlySet<AlgebraicSquare>,
    extra?: ExtraOverlays,                                        // roots, disarms, compels, shields, sanctuaries, empowers
  ): void;

  // Position queries.
  fen(): string;
  turn(): Side;
  pieceAt(sq: AlgebraicSquare): Piece | null;
  pieces(): Array<{ square: AlgebraicSquare; piece: Piece }>;
  isSquareAttackedBy(sq: AlgebraicSquare, by: Side): boolean;
  attackedSquares(side: Side): Set<AlgebraicSquare>;

  // Move generation + application.
  legalMoves(from?: AlgebraicSquare): LegalMove[];
  move(m: EngineMove): LegalMove | null;                          // returns null if illegal
  lastMove(): { from; to } | null;

  // Card-driven board mutations (do NOT flip the turn or record history).
  placePiece(sq, piece): void;                                    // Summon
  removePiece(sq): Piece | null;                                  // Sacrifice / Trap-capture
  swapPieces(a, b): void;                                         // Switch Files
  displacePiece(from, to): void;                                  // Trap-push, illegal-bypassing move
  forceTurn(side): void;                                          // Haste / Lightning second action

  // Foreign moves — apply a move as if it were the *other* side's turn.
  foreignLegalMoves(from): LegalMove[];                           // Marionette enumeration
  applyForeignMove(m): LegalMove | null;                          // Marionette resolution

  // Outcome detection.
  inCheck(): boolean;
  outcome(): MatchOutcome;                                        // ongoing | checkmate | stalemate | draw{reason}
}
```

The engine is **mutable** — `move()`, `placePiece()`, etc. update internal `position` and `history`. `setOverlays()` takes a reference to externally-owned sets; the React layer recomputes them from `MatchCardState` and calls `setOverlays` before any rule query in the render pass.

## `rules.ts` — what's pure, and how overlays work

`rules.ts` is the rule layer. Every public function takes the immutable `Position` and an `Overlays` struct:

```ts
type Overlays = {
  walls: ReadonlySet<AlgebraicSquare>;
  freezes: ReadonlySet<AlgebraicSquare>;
  roots?: ReadonlySet<AlgebraicSquare>;
  disarms?: ReadonlySet<AlgebraicSquare>;
  compels?: ReadonlySet<AlgebraicSquare>;
  shields?: ReadonlySet<AlgebraicSquare>;
  sanctuaries?: ReadonlySet<AlgebraicSquare>;
  empowers?: ReadonlyMap<AlgebraicSquare, ReadonlySet<EmpowerPattern>>;
};
```

Public functions:

- `parseFen(fen)` / `serializeFen(position)` — FEN round-trip.
- `pseudoLegalMoves(position, overlays)` — every move the side-to-move could make ignoring self-check.
- `legalMoves(position, overlays, from?)` — pseudo-legal filtered by self-check rules. Includes castling, en-passant, promotion (defaults to queen).
- `isSquareAttacked(position, overlays, square, by)` — does `by` attack `square`? Walls block sliding rays; frozen / disarmed / shielded pieces don't attack (each rule is enforced uniformly here).
- `isInCheck(position, overlays)` — convenience over `isSquareAttacked` against the side-to-move's king.
- `applyMove(position, move)` — return the post-move position (immutable).
- `findKing(position, side)`, `movePath(pieceType, from, to)`, `squareCoords` / `squareName`, `isInsufficientMaterial(position)` — supporting utilities.

### How overlays affect each rule

| Overlay | Effect |
|---|---|
| **walls** | Sliding pieces (B/R/Q): block the ray at the wall (treated as a friendly blocker). Knights: cannot land on a walled square but can hop over. Pawns: cannot push or capture into one. King castling: cannot transit through a walled square. En-passant target: cannot land on a walled square. **Attack rays for check evaluation also stop at walls.** |
| **freezes** | A frozen piece generates no moves and is not counted as an attacker by `isSquareAttacked`. (Used for trap-freeze, Frostbite, etc.) |
| **roots** | An enemy rooted piece may move but **cannot capture** next turn. (Filter applied to its move generation.) |
| **disarms** | An enemy disarmed piece may move but **cannot capture** (similar to root, narrower duration / stacking). |
| **compels** | An enemy compelled piece **must move** — and the AI prefers a capture if one is available. (Affects move ordering, not legality, but combined with the curse-AI scheduler.) |
| **shields** | A shielded player piece **cannot be captured**. Enforced inside move generation: an enemy capture into a shielded square is filtered out. |
| **sanctuaries** | A piece on a sanctuary square cannot be captured (same enforcement, square-keyed). |
| **empowers** | Player piece gets an extra movement pattern (`pawn` / `knight` / `bishop` / `rook` / `queen`) in addition to its native moves. Enumerated at move generation. |

## Stockfish boundary

`src/ai/stockfish.ts` runs Stockfish.wasm in a Web Worker. The integration with the rule engine is intentionally **loosely coupled**:

1. `Match` asks the engine for `legalMoves()` (fully overlay-aware).
2. Each legal move is formatted as UCI (`legalMoveToUci`) and passed to Stockfish via the UCI `searchmoves` filter (`go depth N searchmoves e2e4 d2d4 ...`). This restricts Stockfish to our wall/freeze-aware move set at the root.
3. Stockfish replies with a UCI bestmove. `uciToMove` parses it.
4. `engine.move()` re-validates the move against `legalMoves()` and returns `null` if it doesn't match. The caller treats `null` as a fallback signal and plays a random legal move instead. (In practice this never happens during steady-state play, but guards against any race between position updates and Stockfish's reply.)

Stockfish itself **never sees the overlays**. The `searchmoves` filter is the entire integration surface — the engine doesn't need to know about cards or walls to play strong chess on the constrained move set.

Difficulty maps to depth (`depthForDifficulty`): `easy=2 / normal=6 / hard=10`. Per-move minimum think-time (`aiMinThinkMs`) prevents shallow depths from snap-moving and feeling jittery.

See `ai.md` for the curse-AI layer (boss curse-card insertion timing). That layer is deferred to M8 and does not exist in code today.

## Card-driven board mutations

Cards routinely move, place, remove, or swap pieces *outside* the chess move flow. The engine exposes plain mutators (`placePiece`, `removePiece`, `swapPieces`, `displacePiece`, `forceTurn`, `applyForeignMove`) that bypass the legal-move check but **also bypass turn flipping and history**. These are not "moves" in the chess sense — they're board edits driven by card resolution. The match layer composes them with the card resolver in `src/game/cards/match.ts` and the trap resolver in `src/components/Match.tsx` (currently `resolveTrapForMove`).

Two things this implies:

- These edits don't show up in `lastMove()` or in undo / redo at the chess-history granularity. The dev-mode undo / redo wraps them by snapshotting `engine` + `cardState` together at each turn (or each editor edit / energy bump) — see `dev-mode.md`.
- These edits won't auto-detect check / mate. Callers that mutate the board mid-card must re-query `engine.outcome()` after the card resolves.

## Move extensions (cards changing piece behavior)

Card-driven extra movement patterns (e.g., "your queen has knight moves this turn") are modeled as the **empowers** overlay — a per-square set of `EmpowerPattern` values. Move generation in `rules.ts` enumerates the native pattern *and* every empower pattern present on the from-square, then deduplicates. Empower entries are time-bounded (`expiresOnTurn`); single-use empowers (Soul cards) drop as soon as the player moves a different piece.

## Square effects

Square effects (sanctuary, trap) are stored in `MatchCardState.sanctuaries` and `MatchCardState.traps`. Sanctuary participates in move generation (capture filter). Trap is a **trigger**, not a rule — it fires when an enemy piece's path enters the trap square, after the chess move resolves. The trap resolver (`resolveTrapForMove` in `Match.tsx`) walks the path returned by `movePath`, fires the first trap hit, and either captures, freezes, or pushes the moved piece back along the path.

## Zone-control buffs (planned for M7)

Not implemented. Designed in `docs/design/board.md` and `docs/cards/keywords.md`. When implemented, they'll live as a sibling overlay on `MatchCardState` and be evaluated at start-of-turn (region controlled by side X → grant buff Y to a target). See `docs/roadmap/milestones.md` M7.

## Serialization

`engine.fen()` round-trips standard chess state. Card / overlay state lives in `MatchCardState` and is JSON-serializable directly. Save format (planned for M9) will be a single JSON blob: `{ version, run, match? }` — see `persistence.md`.

We do not use PGN.

## Testing

Unit tests cover every rule the engine enforces. The most important are in:

- `src/game/chess/rules.test.ts` — wall blocks bishop ray, wall blocks castling transit, knight cannot land on wall, en-passant target cannot be walled, attacker sets respect walls, frozen piece doesn't attack.
- `src/game/chess/engine.test.ts` — move application, history, repetition, foreign moves, displace.
- `src/game/chess/effects.test.ts` — overlay-driven legality (root, disarm, shield, sanctuary, empower).

Add new rule coverage here whenever a new overlay or move extension lands. The integration tests in `src/components/Match.test.tsx` cover the rule layer indirectly by playing through scripted scenarios.

## Known sharp edges

- **Engine is mutable.** `move()` mutates internal state. The dev-mode undo / redo relies on `snapshot()` / `restore()` rather than cloning.
- **Card-driven mutators bypass turn flipping.** Callers that need the turn to advance after a card-driven edit must call `forceTurn` or play a regular move.
- **Stockfish move legality fallback.** Defensive guard, not load-bearing — but if Stockfish returns a move outside `searchmoves`, the caller plays a random legal move instead of crashing. Watch for this in tests if you change the search-moves protocol.
- **Threefold repetition uses the position signature**, not the FEN. Castling rights and en-passant target are part of the signature.
