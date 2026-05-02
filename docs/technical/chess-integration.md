# Chess Integration (chess.js + extension layer)

We use **chess.js** as the underlying chess rule engine and wrap it with a thin extension layer that:

- Adds **walls** to the legal-move calculation.
- Adds **square effects** as triggers (no rule change to chess.js, just hooks).
- Adds **per-piece move-set extensions** (e.g., "your knights may move 1 square diagonally for this turn") by augmenting move generation.
- Adds **zone-control buff** resolution at start-of-turn.

We **do not fork chess.js**. We wrap it.

## The wrapper

```ts
// game/chess/engine.ts (sketch)

import { Chess } from "chess.js";

export class ChoseEngine {
  private chess: Chess;
  private overlays: BoardOverlays;
  private extensions: MoveExtensions;

  constructor(fen?: string, overlays?: BoardOverlays) { ... }

  // Mostly delegate:
  fen(): string { return this.chess.fen(); }
  inCheck(): boolean { return this.chess.in_check(); }
  isCheckmate(): boolean { return this.chess.in_checkmate(); }
  isStalemate(): boolean { return this.chess.in_stalemate(); }
  isDraw(): boolean { return this.chess.in_draw(); }

  // Override / extend:
  legalMoves(): Move[] { ... }      // chess.js moves filtered by walls + augmented by extensions
  move(m: Move): MoveResult { ... } // applies move, fires square-effect triggers, updates overlays
  setOverlays(o: BoardOverlays) { ... }
  setExtensions(e: MoveExtensions) { ... }
}
```

## Walls in legal-move calculation

chess.js does not know about walls. We integrate by:

1. Generate raw moves from chess.js.
2. **Filter** out any move whose destination square is walled.
3. For sliding pieces (bishop, rook, queen), additionally filter out moves whose **path** crosses a walled square. (chess.js doesn't expose path data directly, so we re-derive paths from origin/destination.)
4. **Knights:** only filter destination (knights jump over pieces; they also "jump over" walls but cannot LAND on them).
5. **King castling:** disallow castling if any of the king's transit squares are walled.
6. **En passant:** disallow if the en-passant target square is walled.
7. **Check evaluation:** when chess.js evaluates "is this square attacked?", it computes ray attacks. Our wrapper must override that calculation to treat walls as friendly blockers (so a queen's attack ray stops at a walled square). We may need to fork chess.js's check logic OR re-implement attack-ray detection in the wrapper.

The simplest implementation: **after generating moves, check each move's legality against our wall map.** This handles 1–4 cleanly. For #7 (check evaluation), we either:

- Re-implement an attack-ray check in the wrapper (small, well-defined function), OR
- Use chess.js to test "make this move and see if king is in check" against a clone of the board where walls are temporarily represented as opaque pieces.

Recommended: the second approach (clone-and-test) is simpler at the cost of slightly worse perf. Acceptable for a turn-based prototype.

## Move extensions (cards changing piece behavior)

A card might say "your knight may also move 1 square diagonally this turn." This adds **moves** that chess.js wouldn't generate. We handle these by:

1. Maintaining a `MoveExtensions` set of active extensions for the current turn.
2. After getting raw moves from chess.js, **add** any extension-generated moves.
3. Validate each extension move against the rest of the rules (no self-check, can't land on a friendly piece, walls, etc.).
4. When a move is executed, if it was an extension move, apply it manually to chess.js via FEN reconstruction or via the lower-level `chess.put` / `chess.remove` operations. (chess.js is somewhat permissive about FEN setting, which we exploit.)

Extensions expire at end-of-turn unless the card text says otherwise.

## Square effects

Square effects are NOT rule extensions; they are **triggers**. A square effect like "if a friendly piece ends here, draw a card" doesn't change move legality — it just fires an effect when the move is executed.

Implementation:

- Maintain a list of square effects in `BoardOverlays`.
- After `engine.move(m)`, iterate active square effects and check whether any are triggered by this move.
- Fire triggers, possibly updating game state (drawing a card, gaining energy, etc.).

Square effects can also have **per-turn ticks** (e.g., a "burning" square that does damage at the end of every turn it's stood on). Implement these as start-of-turn / end-of-turn hooks on the square effect.

## Zone-control buffs

Zone buffs are computed at **start of turn**. The wrapper exposes a `controlledRegions(side)` helper that takes a region definition (a set of squares) and returns whether `side` controls it.

A region is "controlled" by a side iff all (or, for some buff types, the majority of) squares in the region are occupied by that side's pieces.

The buff list is processed at start-of-turn:

1. For each active zone buff, evaluate the region's controller.
2. Apply the buff's effect to the controller (e.g., +1 energy, modify a piece's move, etc.).
3. Track which buffs are active so they can be reflected in the UI sidebar.

Zone buffs do not affect chess.js's legal-move calculation directly; if a buff says "your pawns may move 2 squares from any square", the move-extension system (above) handles it.

## FEN, PGN, and serialization

- We serialize a match state with `chess.fen()` PLUS our overlays (walls, square effects, extensions, zone buffs) PLUS our deck/hand/discard state.
- We **do not** rely on PGN. PGN is too lossy for our state (no walls, no card history).
- Our save format is a **single JSON blob** — see `persistence.md`.

## Testing

Unit tests for the wrapper should cover:

- Wall blocks bishop's diagonal path.
- Wall blocks king from castling through it.
- Walls treated as friendly blockers in check evaluation (queen's attack ray stops at wall).
- Knight cannot land on a walled square but can pass over it.
- Extension move (e.g., "knight moves diagonally") is offered when extension active, vanishes when extension expires.
- Square effect fires on entering target square, not on passing through.
- Zone-control buff applies when region is controlled, deactivates when control lost.

These should all pass before we layer card UI on top.

## Known sharp edges

- **chess.js immutability:** chess.js mutates its internal state. Our wrapper must clone aggressively when we want to test moves without committing them. The `Chess` class supports `chess.fen()` round-trips, so we can clone via FEN.
- **Castling rights:** chess.js tracks castling rights internally via the FEN. If we Skirmish-place a king and rook on standard squares, we may need to **manually edit the FEN** to set castling rights (chess.js loads them from FEN).
- **Promotion:** when our extensions allow custom promotion behavior (e.g., promote at rank 6), we manually intercept the move before passing to chess.js — promote the pawn ourselves and then construct a plain non-promotion move for chess.js to apply.

These edge cases will surface during implementation. Document them in code comments and update this doc when discovered.
