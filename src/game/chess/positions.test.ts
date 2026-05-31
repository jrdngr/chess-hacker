// Tests for the generalized Chess960 generator and small-board FEN round-trip.

import { describe, expect, it } from "vitest";

import { makeRng } from "../cards/match";
import {
  backRankLegalityErrors,
  generateChess960Position,
  placeBackRank,
  placeConscriptionFiller,
} from "./positions";
import { parseFen, serializeFen } from "./rules";
import type { PieceSet, PieceType } from "../types";

const SET_8x8: PieceSet = {
  backRank: ["king", "queen", "rook", "rook", "bishop", "bishop", "knight", "knight"],
  pawns: 8,
};

const SET_4x6_KP: PieceSet = { backRank: ["king"], pawns: 4 };
const SET_6x6_KNBR: PieceSet = {
  backRank: ["king", "knight", "bishop", "rook"],
  pawns: 4,
};
const SET_6x8_KNNBR: PieceSet = {
  backRank: ["king", "knight", "knight", "bishop", "rook"],
  pawns: 6,
};

describe("placeBackRank", () => {
  it("places a single piece on the only available file when files = 1 + N empties", () => {
    const slots = placeBackRank({ backRank: ["king"], pawns: 4 }, 6, makeRng(1));
    const kingFiles = slots.filter((s) => s === "king").length;
    expect(kingFiles).toBe(1);
    // No other pieces.
    expect(slots.filter((s) => s !== null && s !== "king")).toEqual([]);
  });

  it("places two bishops on opposite-color squares on 8x8 standard set", () => {
    const slots = placeBackRank(SET_8x8, 8, makeRng(42));
    const bishopFiles = slots.map((s, i) => (s === "bishop" ? i : -1)).filter((i) => i >= 0);
    expect(bishopFiles).toHaveLength(2);
    expect(bishopFiles[0] % 2).not.toBe(bishopFiles[1] % 2);
  });

  it("places the king between the two rooks on 8x8 standard set", () => {
    const slots = placeBackRank(SET_8x8, 8, makeRng(7));
    const kingFile = slots.indexOf("king");
    const rookFiles = slots
      .map((s, i) => (s === "rook" ? i : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    expect(rookFiles).toHaveLength(2);
    expect(rookFiles[0]).toBeLessThan(kingFile);
    expect(kingFile).toBeLessThan(rookFiles[1]);
  });

  it("throws when the piece set is wider than the board", () => {
    expect(() =>
      placeBackRank(
        { backRank: ["king", "queen"] as PieceSet["backRank"], pawns: 0 },
        1,
        makeRng(1),
      ),
    ).toThrow();
  });
});

describe("placeConscriptionFiller", () => {
  it("slots filler into empty files and keeps the rank legal", () => {
    // Mirror core: king on file 1, rook on file 0; filler adds a knight.
    const core: (PieceType | null)[] = ["rook", "king", null, null, null, null];
    const { backRank, leftover } = placeConscriptionFiller(core, ["knight"], 6, makeRng(1));
    expect(leftover).toEqual([]);
    expect(backRank.filter((t) => t === "knight")).toHaveLength(1);
    expect(backRankLegalityErrors(backRank)).toEqual([]);
    // Core pieces are untouched.
    expect(backRank[0]).toBe("rook");
    expect(backRank[1]).toBe("king");
  });

  it("reports filler that cannot be placed legally as leftover", () => {
    // A full rank with no empty files: the filler has nowhere to go.
    const core: (PieceType | null)[] = ["bishop", "bishop", "king", "knight"]; // 4 files, 0 empty
    const { backRank, leftover } = placeConscriptionFiller(core, ["rook"], 4, makeRng(1));
    expect(leftover).toEqual(["rook"]);
    expect(backRankLegalityErrors(backRank)).toEqual([]);
  });

  it("places a second rook so the king stays between the rooks", () => {
    // Core has king (file 1) and one rook (file 0). A filler rook must land on a
    // file > 1 to keep the king enclosed.
    const core: (PieceType | null)[] = ["rook", "king", null, null, null, null];
    for (let seed = 1; seed <= 20; seed++) {
      const { backRank, leftover } = placeConscriptionFiller(core, ["rook"], 6, makeRng(seed));
      expect(leftover).toEqual([]);
      expect(backRankLegalityErrors(backRank)).toEqual([]);
    }
  });
});

describe("generateChess960Position", () => {
  it("produces a 4x6 starting position with 5 pieces per side for K + 4P", () => {
    const { fen, size } = generateChess960Position(SET_4x6_KP, { files: 4, ranks: 6 }, makeRng(1));
    const pos = parseFen(fen, size);
    expect(size).toEqual({ files: 4, ranks: 6 });
    let player = 0;
    let opponent = 0;
    for (const [, p] of pos.pieces) {
      if (p.side === "player") player++;
      else opponent++;
    }
    expect(player).toBe(5);
    expect(opponent).toBe(5);
  });

  it("places pawns on rank 1 and rank ranks-2 for both sides", () => {
    const { fen, size } = generateChess960Position(
      SET_6x6_KNBR,
      { files: 6, ranks: 6 },
      makeRng(1),
    );
    const pos = parseFen(fen, size);
    let whitePawnsOnRank1 = 0;
    let blackPawnsOnRank4 = 0;
    for (const [sq, p] of pos.pieces) {
      const rank = Number(sq.slice(1)) - 1;
      if (p.type !== "pawn") continue;
      if (p.side === "player" && rank === 1) whitePawnsOnRank1++;
      if (p.side === "opponent" && rank === size.ranks - 2) blackPawnsOnRank4++;
    }
    // 4 pawns per side for this fixture.
    expect(whitePawnsOnRank1).toBe(4);
    expect(blackPawnsOnRank4).toBe(4);
  });

  it("FEN round-trips on a 6x8 starting position", () => {
    const { fen, size } = generateChess960Position(
      SET_6x8_KNNBR,
      { files: 6, ranks: 8 },
      makeRng(99),
    );
    expect(serializeFen(parseFen(fen, size))).toBe(fen);
  });

  it("mirrors white's back rank to black", () => {
    const { fen, size } = generateChess960Position(
      SET_6x6_KNBR,
      { files: 6, ranks: 6 },
      makeRng(123),
    );
    const pos = parseFen(fen, size);
    for (let f = 0; f < size.files; f++) {
      const w = pos.pieces.get(`${"abcdefgh"[f]}1`);
      const b = pos.pieces.get(`${"abcdefgh"[f]}${size.ranks}`);
      if (w === undefined) {
        expect(b).toBeUndefined();
        continue;
      }
      expect(b).toBeDefined();
      expect(b?.type).toBe(w.type);
      expect(b?.side).toBe("opponent");
      expect(w.side).toBe("player");
    }
  });
});
