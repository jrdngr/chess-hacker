// Tests for the Standard-mode random-roll piece-set generator.

import { describe, expect, it } from "vitest";

import { makeRng } from "../cards/match";
import type { PieceType } from "../types";
import {
  PIECE_CAP,
  PIECE_VALUE,
  STANDARD_MATCHES,
  resolvePieceSet,
  rollPieceSet,
  standardMatchConfig,
} from "./standard";

const NBR: PieceType[] = ["knight", "bishop", "rook"];
const NBRQ: PieceType[] = ["knight", "bishop", "rook", "queen"];

const valueOf = (back: PieceType[]): number => back.reduce((sum, p) => sum + PIECE_VALUE[p], 0);

const countBy = (back: PieceType[]): Map<PieceType, number> => {
  const m = new Map<PieceType, number>();
  for (const p of back) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
};

describe("rollPieceSet", () => {
  it("always places exactly one king at index 0", () => {
    for (let seed = 1; seed < 30; seed++) {
      const rolled = rollPieceSet(
        { kind: "random", allowedPieces: NBR, nonPawnPointsBudget: 17 },
        6,
        6,
        makeRng(seed),
      );
      expect(rolled.backRank[0]).toBe("king");
      expect(rolled.backRank.filter((p) => p === "king")).toHaveLength(1);
    }
  });

  it("never exceeds the non-pawn budget", () => {
    const budgets = [6, 11, 16, 19, 22];
    for (const budget of budgets) {
      for (let seed = 1; seed < 50; seed++) {
        const rolled = rollPieceSet(
          { kind: "random", allowedPieces: NBRQ, nonPawnPointsBudget: budget },
          8,
          8,
          makeRng(seed),
        );
        expect(valueOf(rolled.backRank)).toBeLessThanOrEqual(budget);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const a = rollPieceSet(
      { kind: "random", allowedPieces: NBRQ, nonPawnPointsBudget: 25 },
      8,
      8,
      makeRng(42),
    );
    const b = rollPieceSet(
      { kind: "random", allowedPieces: NBRQ, nonPawnPointsBudget: 25 },
      8,
      8,
      makeRng(42),
    );
    expect(b.backRank).toEqual(a.backRank);
  });

  it("respects per-type Chess960 caps (≤2N, ≤2B, ≤2R, ≤1Q)", () => {
    // High budget + small board both stress the cap logic; we run many seeds.
    for (let seed = 1; seed < 100; seed++) {
      const rolled = rollPieceSet(
        { kind: "random", allowedPieces: NBRQ, nonPawnPointsBudget: 50 },
        8,
        8,
        makeRng(seed),
      );
      const counts = countBy(rolled.backRank);
      for (const [type, count] of counts) {
        expect(count).toBeLessThanOrEqual(PIECE_CAP[type]);
      }
    }
  });

  it("on M1 spec (budget 6, pool {N,B,R}, 6×6) yields 11- or 12-point armies (incl. 6 pawns)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const rolled = rollPieceSet(
        { kind: "random", allowedPieces: NBR, nonPawnPointsBudget: 6 },
        6,
        6,
        makeRng(seed),
      );
      const nonPawn = valueOf(rolled.backRank);
      const total = nonPawn + rolled.pawns;
      expect([11, 12]).toContain(total);
      const counts = countBy(rolled.backRank);
      seen.add(
        `K${counts.get("king") ?? 0}N${counts.get("knight") ?? 0}B${counts.get("bishop") ?? 0}R${counts.get("rook") ?? 0}`,
      );
    }
    // Sanity: across 80 seeds we should see more than one composition.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("never returns a back rank wider than the board", () => {
    for (let seed = 1; seed < 30; seed++) {
      // Contrived: huge budget, tiny board → slot guard must terminate the loop.
      const rolled = rollPieceSet(
        { kind: "random", allowedPieces: NBR, nonPawnPointsBudget: 100 },
        4,
        4,
        makeRng(seed),
      );
      expect(rolled.backRank.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("resolvePieceSet", () => {
  it("returns a clone of the explicit back rank for boss configs", () => {
    const cfg = standardMatchConfig(3); // Boss A
    expect(cfg.pieceSpec.kind).toBe("explicit");
    const resolved = resolvePieceSet(cfg, makeRng(1));
    expect(resolved.backRank).toEqual(["king", "knight", "bishop", "rook"]);
    // Mutating the returned set must not mutate the source config.
    resolved.backRank.push("queen");
    const again = resolvePieceSet(cfg, makeRng(1));
    expect(again.backRank).toEqual(["king", "knight", "bishop", "rook"]);
  });

  it("delegates to rollPieceSet for random configs", () => {
    const cfg = standardMatchConfig(1);
    expect(cfg.pieceSpec.kind).toBe("random");
    const a = resolvePieceSet(cfg, makeRng(7));
    expect(a.backRank[0]).toBe("king");
    expect(a.pawns).toBe(cfg.pawns);
  });
});

describe("STANDARD_MATCHES curve", () => {
  it("has 9 matches with bosses on 3, 6, 9", () => {
    expect(STANDARD_MATCHES).toHaveLength(9);
    expect(STANDARD_MATCHES[2].isBoss).toBe(true);
    expect(STANDARD_MATCHES[5].isBoss).toBe(true);
    expect(STANDARD_MATCHES[8].isBoss).toBe(true);
    expect(STANDARD_MATCHES.filter((m) => m.isBoss)).toHaveLength(3);
  });

  it("starts at 6×6 and ends at 8×8", () => {
    expect(STANDARD_MATCHES[0].size).toEqual({ files: 6, ranks: 6 });
    expect(STANDARD_MATCHES[8].size).toEqual({ files: 8, ranks: 8 });
  });

  it("grows the board monotonically (no shrink between matches)", () => {
    for (let i = 1; i < STANDARD_MATCHES.length; i++) {
      const prev = STANDARD_MATCHES[i - 1].size;
      const cur = STANDARD_MATCHES[i].size;
      expect(cur.files).toBeGreaterThanOrEqual(prev.files);
      expect(cur.ranks).toBeGreaterThanOrEqual(prev.ranks);
    }
  });

  it("uses one square board per act (Act 1 = 6×6, Act 2 = 7×7, Act 3 = 8×8)", () => {
    for (const m of STANDARD_MATCHES.slice(0, 3)) {
      expect(m.size).toEqual({ files: 6, ranks: 6 });
    }
    for (const m of STANDARD_MATCHES.slice(3, 6)) {
      expect(m.size).toEqual({ files: 7, ranks: 7 });
    }
    for (const m of STANDARD_MATCHES.slice(6, 9)) {
      expect(m.size).toEqual({ files: 8, ranks: 8 });
    }
  });

  it("matches pawn count to file count for the current curve", () => {
    for (const m of STANDARD_MATCHES) {
      expect(m.pawns).toBe(m.size.files);
    }
  });

  it("explicit boss back ranks fit within their boards and respect Chess960 caps", () => {
    for (const m of STANDARD_MATCHES) {
      if (m.pieceSpec.kind !== "explicit") continue;
      expect(m.pieceSpec.backRank.length).toBeLessThanOrEqual(m.size.files);
      const counts = countBy(m.pieceSpec.backRank);
      for (const [type, count] of counts) {
        expect(count).toBeLessThanOrEqual(PIECE_CAP[type]);
      }
      expect(counts.get("king")).toBe(1);
    }
  });

  it("random rolls always fit within the back rank for every match in the curve", () => {
    for (const m of STANDARD_MATCHES) {
      if (m.pieceSpec.kind !== "random") continue;
      for (let seed = 1; seed < 30; seed++) {
        const rolled = rollPieceSet(m.pieceSpec, m.pawns, m.size.files, makeRng(seed));
        expect(rolled.backRank.length).toBeLessThanOrEqual(m.size.files);
      }
    }
  });
});
