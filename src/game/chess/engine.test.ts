import { describe, expect, it } from "vitest";

import { ChoseEngine, movePath, squareCoords, squareName } from "./engine";

describe("ChoseEngine", () => {
  it("starts in the standard initial position with white to move", () => {
    const e = new ChoseEngine();
    expect(e.turn()).toBe("player");
    expect(e.pieceAt("e1")).toEqual({ type: "king", side: "player" });
    expect(e.pieceAt("d8")).toEqual({ type: "queen", side: "opponent" });
    expect(e.pieceAt("e4")).toBeNull();
    expect(e.outcome()).toEqual({ kind: "ongoing" });
  });

  it("enumerates 20 legal moves at the start", () => {
    const e = new ChoseEngine();
    expect(e.legalMoves()).toHaveLength(20);
  });

  it("filters legal moves by source square", () => {
    const e = new ChoseEngine();
    const moves = e.legalMoves("e2");
    expect(moves.map((m) => m.to).sort()).toEqual(["e3", "e4"]);
  });

  it("applies a legal move and switches the side to move", () => {
    const e = new ChoseEngine();
    const m = e.move({ from: "e2", to: "e4" });
    expect(m).not.toBeNull();
    expect(m?.san).toBe("e4");
    expect(e.turn()).toBe("opponent");
  });

  it("returns null for illegal moves rather than throwing", () => {
    const e = new ChoseEngine();
    expect(e.move({ from: "e2", to: "e5" })).toBeNull();
    expect(e.turn()).toBe("player"); // unchanged
  });

  it("detects checkmate and identifies the winner (Fool's Mate)", () => {
    const e = new ChoseEngine();
    // 1.f3 e5 2.g4 Qh4#
    expect(e.move({ from: "f2", to: "f3" })).not.toBeNull();
    expect(e.move({ from: "e7", to: "e5" })).not.toBeNull();
    expect(e.move({ from: "g2", to: "g4" })).not.toBeNull();
    expect(e.move({ from: "d8", to: "h4" })).not.toBeNull();
    expect(e.outcome()).toEqual({ kind: "checkmate", winner: "opponent" });
  });

  it("detects stalemate", () => {
    // K vs K+Q stalemate: black king on a8, white king on c7, white queen on g6 — black to move.
    const e = new ChoseEngine("k7/8/2K5/8/8/8/8/6Q1 b - - 0 1");
    // Move the queen to c8 — wait, position above is already stalemate? Let me set a known stalemate FEN.
    // Use the classic stalemate: black king a8, white queen b6, white king c6, black to move.
    const stalemate = new ChoseEngine("k7/8/1QK5/8/8/8/8/8 b - - 0 1");
    expect(stalemate.outcome()).toEqual({ kind: "stalemate" });
    expect(e.outcome().kind).not.toBe("checkmate");
  });

  it("detects draw by insufficient material (K vs K)", () => {
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(e.outcome()).toEqual({ kind: "draw", reason: "insufficient-material" });
  });

  it("treats a missing king as a king-capture win for the surviving side", () => {
    // Card-driven moves can capture the king (the standard legality filter
    // never permits this, but an empowered piece bypassing those rules can).
    // The side that still has a king wins.
    const blackKingMissing = new ChoseEngine("8/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(blackKingMissing.outcome()).toEqual({ kind: "king-captured", winner: "player" });

    const whiteKingMissing = new ChoseEngine("4k3/8/8/8/8/8/8/8 w - - 0 1");
    expect(whiteKingMissing.outcome()).toEqual({ kind: "king-captured", winner: "opponent" });
  });

  it("does not report stalemate for a king-less board with no moves (CH-008)", () => {
    // The empty placement board: both sides king-less, no pieces, no legal
    // moves. This must NOT be a false stalemate (draw) — it is an in-progress
    // placement state, reported as ongoing.
    const empty = new ChoseEngine("8/8/8/8/8/8/8/8 w - - 0 1");
    expect(empty.outcome()).toEqual({ kind: "ongoing" });
  });

  it("still reports stalemate when the side to move HAS a king (CH-008)", () => {
    // Guard against over-correcting: a genuine stalemate (side to move has a
    // king, not in check, no legal moves) is still a stalemate.
    const stalemate = new ChoseEngine("k7/8/1QK5/8/8/8/8/8 b - - 0 1");
    expect(stalemate.outcome()).toEqual({ kind: "stalemate" });
  });

  it("capturedPieces() partitions captures by captor side", () => {
    const e = new ChoseEngine();
    expect(e.capturedPieces()).toEqual({ byPlayer: [], byOpponent: [] });
    // 1.e4 d5 2.exd5 (white takes black pawn) Qxd5 (black queen takes white pawn)
    e.move({ from: "e2", to: "e4" });
    e.move({ from: "d7", to: "d5" });
    e.move({ from: "e4", to: "d5" });
    e.move({ from: "d8", to: "d5" });
    const cap = e.capturedPieces();
    expect(cap.byPlayer).toEqual([{ type: "pawn", side: "opponent" }]);
    expect(cap.byOpponent).toEqual([{ type: "pawn", side: "player" }]);
  });

  it("lastMove() reports the most recently played move", () => {
    const e = new ChoseEngine();
    expect(e.lastMove()).toBeNull();
    e.move({ from: "e2", to: "e4" });
    expect(e.lastMove()).toEqual({ from: "e2", to: "e4" });
    e.move({ from: "c7", to: "c5" });
    expect(e.lastMove()).toEqual({ from: "c7", to: "c5" });
  });

  it("castles kingside via king-from / king-to (e1 -> g1)", () => {
    const e = new ChoseEngine("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const moves = e.legalMoves("e1");
    expect(moves.some((m) => m.to === "g1" && m.isCastle)).toBe(true);
    const res = e.move({ from: "e1", to: "g1" });
    expect(res?.isCastle).toBe(true);
    expect(e.pieceAt("g1")).toEqual({ type: "king", side: "player" });
    expect(e.pieceAt("f1")).toEqual({ type: "rook", side: "player" });
    expect(e.pieceAt("e1")).toBeNull();
    expect(e.pieceAt("h1")).toBeNull();
  });

  it("castles queenside via king-from / king-to (e1 -> c1)", () => {
    const e = new ChoseEngine("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const res = e.move({ from: "e1", to: "c1" });
    expect(res?.isCastle).toBe(true);
    expect(e.pieceAt("c1")).toEqual({ type: "king", side: "player" });
    expect(e.pieceAt("d1")).toEqual({ type: "rook", side: "player" });
    expect(e.pieceAt("a1")).toBeNull();
  });

  it("rejects king-onto-rook (e1 -> h1) — that is not how castling is encoded", () => {
    const e = new ChoseEngine("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const res = e.move({ from: "e1", to: "h1" });
    expect(res).toBeNull();
  });

  it("auto-promotes pawns to queen by default", () => {
    const e = new ChoseEngine("8/P7/8/8/8/8/8/4k2K w - - 0 1");
    const m = e.move({ from: "a7", to: "a8" });
    expect(m?.isPromotion).toBe(true);
    expect(e.pieceAt("a8")).toEqual({ type: "queen", side: "player" });
  });
});

describe("square helpers", () => {
  it("round-trips file/rank ↔ algebraic", () => {
    expect(squareName(0, 0)).toBe("a1");
    expect(squareName(7, 7)).toBe("h8");
    expect(squareName(4, 3)).toBe("e4");
    expect(squareCoords("a1")).toEqual({ file: 0, rank: 0 });
    expect(squareCoords("h8")).toEqual({ file: 7, rank: 7 });
    expect(squareCoords("e4")).toEqual({ file: 4, rank: 3 });
  });
});

describe("lastMoveDetails", () => {
  it("returns null when there is no history", () => {
    const e = new ChoseEngine();
    expect(e.lastMoveDetails()).toBeNull();
  });

  it("reports basic from / to / by metadata for a quiet move", () => {
    const e = new ChoseEngine();
    e.move({ from: "e2", to: "e4" });
    expect(e.lastMoveDetails()).toEqual({
      from: "e2",
      to: "e4",
      by: "player",
      captured: null,
    });
  });

  it("includes the captured piece when the move was a capture", () => {
    const e = new ChoseEngine("4k3/8/8/8/3p4/4P3/8/4K3 w - - 0 1");
    e.move({ from: "e3", to: "d4" }); // pawn takes pawn
    expect(e.lastMoveDetails()).toEqual({
      from: "e3",
      to: "d4",
      by: "player",
      captured: { type: "pawn", side: "opponent" },
    });
  });

  it("includes the promotion target when the move promoted", () => {
    const e = new ChoseEngine("8/P7/8/8/8/8/8/4k2K w - - 0 1");
    e.move({ from: "a7", to: "a8" });
    const details = e.lastMoveDetails();
    expect(details?.promotion).toBe("q");
  });

  it("includes the castle side when the move castled", () => {
    const e = new ChoseEngine("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    e.move({ from: "e1", to: "g1" });
    expect(e.lastMoveDetails()?.castle).toBe("K");
  });
});

describe("snapshot / restore", () => {
  it("rolls back position and history", () => {
    const e = new ChoseEngine();
    const snap = e.snapshot();
    e.move({ from: "e2", to: "e4" });
    e.move({ from: "e7", to: "e5" });
    expect(e.pieceAt("e4")?.type).toBe("pawn");
    e.restore(snap);
    expect(e.pieceAt("e4")).toBeNull();
    expect(e.pieceAt("e2")?.type).toBe("pawn");
    expect(e.lastMove()).toBeNull();
  });

  it("captured pieces are reverted along with history", () => {
    const e = new ChoseEngine("4k3/8/8/8/3p4/4P3/8/4K3 w - - 0 1");
    const snap = e.snapshot();
    e.move({ from: "e3", to: "d4" }); // captures the pawn
    expect(e.capturedPieces().byPlayer).toHaveLength(1);
    e.restore(snap);
    expect(e.capturedPieces().byPlayer).toHaveLength(0);
    expect(e.pieceAt("d4")?.side).toBe("opponent");
  });
});

describe("wouldDeliverCheck", () => {
  it("flags moves that put the opposing king in check and leaves the engine untouched", () => {
    // White rook a1, white king e1, lone Black king a8. Ra1-a7 attacks the
    // king along the file → check. Ra1-b1 is a quiet move.
    const e = new ChoseEngine("k7/8/8/8/8/8/8/R3K3 w - - 0 1");
    const moves = e.legalMoves("a1");
    const checking = moves.find((m) => m.to === "a7");
    expect(checking).toBeDefined();
    expect(e.wouldDeliverCheck(checking!)).toBe(true);
    // Engine state unchanged.
    expect(e.pieceAt("a1")?.type).toBe("rook");
    expect(e.turn()).toBe("player");

    const safe = moves.find((m) => m.to === "b1");
    expect(safe).toBeDefined();
    expect(e.wouldDeliverCheck(safe!)).toBe(false);
  });
});

describe("movePath", () => {
  it("knights jump, so the path is just the destination", () => {
    expect(movePath("knight", "g1", "f3")).toEqual(["f3"]);
  });

  it("a sliding piece's path includes every square between origin and destination", () => {
    // d1 to d5 along the file: d2, d3, d4, d5
    expect(movePath("rook", "d1", "d5")).toEqual(["d2", "d3", "d4", "d5"]);
  });

  it("a bishop's diagonal path is every diagonal step", () => {
    expect(movePath("bishop", "c1", "f4")).toEqual(["d2", "e3", "f4"]);
  });

  it("a pawn double-step crosses the intermediate square", () => {
    expect(movePath("pawn", "e2", "e4")).toEqual(["e3", "e4"]);
  });
});
