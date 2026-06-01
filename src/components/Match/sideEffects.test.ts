import { describe, expect, it, vi } from "vitest";

import { ChoseEngine } from "../../game/chess/engine";
import { createMatchCardState, makeRng } from "../../game/cards/match";
import { getArtifactById } from "../../game/artifacts/library";
import type { MatchCardState, Trap } from "../../game/types";

import { applyCardSideEffects, resolveSquareMarkForMove, resolveTrapForMove } from "./sideEffects";

describe("Garbage Collect (sweep)", () => {
  it("destroys every enemy non-king piece attacked by a player piece", () => {
    // White rooks on a1 + h1 attack the a- and h-files; the black pawns on
    // a5 and h5 are both directly attacked (they sit at the rooks' first
    // blocker). Black king on e8 is unrelated.
    const e = new ChoseEngine("4k3/8/8/p6p/8/8/8/R3K2R w - - 0 1");
    expect(e.pieceAt("a5")).not.toBeNull();
    expect(e.pieceAt("h5")).not.toBeNull();

    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "garbage-collect", recursive: false }],
      Math.random,
      () => {},
    );

    expect(e.pieceAt("a5")).toBeNull();
    expect(e.pieceAt("h5")).toBeNull();
    // King is never destroyed.
    expect(e.pieceAt("e8")).toEqual({ type: "king", side: "opponent" });
  });

  it("never destroys the enemy king", () => {
    // White rook on e1 directly attacks the black king on e8 — base wave
    // would target it, but the king must be excluded. (Kings only; no
    // other white pieces so the position is a checkmate-ish setup but
    // we only care that GC doesn't remove the king.)
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/4RK2 w - - 0 1");
    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "garbage-collect", recursive: true }],
      Math.random,
      () => {},
    );
    expect(e.pieceAt("e8")).toEqual({ type: "king", side: "opponent" });
  });

  it("recursive sweep chases discovered attacks; non-recursive stops after one wave", () => {
    // Setup: white rook on a1 attacks up the a-file. a2 black blocker is
    // initially attacked (the rook stops at a2). With a2 gone, a3 (which
    // is the next blocker, also black) becomes attacked. Recursive should
    // remove both; non-recursive should remove only a2.
    const fen = "4k2K/8/8/8/8/p7/p7/R7 w - - 0 1";

    const eNon = new ChoseEngine(fen);
    applyCardSideEffects(
      eNon,
      freshState(),
      [{ kind: "garbage-collect", recursive: false }],
      Math.random,
      () => {},
    );
    expect(eNon.pieceAt("a2")).toBeNull();
    expect(eNon.pieceAt("a3")).not.toBeNull();

    const eRec = new ChoseEngine(fen);
    applyCardSideEffects(
      eRec,
      freshState(),
      [{ kind: "garbage-collect", recursive: true }],
      Math.random,
      () => {},
    );
    expect(eRec.pieceAt("a2")).toBeNull();
    expect(eRec.pieceAt("a3")).toBeNull();
  });
});

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

describe("boss survey / audit side effects (CH-056)", () => {
  it("place-wall-random adds a permanent wall on an empty player-half square", () => {
    // 8×8, only kings present. Player half = ranks 1..4.
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "place-wall-random" }],
      makeRng(1),
      () => {},
    );
    expect(next.walls).toHaveLength(1);
    const wall = next.walls[0];
    expect(wall.permanent).toBe(true);
    expect(Number(wall.square.slice(1))).toBeLessThanOrEqual(4); // player half
    expect(e.pieceAt(wall.square)).toBeNull(); // empty square
  });

  it("disarm-random-player-non-pawn disarms a player non-pawn (not a pawn)", () => {
    // Player has a knight on b1 and a pawn on a2; only the knight is eligible.
    const e = new ChoseEngine("4k3/8/8/8/8/8/P7/1N2K3 w - - 0 1");
    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "disarm-random-player-non-pawn", expiresOnTurn: 5 }],
      makeRng(1),
      () => {},
    );
    const disarmed = next.disarms.map((d) => d.square);
    expect(disarmed).not.toContain("a2"); // pawn never chosen
    // a non-pawn player piece (b1 knight or e1 king) is disarmed
    expect(next.disarms.length).toBe(1);
    expect(["b1", "e1"]).toContain(next.disarms[0].square);
    expect(next.disarms[0]).toMatchObject({ side: "player", expiresOnTurn: 5 });
  });
});

describe("Hive Mind — first summoned pawn each turn gains Shield", () => {
  it("shields the first place-piece pawn and not the second", () => {
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    const state: MatchCardState = {
      ...freshState(),
      turn: 3,
      artifacts: [getArtifactById("hive-mind")],
    };
    const next = applyCardSideEffects(
      e,
      state,
      [
        { kind: "place-piece", square: "d3", pieceType: "pawn" },
        { kind: "place-piece", square: "e3", pieceType: "pawn" },
      ],
      makeRng(1),
      () => {},
    );
    expect(next.shields.some((s) => s.square === "d3")).toBe(true);
    expect(next.shields.some((s) => s.square === "e3")).toBe(false);
    expect(next.firstSummonShieldUsedThisTurn).toBe(true);
  });
});

describe("afflict-random-enemy side effect (Worm / Rootkit)", () => {
  it("freezes a random enemy piece on the opponent's side", () => {
    // Only one opponent piece (knight on d5) besides the king, so the random
    // pick is deterministic enough to assert.
    const e = new ChoseEngine("4k3/8/8/3n4/8/8/8/4K3 w - - 0 1");
    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "afflict-random-enemy", status: "freeze", minorOnly: true, expiresOnTurn: 7 }],
      makeRng(1),
      () => {},
    );
    // Exactly one opponent minor exists (the knight); it must be the one frozen.
    expect(next.freezes).toContainEqual({ square: "d5", side: "opponent", expiresOnTurn: 7 });
  });

  it("no-ops when the enemy has no eligible piece", () => {
    // minorOnly with no enemy minors → nothing frozen.
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "afflict-random-enemy", status: "freeze", minorOnly: true, expiresOnTurn: 7 }],
      makeRng(1),
      () => {},
    );
    expect(next.freezes).toEqual([]);
  });
});

describe("resolveSquareMarkForMove — Repulsor Field", () => {
  it("pushes an enemy piece that ends on the mark one rank back toward its own side", () => {
    // Black knight on d5 moves to e3 (a player-side advance). A player repulsor
    // sits on e3; the knight should be shoved back to e4 (toward black's home).
    const e = new ChoseEngine("4k3/8/8/3n4/8/8/8/4K3 b - - 0 1");
    const mover = e.pieceAt("d5")!;
    e.move({ from: "d5", to: "e3" });
    expect(e.pieceAt("e3")).toEqual({ type: "knight", side: "opponent" });

    const state: MatchCardState = {
      ...freshState(),
      squareMarks: [{ square: "e3", kind: "repulsor", side: "player", expiresOnTurn: 99 }],
    };
    resolveSquareMarkForMove(e, state, mover, "e3");

    expect(e.pieceAt("e3")).toBeNull();
    expect(e.pieceAt("e4")).toEqual({ type: "knight", side: "opponent" });
  });

  it("does not consume the mark, and fizzles if the push target is occupied", () => {
    // Knight pushed back would land on e4, but a black pawn already sits there.
    const e = new ChoseEngine("4k3/8/8/3n4/4p3/8/8/4K3 b - - 0 1");
    const mover = e.pieceAt("d5")!;
    e.move({ from: "d5", to: "e3" });

    const mark = {
      square: "e3" as const,
      kind: "repulsor" as const,
      side: "player" as const,
      expiresOnTurn: 99,
    };
    const state: MatchCardState = { ...freshState(), squareMarks: [mark] };
    const next = resolveSquareMarkForMove(e, state, mover, "e3");

    // Push fizzled — knight stays on e3 — and the mark persists.
    expect(e.pieceAt("e3")).toEqual({ type: "knight", side: "opponent" });
    expect(next.squareMarks).toContainEqual(mark);
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

describe("move-piece (SSH Tunnel teleport)", () => {
  it("relocates the piece without recording a destroyed piece", () => {
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/B3K3 w - - 0 1");
    expect(e.pieceAt("a1")).toEqual({ type: "bishop", side: "player" });

    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "move-piece", from: "a1", to: "d4" }],
      Math.random,
      () => {},
    );

    expect(e.pieceAt("a1")).toBeNull();
    expect(e.pieceAt("d4")).toEqual({ type: "bishop", side: "player" });
    // The teleported piece must NOT be recorded as destroyed (regression:
    // remove+place used to push a phantom captured entry, see CH-001).
    expect(next.capturedPieces ?? []).toEqual([]);
  });

  it("carries the piece's statuses (Shield) to the destination square", () => {
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/B3K3 w - - 0 1");
    const state: MatchCardState = {
      ...freshState(),
      shields: [{ square: "a1", side: "player", expiresOnTurn: 99 }],
    };

    const next = applyCardSideEffects(
      e,
      state,
      [{ kind: "move-piece", from: "a1", to: "d4" }],
      Math.random,
      () => {},
    );

    // Shield travels with the piece — not stripped, not left on the origin.
    expect(next.shields).toEqual([{ square: "d4", side: "player", expiresOnTurn: 99 }]);
  });
});

describe("card-destruction capture counter (CH-006)", () => {
  it("remove-piece on an enemy piece increments playerCaptureCount by 1", () => {
    const e = new ChoseEngine("4k3/8/8/8/3n4/8/8/4K3 w - - 0 1");
    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "remove-piece", square: "d4" }],
      Math.random,
      () => {},
    );
    expect(next.playerCaptureCount).toBe(1);
  });

  it("garbage-collect increments playerCaptureCount by the number of victims", () => {
    // Two black pawns (a5, h5) attacked by white rooks; both destroyed.
    const e = new ChoseEngine("4k3/8/8/p6p/8/8/8/R3K2R w - - 0 1");
    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "garbage-collect", recursive: false }],
      Math.random,
      () => {},
    );
    expect(next.playerCaptureCount).toBe(2);
  });

  it("removing an own piece does not increment the capture counter", () => {
    const e = new ChoseEngine("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    const next = applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "remove-piece", square: "d4" }],
      Math.random,
      () => {},
    );
    expect(next.playerCaptureCount ?? 0).toBe(0);
  });
});

describe("convert-piece (Bit Flip)", () => {
  it("converts the enemy piece to the player's side", () => {
    const e = new ChoseEngine("4k3/8/8/8/3n4/8/8/4K3 w - - 0 1");
    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "convert-piece", square: "d4" }],
      Math.random,
      () => {},
    );
    expect(e.pieceAt("d4")).toEqual({ type: "knight", side: "player" });
  });

  it("clears enemy-applied statuses (freeze) off the converted piece", () => {
    const e = new ChoseEngine("4k3/8/8/8/3n4/8/8/4K3 w - - 0 1");
    const state: MatchCardState = {
      ...freshState(),
      freezes: [{ square: "d4", side: "opponent", expiresOnTurn: 99 }],
    };

    const next = applyCardSideEffects(
      e,
      state,
      [{ kind: "convert-piece", square: "d4" }],
      Math.random,
      () => {},
    );

    // The freeze applied to the enemy minor before Bit Flip must not persist
    // and suppress the player's newly-acquired piece (CH-002).
    expect(next.freezes).toEqual([]);
  });
});

describe("swap-pieces promotion", () => {
  it("triggers onTransformPrompt when a pawn lands on its promotion rank", () => {
    // White pawn on e7, white rook on e1. Swapping puts the pawn on e1
    // (no promotion) and the rook on e7 (not a pawn — no promotion).
    // White pawn on a1, white knight on a8. Swapping puts the pawn on
    // a8 (rank 8 = promotion rank for player).
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/P3K3 w - - 0 1");
    e.placePiece("a8", { type: "knight", side: "player" });

    const onTransform = vi.fn();
    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "swap-pieces", a: "a1", b: "a8" }],
      Math.random,
      () => {},
      onTransform,
    );

    expect(onTransform).toHaveBeenCalledWith("a8", ["queen", "rook", "bishop", "knight"]);
  });

  it("does not trigger promotion for non-pawn pieces on the back rank", () => {
    // White rook on a1, white bishop on a8. Swap puts non-pawn pieces
    // on back ranks — no promotion should fire.
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    e.placePiece("a8", { type: "bishop", side: "player" });

    const onTransform = vi.fn();
    applyCardSideEffects(
      e,
      freshState(),
      [{ kind: "swap-pieces", a: "a1", b: "a8" }],
      Math.random,
      () => {},
      onTransform,
    );

    expect(onTransform).not.toHaveBeenCalled();
  });
});
