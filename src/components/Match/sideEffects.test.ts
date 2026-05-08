import { describe, expect, it } from "vitest";

import { ChoseEngine } from "../../game/chess/engine";
import { createMatchCardState, makeRng } from "../../game/cards/match";
import type { MatchCardState } from "../../game/types";

import { applyCardSideEffects } from "./sideEffects";

function freshState(): MatchCardState {
  const rng = makeRng(1);
  return createMatchCardState([], rng);
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
