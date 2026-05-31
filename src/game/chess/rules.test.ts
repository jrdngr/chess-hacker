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

describe("rules — Shield/Sanctuary protect the en-passant victim (CH-003)", () => {
  // White just played e2-e4 (en-passant target e3). Black pawn on d4 can
  // capture en passant, landing on e3 and removing the white pawn on e4.
  const fen = "4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1";

  it("without protection, the en-passant capture is legal", () => {
    const pos = parseFen(fen);
    const moves = legalMoves(pos, NO_OVERLAYS, "d4").map((m) => m.to);
    expect(moves).toContain("e3");
  });

  it("a Shield on the EP victim (e4) forbids the en-passant capture", () => {
    const pos = parseFen(fen);
    const ov = { ...NO_OVERLAYS, shields: new Set<AlgebraicSquare>(["e4"]) };
    const moves = legalMoves(pos, ov, "d4").map((m) => m.to);
    expect(moves).not.toContain("e3");
  });

  it("a Sanctuary on the EP victim's square (e4) forbids the en-passant capture", () => {
    const pos = parseFen(fen);
    const ov = { ...NO_OVERLAYS, sanctuaries: new Set<AlgebraicSquare>(["e4"]) };
    const moves = legalMoves(pos, ov, "d4").map((m) => m.to);
    expect(moves).not.toContain("e3");
  });
});

// ---- Power-curve overhaul: piece-rule-modifier artifacts -------------------

describe("rules — Pawn Storm (pawn-double-from-any-rank)", () => {
  // Player pawn on d3 (one rank past the start rank). Without the artifact:
  // only the single push to d4 is legal. With it: both d4 and d5 are legal.
  const fen = "4k3/8/8/8/8/3P4/8/4K3 w - - 0 1";

  it("without artifact: pawn on d3 cannot double-push to d5", () => {
    const pos = parseFen(fen);
    const moves = legalMoves(pos, NO_OVERLAYS, "d3").map((m) => m.to);
    expect(moves).toContain("d4");
    expect(moves).not.toContain("d5");
  });

  it("with artifact: pawn on d3 may double-push to d5", () => {
    const pos = parseFen(fen);
    const ov = {
      ...NO_OVERLAYS,
      pawnDoubleFromAnyRank: new Set<"player" | "opponent">(["player"]),
    };
    const moves = legalMoves(pos, ov, "d3").map((m) => m.to);
    expect(moves).toContain("d4");
    expect(moves).toContain("d5");
  });
});

describe("rules — Drill Sergeant (pawn-backward-step)", () => {
  // Pawn on d4 with empty d3 behind it.
  const fen = "4k3/8/8/8/3P4/8/8/4K3 w - - 0 1";

  it("without artifact: backward step is illegal", () => {
    const pos = parseFen(fen);
    const moves = legalMoves(pos, NO_OVERLAYS, "d4").map((m) => m.to);
    expect(moves).not.toContain("d3");
  });

  it("with artifact: pawn may step backward to d3 (no capture)", () => {
    const pos = parseFen(fen);
    const ov = {
      ...NO_OVERLAYS,
      pawnBackwardStep: new Set<"player" | "opponent">(["player"]),
    };
    const moves = legalMoves(pos, ov, "d4").filter((m) => m.to === "d3");
    expect(moves).toHaveLength(1);
    expect(moves[0].isCapture).toBe(false);
  });
});

describe("rules — Promotion Engine (pawn-promotion-rank override)", () => {
  // Player pawn on d6 with d7 empty. Promotion-rank override = 7 means the
  // single push to d7 promotes; without override, it's a quiet push.
  const fen = "4k3/8/3P4/8/8/8/8/4K3 w - - 0 1";

  it("without override: pawn on d6 → d7 is a non-promotion push", () => {
    const pos = parseFen(fen);
    const moves = legalMoves(pos, NO_OVERLAYS, "d6").filter((m) => m.to === "d7");
    expect(moves.every((m) => !m.isPromotion)).toBe(true);
  });

  it("with override (rank=7): pawn on d6 → d7 emits promotion options", () => {
    const pos = parseFen(fen);
    const ov = { ...NO_OVERLAYS, pawnPromotionRanks: { player: 7 } };
    const moves = legalMoves(pos, ov, "d6").filter((m) => m.to === "d7");
    expect(moves.length).toBeGreaterThanOrEqual(1);
    expect(moves.every((m) => m.isPromotion)).toBe(true);
  });
});

describe("rules — Polished Bishop / Cavalry Doctrine (king-step empower)", () => {
  it("a bishop with king-step empower can step 1 square orthogonally", () => {
    // Player bishop on d4. Plain bishop has no orthogonal moves.
    const pos = parseFen("4k3/8/8/8/3B4/8/8/4K3 w - - 0 1");
    const ov = {
      ...NO_OVERLAYS,
      empowers: new Map([["d4", new Set<"king-step">(["king-step"])]]),
    };
    const moves = legalMoves(pos, ov, "d4").map((m) => m.to);
    expect(moves).toContain("d5"); // ortho-1 forward
    expect(moves).toContain("e4"); // ortho-1 right
  });

  it("a knight with king-step empower can step 1 square orthogonally", () => {
    const pos = parseFen("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    const ov = {
      ...NO_OVERLAYS,
      empowers: new Map([["d4", new Set<"king-step">(["king-step"])]]),
    };
    const moves = legalMoves(pos, ov, "d4").map((m) => m.to);
    // L-shape moves still present
    expect(moves).toContain("c6");
    // Plus orthogonal step
    expect(moves).toContain("d5");
  });
});

describe("rules — Sniper Optics (rook-attack-through-wall)", () => {
  // Player rook on a1, enemy bishop on a8, walls between them on a4.
  const fen = "b7/8/8/8/8/8/8/R3K3 w - - 0 1";

  it("without artifact: rook can't see across the wall, bishop is safe", () => {
    const pos = parseFen(fen);
    const ov = { ...NO_OVERLAYS, walls: new Set<AlgebraicSquare>(["a4"]) };
    const moves = legalMoves(pos, ov, "a1").map((m) => m.to);
    expect(moves).not.toContain("a8");
  });

  it("with maxWalls=1: rook may capture the bishop on a8 across one wall", () => {
    const pos = parseFen(fen);
    const ov = {
      ...NO_OVERLAYS,
      walls: new Set<AlgebraicSquare>(["a4"]),
      rookAttackThroughWalls: { player: 1 },
    };
    const moves = legalMoves(pos, ov, "a1").filter((m) => m.to === "a8");
    expect(moves).toHaveLength(1);
    expect(moves[0].isCapture).toBe(true);
  });

  it("with maxWalls=1 + 2 walls on the ray: rook still cannot capture", () => {
    const pos = parseFen(fen);
    const ov = {
      ...NO_OVERLAYS,
      walls: new Set<AlgebraicSquare>(["a4", "a6"]),
      rookAttackThroughWalls: { player: 1 },
    };
    const moves = legalMoves(pos, ov, "a1").map((m) => m.to);
    expect(moves).not.toContain("a8");
  });

  it("rook may NOT move to an empty square past the wall (capture-only)", () => {
    // Empty a8 — no piece to capture. Rook must not be allowed to slide there.
    const pos = parseFen("4k3/8/8/8/8/8/8/R3K3 w - - 0 1");
    const ov = {
      ...NO_OVERLAYS,
      walls: new Set<AlgebraicSquare>(["a4"]),
      rookAttackThroughWalls: { player: 1 },
    };
    const moves = legalMoves(pos, ov, "a1").map((m) => m.to);
    expect(moves).not.toContain("a8");
    // Movement up to (but not into / past) the wall is still allowed.
    expect(moves).toContain("a3");
    expect(moves).not.toContain("a4");
  });

  it("isSquareAttacked sees the rook attack across one wall (delivers check)", () => {
    // Black king on a8 (in line with a1 rook through one wall).
    const pos = parseFen("k7/8/8/8/8/8/8/R3K3 w - - 0 1");
    const ov = {
      ...NO_OVERLAYS,
      walls: new Set<AlgebraicSquare>(["a4"]),
      rookAttackThroughWalls: { player: 1 },
    };
    expect(isSquareAttacked(pos, ov, "a8", "player")).toBe(true);
    // Without the override the rook does NOT attack across the wall.
    const ov2 = { ...NO_OVERLAYS, walls: new Set<AlgebraicSquare>(["a4"]) };
    expect(isSquareAttacked(pos, ov2, "a8", "player")).toBe(false);
  });
});
