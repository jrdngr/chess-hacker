import { describe, expect, it } from "vitest";

import { ChoseEngine } from "../../game/chess/engine";
import { createMatchCardState, makeRng } from "../../game/cards/match";
import type { MatchCardState, Trap } from "../../game/types";

import { applyCardSideEffects, resolveTrapForMove } from "./sideEffects";

function freshState(): MatchCardState {
  const rng = makeRng(1);
  return createMatchCardState([], rng);
}

function withTraps(state: MatchCardState, traps: Trap[]): MatchCardState {
  return { ...state, traps };
}

describe("Rollback (undo-last-enemy-move side effect)", () => {
  it("walks the opponent's piece back to its origin square", () => {
    const e = new ChoseEngine();
    e.move({ from: "e2", to: "e4" }); // player
    e.move({ from: "e7", to: "e5" }); // opponent
    expect(e.pieceAt("e5")?.side).toBe("opponent");

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );

    expect(e.pieceAt("e5")).toBeNull();
    expect(e.pieceAt("e7")).toEqual({ type: "pawn", side: "opponent" });
  });

  it("preserves the current side-to-move (the player keeps their action)", () => {
    const e = new ChoseEngine();
    e.move({ from: "e2", to: "e4" }); // player
    e.move({ from: "e7", to: "e5" }); // opponent — turn flips back to player
    expect(e.turn()).toBe("player");

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );

    expect(e.turn()).toBe("player");
  });

  it("leaves engine history intact (the opponent's ghost move stays in the log)", () => {
    const e = new ChoseEngine();
    e.move({ from: "e2", to: "e4" });
    e.move({ from: "e7", to: "e5" });
    const beforeHistory = e.lastMove();
    expect(beforeHistory).toEqual({ from: "e7", to: "e5" });

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );

    expect(e.lastMove()).toEqual({ from: "e7", to: "e5" });
  });

  it("restores a captured player piece to its own square", () => {
    // Player pawn on e3, opponent pawn on d4, opponent to move and capture.
    const e = new ChoseEngine("4k3/8/8/8/3p4/4P3/8/4K3 b - - 0 1");
    e.move({ from: "d4", to: "e3" }); // opponent takes player pawn
    expect(e.pieceAt("e3")).toEqual({ type: "pawn", side: "opponent" });

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );

    expect(e.pieceAt("d4")).toEqual({ type: "pawn", side: "opponent" });
    expect(e.pieceAt("e3")).toEqual({ type: "pawn", side: "player" });
  });

  it("reverses an opponent promotion: the promoted queen becomes a pawn back on its origin", () => {
    // Opponent pawn on a2, opponent to move; promotes on a1.
    const e = new ChoseEngine("4k2K/8/8/8/8/8/p7/8 b - - 0 1");
    e.move({ from: "a2", to: "a1" });
    expect(e.pieceAt("a1")).toEqual({ type: "queen", side: "opponent" });

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );

    expect(e.pieceAt("a1")).toBeNull();
    expect(e.pieceAt("a2")).toEqual({ type: "pawn", side: "opponent" });
  });

  it("reverses opponent castling: rook returns to its corner alongside the king", () => {
    const e = new ChoseEngine("r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1");
    e.move({ from: "e8", to: "g8" });
    expect(e.pieceAt("g8")?.type).toBe("king");
    expect(e.pieceAt("f8")?.type).toBe("rook");

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );

    expect(e.pieceAt("e8")?.type).toBe("king");
    expect(e.pieceAt("h8")?.type).toBe("rook");
    expect(e.pieceAt("g8")).toBeNull();
    expect(e.pieceAt("f8")).toBeNull();
  });

  it("does nothing when the most recent move was the player's", () => {
    const e = new ChoseEngine();
    e.move({ from: "e2", to: "e4" });
    expect(e.pieceAt("e4")?.side).toBe("player");

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );

    expect(e.pieceAt("e4")?.side).toBe("player");
    expect(e.pieceAt("e2")).toBeNull();
  });

  it("does nothing when the engine has no history", () => {
    const e = new ChoseEngine();
    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );
    expect(e.fen()).toBe(new ChoseEngine().fen());
  });
});

describe("resolveTrapForMove — intermediate-square interception preserves the target", () => {
  // The bug: an enemy bishop sliding through a Honeypot (freeze) trap to
  // capture a player bishop would still capture it, even though the bishop
  // never reached the target square. Same problem for capture and push traps.
  // Fix: when the trap fires on an intermediate path square, the would-be
  // captured piece on `to` is restored.

  it("freeze trap on the path: target piece on `to` is preserved", () => {
    // Black bishop on a1 sliding to e5 (path: b2, c3, d4, e5). Honeypot on c3.
    // White (player) bishop on e5 — black is trying to capture it.
    const e = new ChoseEngine("4k3/8/8/4B3/8/8/8/b3K3 b - - 0 1");
    const mover = e.pieceAt("a1")!;
    const captured = e.pieceAt("e5");
    expect(captured?.side).toBe("player");

    e.move({ from: "a1", to: "e5" });
    const state = withTraps(freshState(), [{ square: "c3", effect: "freeze", expiresOnTurn: 99 }]);
    resolveTrapForMove(e, state, mover, "a1", "e5", captured);

    // Black bishop is frozen on c3 (the trap square), not on e5.
    expect(e.pieceAt("c3")).toEqual({ type: "bishop", side: "opponent" });
    expect(e.pieceAt("e5")).toEqual({ type: "bishop", side: "player" });
    expect(e.pieceAt("a1")).toBeNull();
  });

  it("capture trap on the path: target piece on `to` is preserved", () => {
    // Black rook on h8 sliding to h1 (path includes h4). Logic Bomb on h4.
    // White rook on h1 — the trap should destroy the black rook before it
    // can capture the white rook.
    const e = new ChoseEngine("4k2r/8/8/8/8/8/8/4K2R b - - 0 1");
    const mover = e.pieceAt("h8")!;
    const captured = e.pieceAt("h1");
    expect(captured?.side).toBe("player");

    e.move({ from: "h8", to: "h1" });
    const state = withTraps(freshState(), [{ square: "h4", effect: "capture", expiresOnTurn: 99 }]);
    resolveTrapForMove(e, state, mover, "h8", "h1", captured);

    // Black rook destroyed; white rook still on h1.
    expect(e.pieceAt("h1")).toEqual({ type: "rook", side: "player" });
    expect(e.pieceAt("h8")).toBeNull();
    // Black rook isn't anywhere on the board.
    for (const r of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sq = `h${r}` as const;
      expect(e.pieceAt(sq)?.side === "opponent").toBe(false);
    }
  });

  it("push trap on the path: target piece on `to` is preserved", () => {
    // Black bishop on a1 sliding to d4 capturing a player piece (path: b2, c3, d4).
    // Connection Reset on c3 — bishop should be pushed back to b2 and the
    // player piece on d4 should be safe.
    const e = new ChoseEngine("4k3/8/8/8/3P4/8/8/b3K3 b - - 0 1");
    const mover = e.pieceAt("a1")!;
    const captured = e.pieceAt("d4");
    expect(captured?.side).toBe("player");

    e.move({ from: "a1", to: "d4" });
    const state = withTraps(freshState(), [{ square: "c3", effect: "push", expiresOnTurn: 99 }]);
    resolveTrapForMove(e, state, mover, "a1", "d4", captured);

    // Black bishop pushed back to b2 (one square before the trap on c3).
    expect(e.pieceAt("b2")).toEqual({ type: "bishop", side: "opponent" });
    expect(e.pieceAt("d4")).toEqual({ type: "pawn", side: "player" });
    expect(e.pieceAt("a1")).toBeNull();
    expect(e.pieceAt("c3")).toBeNull();
  });

  it("trap on `to` itself: target IS captured (piece reached the square)", () => {
    // Sanity check: when the trap is at the destination, the moving piece
    // did successfully reach `to`, so any capture there stands. The trap
    // then fires post-arrival.
    // Black rook on h8 → h4 (path: h7..h4). Logic Bomb on h4 (the destination).
    // Player pawn on h4 — black rook captures it, then trap removes the rook.
    const e = new ChoseEngine("4k2r/8/8/8/7P/8/8/4K3 b - - 0 1");
    const mover = e.pieceAt("h8")!;
    const captured = e.pieceAt("h4");
    expect(captured?.side).toBe("player");

    e.move({ from: "h8", to: "h4" });
    const state = withTraps(freshState(), [{ square: "h4", effect: "capture", expiresOnTurn: 99 }]);
    resolveTrapForMove(e, state, mover, "h8", "h4", captured);

    // Both pieces gone — pawn captured by rook, rook captured by trap.
    expect(e.pieceAt("h4")).toBeNull();
    expect(e.pieceAt("h8")).toBeNull();
  });
});

describe("Rollback + dev-panel undo interaction", () => {
  it("restoring an engine snapshot taken before Rollback returns to the post-AI-move state", () => {
    // Reproduce the user's bug scenario: player saves a snapshot at the
    // start of their turn (after AI's move applied), plays Rollback,
    // makes a chess move, then walks back via snapshot restore.
    const e = new ChoseEngine();
    e.move({ from: "e2", to: "e4" });
    e.move({ from: "e7", to: "e5" });
    // Snapshot the state at the start of the player's next turn.
    const snap = e.snapshot();

    // Player plays Rollback during their turn (board reverts; history kept).
    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "undo-last-enemy-move" }],
      Math.random,
      () => {},
    );
    // Player makes a fresh chess move from the rolled-back state.
    e.move({ from: "g1", to: "f3" });

    // Now click Undo: restore the start-of-turn snapshot.
    e.restore(snap);
    // We're back to the state the snapshot captured — black pawn on e5,
    // white pieces in their post-e4 positions, white to move.
    expect(e.pieceAt("e5")?.side).toBe("opponent");
    expect(e.pieceAt("e4")?.side).toBe("player");
    expect(e.pieceAt("f3")).toBeNull();
    expect(e.turn()).toBe("player");
  });
});
