import { describe, expect, it } from "vitest";

import {
  activeZoneBuffs,
  isZoneBuffActive,
  regionSquares,
  zoneBuffEnergyPerTurn,
  zoneBuffHandSize,
  zoneBuffSquares,
  type ZoneBoardContext,
} from "./zoneBuffs";
import type { BoardSize, Side, ZoneBuff } from "../types";

const SIZE_8x8: BoardSize = { files: 8, ranks: 8 };

function ctxWithPieces(pieces: Record<string, Side>, size: BoardSize = SIZE_8x8): ZoneBoardContext {
  return {
    size,
    pieceSideAt: (sq) => pieces[sq] ?? null,
  };
}

describe("regionSquares", () => {
  it("orthogonal-1 anchors expand into 5 squares (anchor + 4 neighbours)", () => {
    const sqs = regionSquares({ kind: "square-orthogonal-1", anchor: "e4" }, SIZE_8x8);
    expect(sqs).toEqual(new Set(["e4", "e5", "e3", "f4", "d4"]));
  });

  it("radius-1 anchors expand into 9 squares (anchor + 8 neighbours)", () => {
    const sqs = regionSquares({ kind: "square-radius-1", anchor: "e4" }, SIZE_8x8);
    expect(sqs.size).toBe(9);
    expect(sqs.has("e4")).toBe(true);
    expect(sqs.has("d3")).toBe(true);
    expect(sqs.has("f5")).toBe(true);
  });

  it("anchored regions clip at the board edges", () => {
    const sqs = regionSquares({ kind: "square-radius-1", anchor: "a1" }, SIZE_8x8);
    expect(sqs).toEqual(new Set(["a1", "a2", "b1", "b2"]));
  });

  it("rank regions enumerate every file on the rank", () => {
    const sqs = regionSquares({ kind: "rank", rank: 4 }, SIZE_8x8);
    expect(sqs.size).toBe(8);
    expect(sqs.has("a4")).toBe(true);
    expect(sqs.has("h4")).toBe(true);
  });

  it("rank regions return empty when the rank is off-board", () => {
    expect(regionSquares({ kind: "rank", rank: 9 }, SIZE_8x8).size).toBe(0);
  });

  it("smaller boards yield smaller rank regions", () => {
    const sqs = regionSquares({ kind: "rank", rank: 4 }, { files: 5, ranks: 6 });
    expect(sqs).toEqual(new Set(["a4", "b4", "c4", "d4", "e4"]));
  });
});

describe("isZoneBuffActive", () => {
  const buff: ZoneBuff = {
    region: { kind: "square-orthogonal-1", anchor: "e4" },
    effect: { kind: "energy-per-turn", amount: 1 },
    side: "player",
    sourceLabel: "Power Node",
  };

  it("is active when the controlling side has a piece on a region square", () => {
    expect(isZoneBuffActive(buff, ctxWithPieces({ d4: "player" }))).toBe(true);
    expect(isZoneBuffActive(buff, ctxWithPieces({ e4: "player" }))).toBe(true);
  });

  it("is inactive when only opponent pieces sit in the region", () => {
    expect(isZoneBuffActive(buff, ctxWithPieces({ d4: "opponent", e4: "opponent" }))).toBe(false);
  });

  it("is inactive when the region is empty", () => {
    expect(isZoneBuffActive(buff, ctxWithPieces({}))).toBe(false);
  });

  it("a piece on a non-region square doesn't count", () => {
    expect(isZoneBuffActive(buff, ctxWithPieces({ a1: "player" }))).toBe(false);
  });

  it("rank-region buffs activate when any piece sits on the named rank", () => {
    const rankBuff: ZoneBuff = {
      region: { kind: "rank", rank: 4 },
      effect: { kind: "hand-size", amount: 1 },
      side: "player",
      sourceLabel: "Foothold",
    };
    expect(isZoneBuffActive(rankBuff, ctxWithPieces({ c4: "player" }))).toBe(true);
    expect(isZoneBuffActive(rankBuff, ctxWithPieces({ c5: "player" }))).toBe(false);
  });
});

describe("zoneBuff sums + activeZoneBuffs", () => {
  const stone: ZoneBuff = {
    region: { kind: "square-orthogonal-1", anchor: "e4" },
    effect: { kind: "energy-per-turn", amount: 1 },
    side: "player",
    sourceLabel: "Power Node",
  };
  const banner: ZoneBuff = {
    region: { kind: "rank", rank: 4 },
    effect: { kind: "hand-size", amount: 1 },
    side: "player",
    sourceLabel: "Foothold",
  };

  it("activeZoneBuffs filters by control", () => {
    // d4 sits in both regions: orthogonal-of-e4 AND rank 4 → both active.
    const active = activeZoneBuffs([stone, banner], ctxWithPieces({ d4: "player" }));
    expect(active.map((b) => b.sourceLabel).sort()).toEqual(["Foothold", "Power Node"]);
  });

  it("activeZoneBuffs returns only the controlled subset", () => {
    // h6 is on neither region — both inactive.
    const active = activeZoneBuffs([stone, banner], ctxWithPieces({ h6: "player" }));
    expect(active).toHaveLength(0);
  });

  it("zoneBuffEnergyPerTurn sums energy buffs", () => {
    expect(zoneBuffEnergyPerTurn([stone, banner])).toBe(1);
    expect(zoneBuffEnergyPerTurn([])).toBe(0);
  });

  it("zoneBuffHandSize sums hand-size buffs", () => {
    expect(zoneBuffHandSize([stone, banner])).toBe(1);
    expect(zoneBuffHandSize([])).toBe(0);
  });

  it("zoneBuffSquares unions all regions", () => {
    const sqs = zoneBuffSquares([stone, banner], SIZE_8x8);
    // Orthogonal: 5 squares around e4; rank-4: 8 squares. Overlap on e4 + d4 + f4.
    expect(sqs.size).toBe(5 + 8 - 3);
  });
});
