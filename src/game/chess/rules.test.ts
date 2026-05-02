// Tests for the wall- and freeze-aware rule layer.
//
// The plain (no-overlay) chess rules are exercised through engine.test.ts;
// here we focus on cases where walls or freezes change the answer.

import { describe, expect, it } from "vitest";

import { ChoseEngine } from "./engine";
import type { AlgebraicSquare } from "../types";
import {
  NO_OVERLAYS,
  isInCheck,
  isSquareAttacked,
  legalMoves,
  parseFen,
  serializeFen,
} from "./rules";

function overlays(walls: AlgebraicSquare[] = [], freezes: AlgebraicSquare[] = []) {
  return {
    walls: new Set<AlgebraicSquare>(walls),
    freezes: new Set<AlgebraicSquare>(freezes),
  };
}

describe("rules — FEN round-trip", () => {
  it("round-trips the standard starting position", () => {
    const start = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(serializeFen(parseFen(start))).toBe(start);
  });

  it("round-trips a complex FEN (black to move, partial castling, en-passant set)", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq e3 0 4";
    expect(serializeFen(parseFen(fen))).toBe(fen);
  });
});

describe("rules — walls block sliding-piece attacks", () => {
  // Reduced version of the user's mating screenshot: black bishop on a4 was
  // "defending" a black queen on d1 along a4-b3-c2-d1. White king on e1 in
  // check by the queen. Without walls, the king can't capture (defended). With
  // a wall on b3, the bishop's defence is blocked → king CAN capture.
  const fen = "4k3/8/8/8/b7/8/8/3qK3 w - - 0 1";

  it("without a wall, the bishop defends the queen and Kxd1 is illegal", () => {
    const e = new ChoseEngine(fen);
    expect(e.inCheck()).toBe(true);
    const kingMoves = e.legalMoves("e1").map((m) => m.to);
    expect(kingMoves).not.toContain("d1");
  });

  it("with a wall on b3, the bishop's defence is blocked and Kxd1 is legal", () => {
    const e = new ChoseEngine(fen);
    e.setOverlays(new Set(["b3"]), new Set());
    const kingMoves = e.legalMoves("e1").map((m) => m.to);
    expect(kingMoves).toContain("d1");
  });

  it("walls also block check itself — a queen behind a wall doesn't check the king", () => {
    // Black queen on d1, white king on d8, wall on d4.
    const e = new ChoseEngine("3k4/8/8/8/8/8/8/3qK3 w - - 0 1");
    e.setOverlays(new Set(["d4"]), new Set());
    // White king on e1 is no longer in check by the d1 queen because the wall
    // doesn't matter on a different file. Set up a wall on a relevant square:
    const e2 = new ChoseEngine("3k4/8/8/8/8/8/8/3qK3 w - - 0 1");
    // Without walls: black queen on d1, white king e1 — adjacent, queen checks king diagonally? No, e1 and d1 are adjacent so the queen attacks the king directly. Walls don't help here.
    // Use a longer ray: black rook on e8, white king e1, wall e5. Black to move? No, white to move.
    const e3 = new ChoseEngine("4r3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(e3.inCheck()).toBe(true);
    e3.setOverlays(new Set(["e5"]), new Set());
    expect(e3.inCheck()).toBe(false);
    // Suppress unused-variable warnings.
    void e;
    void e2;
  });

  it("a knight ignores walls in transit (it jumps) but still cannot land on one", () => {
    // White knight on d4. With a wall on d5, the knight can still reach e6
    // (the wall is on its transit path conceptually, but knights jump). It
    // cannot, however, land ON e6 if e6 is walled.
    const pos = parseFen("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    const noWalls = legalMoves(pos, NO_OVERLAYS, "d4")
      .map((m) => m.to)
      .sort();
    expect(noWalls).toContain("e6");

    const wallOnE6 = legalMoves(pos, overlays(["e6"]), "d4").map((m) => m.to);
    expect(wallOnE6).not.toContain("e6");
    // Wall on d5 (not the destination) doesn't block a knight at all.
    const wallOnD5 = legalMoves(pos, overlays(["d5"]), "d4").map((m) => m.to);
    expect(wallOnD5).toContain("e6");
  });

  it("breaking a pin with a wall lets the previously-pinned piece move", () => {
    // White king on e1, white knight on e4, black rook on e8. Without walls,
    // the knight is pinned and cannot move. With a wall on e6, the rook can't
    // see through it, the pin is broken, and the knight may move freely.
    const fen = "4r3/8/8/8/4N3/8/8/4K3 w - - 0 1";
    const e = new ChoseEngine(fen);
    expect(e.legalMoves("e4")).toHaveLength(0);
    e.setOverlays(new Set(["e6"]), new Set());
    expect(e.legalMoves("e4").length).toBeGreaterThan(0);
  });
});

describe("rules — frozen pieces lose attacks and defence", () => {
  it("a frozen rook does not give check to the enemy king", () => {
    // White king e1, black rook e8, black to move not relevant; check from white king POV.
    const fen = "4r3/8/8/8/8/8/8/4K3 w - - 0 1";
    const e = new ChoseEngine(fen);
    expect(e.inCheck()).toBe(true);
    e.setOverlays(new Set(), new Set(["e8"]));
    expect(e.inCheck()).toBe(false);
  });

  it("a frozen defender no longer protects a piece — king can capture it", () => {
    // Black queen on d1 checking white king on e1. Black bishop on a4 defends
    // the queen via a4-d1 (no wall here). With the bishop FROZEN, defence
    // disappears and Kxd1 becomes legal.
    const fen = "4k3/8/8/8/b7/8/8/3qK3 w - - 0 1";
    const e = new ChoseEngine(fen);
    expect(e.legalMoves("e1").map((m) => m.to)).not.toContain("d1");
    e.setOverlays(new Set(), new Set(["a4"]));
    expect(e.legalMoves("e1").map((m) => m.to)).toContain("d1");
  });

  it("a frozen own piece cannot be moved at all", () => {
    const e = new ChoseEngine();
    expect(e.legalMoves("e2").length).toBe(2);
    e.setOverlays(new Set(), new Set(["e2"]));
    expect(e.legalMoves("e2")).toHaveLength(0);
  });
});

describe("rules — king through a wall", () => {
  it("the king cannot castle through a walled square", () => {
    const fen = "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1";
    const e = new ChoseEngine(fen);
    // Without walls: both castle moves legal.
    const noWalls = new Set(e.legalMoves("e1").map((m) => m.to));
    expect(noWalls.has("g1")).toBe(true);
    expect(noWalls.has("c1")).toBe(true);
    // Wall on f1 blocks kingside castle.
    e.setOverlays(new Set(["f1"]), new Set());
    const blocked = new Set(e.legalMoves("e1").map((m) => m.to));
    expect(blocked.has("g1")).toBe(false);
    expect(blocked.has("c1")).toBe(true); // queenside still ok
  });
});

describe("rules — isSquareAttacked direct", () => {
  it("a wall between bishop and target stops the bishop attacking", () => {
    const pos = parseFen("4k3/8/8/8/b7/8/8/3K4 w - - 0 1");
    expect(isSquareAttacked(pos, NO_OVERLAYS, "d1", "opponent")).toBe(true);
    expect(isSquareAttacked(pos, overlays(["b3"]), "d1", "opponent")).toBe(false);
  });

  it("isInCheck respects walls", () => {
    const pos = parseFen("4r3/8/8/8/8/8/8/4K3 w - - 0 1");
    expect(isInCheck(pos, NO_OVERLAYS)).toBe(true);
    expect(isInCheck(pos, overlays(["e5"]))).toBe(false);
  });
});
