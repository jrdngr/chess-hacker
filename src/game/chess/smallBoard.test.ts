// Sanity tests for the engine on non-8x8 boards.

import { describe, expect, it } from "vitest";

import { ChoseEngine } from "./engine";
import { parseFen, serializeFen } from "./rules";

describe("engine — 6x6 board", () => {
  it("FEN round-trips on an empty 6x6 board with both kings", () => {
    const fen = "6/6/6/6/6/6 w - - 0 1";
    // Empty 6-file row encodes as "6". Kings somewhere — use a different fen.
    const fen2 = "5k/6/6/6/6/K5 w - - 0 1";
    const pos = parseFen(fen2, { files: 6, ranks: 6 });
    expect(serializeFen(pos)).toBe(fen2);
    void fen;
  });

  it("pawn promotes on rank 5 for white on a 6x6 board", () => {
    // White pawn on a5, black king on f1, white king on a1.
    // On 6x6, rank index 5 (sq "a6") is the promotion rank.
    const fen = "P5/6/6/6/6/K4k w - - 0 1";
    const e = new ChoseEngine(fen, { files: 6, ranks: 6 });
    const moves = e.legalMoves("a6");
    void moves;
    // Pawn isn't on a6 in this fen — fix: place pawn one rank from promo.
    const fen2 = "6/P5/6/6/6/K4k w - - 0 1";
    const e2 = new ChoseEngine(fen2, { files: 6, ranks: 6 });
    const advance = e2.legalMoves("a5").filter((m) => m.to === "a6");
    expect(advance.length).toBeGreaterThan(0);
    expect(advance.every((m) => m.isPromotion)).toBe(true);
  });

  it("pawn double-push works from white's starting rank (rank 1) on 6x6", () => {
    const fen = "5k/6/6/6/P5/K5 w - - 0 1";
    const e = new ChoseEngine(fen, { files: 6, ranks: 6 });
    const moves = e.legalMoves("a2");
    // a2 → a4 should be a legal double push.
    expect(moves.some((m) => m.to === "a4")).toBe(true);
  });

  it("pawn double-push works from black's starting rank (rank ranks-2) on 6x6", () => {
    // Black pawn on a5 (rank index 4 = ranks-2 on 6x6) — black to move.
    const fen = "5k/p5/6/6/6/K5 b - - 0 1";
    const e = new ChoseEngine(fen, { files: 6, ranks: 6 });
    const moves = e.legalMoves("a5");
    expect(moves.some((m) => m.to === "a3")).toBe(true);
  });

  it("does not generate castling on a 6x6 board even with a rook", () => {
    // White king on c1, white rook on a1 — would be queenside castle on 8x8.
    const fen = "5k/6/6/6/6/R1K3 w KQkq - 0 1";
    const e = new ChoseEngine(fen, { files: 6, ranks: 6 });
    const kingMoves = e.legalMoves("c1");
    expect(kingMoves.every((m) => !m.isCastle)).toBe(true);
  });
});

describe("engine — 6x8 board", () => {
  it("FEN round-trips on a 6x8 starting-style position", () => {
    const fen = "5k/6/6/6/6/6/6/K5 w - - 0 1";
    const pos = parseFen(fen, { files: 6, ranks: 8 });
    expect(serializeFen(pos)).toBe(fen);
  });

  it("pawn double-push starts from rank 1 (white) and rank 6 (black) on 6x8", () => {
    const fen = "5k/p5/6/6/6/6/P5/K5 w - - 0 1";
    const e = new ChoseEngine(fen, { files: 6, ranks: 8 });
    expect(e.legalMoves("a2").some((m) => m.to === "a4")).toBe(true);
    // Black's turn next — make a move first then test.
    e.move({ from: "a2", to: "a3" });
    expect(e.legalMoves("a7").some((m) => m.to === "a5")).toBe(true);
  });
});

describe("engine — defaults to 8x8 for back-compat", () => {
  it("constructor with no args still produces an 8x8 starting position", () => {
    const e = new ChoseEngine();
    expect(e.size()).toEqual({ files: 8, ranks: 8 });
    expect(e.fen()).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  });
});
