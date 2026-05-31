// Direct unit tests for individual effect handlers in applyEffect.
// These call applyEffect with a minimal BoardContext so we can pin
// behavior that is hard to reach through full playCard targeting.

import { describe, expect, it } from "vitest";

import { applyEffect } from "./effectHandlers";
import { createMatchCardState, makeRng } from "./match";
import type { PlayTarget } from "./match";
import { getCardById } from "./library";
import { emptyBoard } from "./match.testHelpers";
import type { CapturedPieceEntry } from "../types";

function baseState() {
  return createMatchCardState([], makeRng(1));
}

const twoSquares = (first: string, second: string): PlayTarget => ({
  kind: "two-squares",
  first,
  second,
});

describe("resurrect-piece (Git Revert) — index mapping (CH-004)", () => {
  it("removes the chosen player entry even when non-player entries are interleaved", () => {
    const captured: CapturedPieceEntry[] = [
      { type: "knight", side: "player", reason: "captured" }, // filtered idx 0
      { type: "pawn", side: "opponent", reason: "destroyed" }, // not shown to UI
      { type: "rook", side: "player", reason: "captured" }, // filtered idx 1
    ];
    const state = { ...baseState(), capturedPieces: captured, chosenCapturedIndex: 1 };

    const r = applyEffect(
      { kind: "resurrect-piece" },
      state,
      twoSquares("a1", "d1"),
      emptyBoard,
      makeRng(1),
      getCardById("git-revert"),
      0,
    );

    // The rook (filtered idx 1) is resurrected onto d1...
    expect(r.sideEffects).toEqual([{ kind: "place-piece", square: "d1", pieceType: "rook" }]);
    // ...and exactly that entry is removed from the pool — not the wrong one,
    // and not nothing (the pre-fix bug left the rook resurrectable forever).
    expect(r.state.capturedPieces).toEqual([
      { type: "knight", side: "player", reason: "captured" },
      { type: "pawn", side: "opponent", reason: "destroyed" },
    ]);
    expect(r.state.chosenCapturedIndex).toBeUndefined();
  });

  it("defaults to the most recent player capture when no index is chosen", () => {
    const captured: CapturedPieceEntry[] = [
      { type: "bishop", side: "player", reason: "captured" },
      { type: "queen", side: "player", reason: "captured" },
    ];
    const state = { ...baseState(), capturedPieces: captured };

    const r = applyEffect(
      { kind: "resurrect-piece" },
      state,
      twoSquares("a1", "d1"),
      emptyBoard,
      makeRng(1),
      getCardById("git-revert"),
      0,
    );

    expect(r.sideEffects).toEqual([{ kind: "place-piece", square: "d1", pieceType: "queen" }]);
    expect(r.state.capturedPieces).toEqual([
      { type: "bishop", side: "player", reason: "captured" },
    ]);
  });
});
