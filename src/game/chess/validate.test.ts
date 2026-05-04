// Tests for the dev-sandbox position validator.

import { describe, expect, it } from "vitest";

import { parseFen } from "./rules";
import { offendingSquares, validatePosition } from "./validate";

function pos(fen: string) {
  return parseFen(fen);
}

describe("validatePosition", () => {
  it("accepts the standard starting position", () => {
    const result = validatePosition(pos("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1"));
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("flags missing kings", () => {
    const result = validatePosition(pos("8/8/8/8/8/8/8/8 w - - 0 1"));
    const kinds = result.violations.map((v) => v.kind);
    expect(kinds).toContain("king-count");
    expect(result.ok).toBe(false);
  });

  it("flags two white kings — both squares offending", () => {
    const result = validatePosition(pos("4k3/8/8/8/8/8/8/K6K w - - 0 1"));
    const kingViolation = result.violations.find(
      (v) => v.kind === "king-count" && v.side === "player",
    );
    expect(kingViolation).toBeDefined();
    expect(kingViolation?.squares.sort()).toEqual(["a1", "h1"].sort());
  });

  it("flags adjacent kings — both kings offending", () => {
    // White king e1, black king e2 — adjacent.
    const result = validatePosition(pos("8/8/8/8/8/8/4k3/4K3 w - - 0 1"));
    const adj = result.violations.find((v) => v.kind === "kings-adjacent");
    expect(adj).toBeDefined();
    expect(new Set(adj?.squares ?? [])).toEqual(new Set(["e1", "e2"]));
  });

  it("flags pawns on the back ranks", () => {
    // White pawn on a1 (rank 0) and black pawn on h8 (last rank).
    const result = validatePosition(pos("4k2p/8/8/8/8/8/8/P3K3 w - - 0 1"));
    const back = result.violations.find((v) => v.kind === "pawn-back-rank");
    expect(back).toBeDefined();
    expect(back?.squares).toContain("a1");
    expect(back?.squares).toContain("h8");
  });

  it("flags wrong-side-in-check (black to move but white king in check)", () => {
    // Black to move; black bishop on c3 attacks white king on e1.
    const result = validatePosition(pos("4k3/8/8/8/8/2b5/8/4K3 b - - 0 1"));
    const wrong = result.violations.find((v) => v.kind === "opponent-in-check");
    expect(wrong).toBeDefined();
    expect(wrong?.kingSquare).toBe("e1");
    expect(wrong?.attackerSquares).toContain("c3");
    // Both the king and the attacker should be flagged for highlight.
    const all = offendingSquares({ ok: false, violations: [wrong!] });
    expect(all.has("e1")).toBe(true);
    expect(all.has("c3")).toBe(true);
  });

  it("does not flag a normal in-check position when it is the side-to-move that is in check", () => {
    // White to move; black bishop on c3 attacks white king on e1.
    const result = validatePosition(pos("4k3/8/8/8/8/2b5/8/4K3 w - - 0 1"));
    expect(result.ok).toBe(true);
  });
});
