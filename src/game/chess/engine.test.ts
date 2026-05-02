import { describe, expect, it } from "vitest";

import { ChoseEngine, squareCoords, squareName } from "./engine";

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
