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
import { STANDARD_RUN_CONFIG } from "./run";

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

  it("on M1 spec (budget 9, pool {N,B,R}, 6×6) yields K + 3 minors or K + rook + minor", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const rolled = rollPieceSet(
        { kind: "random", allowedPieces: NBR, nonPawnPointsBudget: 9 },
        6,
        6,
        makeRng(seed),
      );
      const nonPawn = valueOf(rolled.backRank);
      // Either 3 minors (9 pts) or 1 rook + 1 minor (8 pts).
      expect([8, 9]).toContain(nonPawn);
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
    const bossMatch = STANDARD_MATCHES.find((m) => m.isBoss && m.pieceSpec.kind === "explicit");
    expect(bossMatch).toBeDefined();
    const cfg = standardMatchConfig(bossMatch!.matchNumber);
    expect(cfg.pieceSpec.kind).toBe("explicit");
    const expected = cfg.pieceSpec.kind === "explicit" ? [...cfg.pieceSpec.backRank] : [];
    const resolved = resolvePieceSet(cfg, makeRng(1));
    expect(resolved.backRank).toEqual(expected);
    // Mutating the returned set must not mutate the source config.
    resolved.backRank.push("queen");
    const again = resolvePieceSet(cfg, makeRng(1));
    expect(again.backRank).toEqual(expected);
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
  const { actCount, matchesPerAct } = STANDARD_RUN_CONFIG;

  it("total matches = actCount × matchesPerAct", () => {
    expect(STANDARD_MATCHES).toHaveLength(actCount * matchesPerAct);
  });

  it("bosses appear at the last match of each act", () => {
    for (let i = 0; i < STANDARD_MATCHES.length; i++) {
      const isLastInAct = (i + 1) % matchesPerAct === 0;
      expect(STANDARD_MATCHES[i].isBoss, `match ${i + 1}`).toBe(isLastInAct);
    }
  });

  it("first match uses the smallest board and last match uses the largest", () => {
    const first = STANDARD_MATCHES[0].size;
    const last = STANDARD_MATCHES[STANDARD_MATCHES.length - 1].size;
    expect(last.files).toBeGreaterThanOrEqual(first.files);
    expect(last.ranks).toBeGreaterThanOrEqual(first.ranks);
  });

  it("grows the board monotonically (no shrink between matches)", () => {
    for (let i = 1; i < STANDARD_MATCHES.length; i++) {
      const prev = STANDARD_MATCHES[i - 1].size;
      const cur = STANDARD_MATCHES[i].size;
      expect(cur.files).toBeGreaterThanOrEqual(prev.files);
      expect(cur.ranks).toBeGreaterThanOrEqual(prev.ranks);
    }
  });

  it("all matches within an act share the same board size", () => {
    for (let act = 0; act < actCount; act++) {
      const start = act * matchesPerAct;
      const actSize = STANDARD_MATCHES[start].size;
      for (let i = start + 1; i < start + matchesPerAct; i++) {
        expect(STANDARD_MATCHES[i].size, `act ${act + 1}, match ${i + 1}`).toEqual(actSize);
      }
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
