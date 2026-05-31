import { describe, expect, it } from "vitest";

import { makeRng } from "../cards/match";
import type { PieceType, RunState } from "../types";
import {
  draftPiece,
  generatePieceDraftOffer,
  PAWN_HARD_CAP,
  PIECE_DRAFT_SIZE,
  PIECE_SKIP_GOLD,
  placementValue,
  rosterPawnCount,
  skipPieceDraft,
  SKIRMISH_PIECE_VALUE,
  SKIRMISH_STARTING_ROSTER,
  skirmishBoardSize,
  skirmishValueCap,
} from "./skirmish";
import { validatePlacement, buildSkirmishFen } from "./placement";
import { createRun } from "./run";
import { parseFen, type Position } from "../chess/rules";
import { backRankLegalityErrors } from "../chess/positions";
import type { BoardSize, PieceSet } from "../types";

const FILES = "abcdefgh";

/** Sum of classical values across the opponent's pieces. */
function enemyValue(pos: Position): number {
  let total = 0;
  for (const [, p] of pos.pieces) {
    if (p.side === "opponent") total += SKIRMISH_PIECE_VALUE[p.type];
  }
  return total;
}

/** Extract the opponent's back rank (top of board) as a file-indexed array. */
function enemyBackRank(pos: Position, size: BoardSize): (PieceType | null)[] {
  const out: (PieceType | null)[] = [];
  for (let f = 0; f < size.files; f++) {
    const p = pos.pieces.get(`${FILES[f]}${size.ranks}`);
    out.push(p && p.side === "opponent" ? p.type : null);
  }
  return out;
}

function makeSkirmishRun(overrides?: Partial<RunState>): RunState {
  return {
    ...createRun({ mode: "skirmish", rngSeed: 42 }),
    ...overrides,
  };
}

describe("Skirmish constants", () => {
  it("starting roster has 6 pieces: K + 3P + N + B", () => {
    expect(SKIRMISH_STARTING_ROSTER).toHaveLength(6);
    const types = SKIRMISH_STARTING_ROSTER.map((p) => p.type).sort();
    expect(types).toEqual(["bishop", "king", "knight", "pawn", "pawn", "pawn"]);
  });

  it("board sizes scale per act", () => {
    expect(skirmishBoardSize(1)).toEqual({ files: 6, ranks: 6 });
    expect(skirmishBoardSize(3)).toEqual({ files: 6, ranks: 6 });
    expect(skirmishBoardSize(4)).toEqual({ files: 7, ranks: 7 });
    expect(skirmishBoardSize(6)).toEqual({ files: 7, ranks: 7 });
    expect(skirmishBoardSize(7)).toEqual({ files: 8, ranks: 8 });
    expect(skirmishBoardSize(9)).toEqual({ files: 8, ranks: 8 });
  });

  it("value cap scales from 8 to 40", () => {
    expect(skirmishValueCap(1)).toBe(8);
    expect(skirmishValueCap(9)).toBe(40);
    for (let m = 1; m <= 8; m++) {
      expect(skirmishValueCap(m + 1)).toBeGreaterThan(skirmishValueCap(m));
    }
  });

  it("piece values match design", () => {
    expect(SKIRMISH_PIECE_VALUE.pawn).toBe(1);
    expect(SKIRMISH_PIECE_VALUE.knight).toBe(3);
    expect(SKIRMISH_PIECE_VALUE.bishop).toBe(3);
    expect(SKIRMISH_PIECE_VALUE.rook).toBe(5);
    expect(SKIRMISH_PIECE_VALUE.queen).toBe(9);
    expect(SKIRMISH_PIECE_VALUE.king).toBe(0);
  });
});

describe("placementValue", () => {
  it("sums piece values", () => {
    expect(placementValue(["king", "knight", "bishop"])).toBe(6);
    expect(placementValue(["queen", "rook"])).toBe(14);
    expect(placementValue(["pawn", "pawn", "pawn"])).toBe(3);
  });
});

describe("generatePieceDraftOffer", () => {
  it("produces the expected number of choices", () => {
    const run = makeSkirmishRun();
    const { offer } = generatePieceDraftOffer(run);
    // Assert against independent literal expectations (3 choices, 5 skip gold)
    // rather than the constants used to build the offer, so a regression that
    // changes both the constant and the output in lockstep is still caught.
    expect(offer.pieces).toHaveLength(3);
    expect(offer.skipGold).toBe(5);
    // Keep the constants pinned to those literals too, so an intentional change
    // surfaces here as a deliberate update rather than silently passing.
    expect(PIECE_DRAFT_SIZE).toBe(3);
    expect(PIECE_SKIP_GOLD).toBe(5);
  });

  it("only offers draftable types (no king)", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const run = makeSkirmishRun({ rngSeed: seed });
      const { offer } = generatePieceDraftOffer(run);
      for (const t of offer.pieces) {
        expect(t).not.toBe("king");
      }
    }
  });

  it("filters out pawns at the hard cap", () => {
    const pawns = Array.from({ length: PAWN_HARD_CAP }, () => ({
      type: "pawn" as PieceType,
      side: "player" as const,
    }));
    const run = makeSkirmishRun({
      roster: [...SKIRMISH_STARTING_ROSTER, ...pawns],
    });
    for (let seed = 1; seed <= 20; seed++) {
      const { offer } = generatePieceDraftOffer({ ...run, rngSeed: seed });
      for (const t of offer.pieces) {
        expect(t).not.toBe("pawn");
      }
    }
  });
});

describe("draftPiece / skipPieceDraft", () => {
  it("adds the piece to the roster", () => {
    const run = makeSkirmishRun();
    const next = draftPiece(run, "rook");
    expect(next.roster).toHaveLength((run.roster?.length ?? 0) + 1);
    expect(next.roster![next.roster!.length - 1].type).toBe("rook");
  });

  it("skip adds gold", () => {
    const run = makeSkirmishRun({ gold: 10 });
    const next = skipPieceDraft(run, 5);
    expect(next.gold).toBe(15);
  });
});

describe("rosterPawnCount", () => {
  it("counts only pawns", () => {
    expect(rosterPawnCount(SKIRMISH_STARTING_ROSTER)).toBe(3);
  });
});

describe("createRun for Skirmish", () => {
  it("starts with the correct roster and placement phase", () => {
    const run = createRun({ mode: "skirmish" });
    expect(run.phase).toBe("placement");
    expect(run.roster).toHaveLength(6);
    expect(run.config).toEqual({ actCount: 3, matchesPerAct: 3 });
  });
});

describe("validatePlacement", () => {
  it("valid placement passes", () => {
    // K on file 2, N on file 0, B on file 3 — all valid on a 6-file board
    const backRank: (PieceType | null)[] = ["knight", null, "king", "bishop", null, null];
    const pawnRank = [true, true, false, false, false, false];
    const result = validatePlacement(backRank, pawnRank, 6, 1);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when king is missing", () => {
    const backRank: (PieceType | null)[] = ["knight", null, null, "bishop", null, null];
    const result = validatePlacement(backRank, [false, false, false, false, false, false], 6, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("King"))).toBe(true);
  });

  it("fails when two bishops are on same-colored squares", () => {
    // Both bishops on even files (0 and 2)
    const backRank: (PieceType | null)[] = ["bishop", null, "bishop", "king", null, null];
    const result = validatePlacement(backRank, [false, false, false, false, false, false], 6, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Bishops"))).toBe(true);
  });

  it("fails when king is not between rooks", () => {
    // King on file 0, rooks on files 2 and 4
    const backRank: (PieceType | null)[] = ["king", null, "rook", null, "rook", null];
    const result = validatePlacement(backRank, [false, false, false, false, false, false], 6, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("rooks"))).toBe(true);
  });

  it("passes when king is between rooks", () => {
    const backRank: (PieceType | null)[] = ["rook", null, "king", null, "rook", null];
    const result = validatePlacement(backRank, [false, false, false, false, false, false], 6, 3);
    expect(result.valid).toBe(true);
  });

  it("fails when value exceeds cap", () => {
    // Queen (9) + rook (5) + king (0) + 2 pawns (2) = 16, cap for M1 = 8
    const backRank: (PieceType | null)[] = ["rook", null, "king", null, "queen", null];
    const pawnRank = [true, true, false, false, false, false];
    const result = validatePlacement(backRank, pawnRank, 6, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cap"))).toBe(true);
  });
});

describe("buildSkirmishFen", () => {
  it("produces a parseable FEN with both sides", () => {
    // knight(3)+king+bishop(3) + 2 pawns = 8 == M1 cap → exact mirror, no filler.
    const backRank: (PieceType | null)[] = ["knight", null, "king", "bishop", null, null];
    const pawnFiles = [true, true, false, false, false, false];
    const size = { files: 6, ranks: 6 };
    const rng = makeRng(42);
    const fen = buildSkirmishFen(backRank, pawnFiles, size, 1, rng);
    const pos = parseFen(fen, size);
    expect(pos.pieces.size).toBeGreaterThanOrEqual(6);
    // Player king should be on c1
    const playerKing = pos.pieces.get("c1");
    expect(playerKing?.type).toBe("king");
    expect(playerKing?.side).toBe("player");
    // Player knight on a1
    expect(pos.pieces.get("a1")?.type).toBe("knight");
  });

  it("mirrors the player exactly when placed to (or over) the cap — no filler", () => {
    // rook(5)+king+knight(3) + 2 pawns = 10 ≥ M1 cap 8 → gap clamps to 0.
    const backRank: (PieceType | null)[] = ["rook", null, "king", null, null, "knight"];
    const pawnFiles = [true, true, false, false, false, false];
    const size = { files: 6, ranks: 6 };
    const rng = makeRng(99);
    const fen = buildSkirmishFen(backRank, pawnFiles, size, 1, rng);
    const pos = parseFen(fen, size);
    const aiTypes = [...pos.pieces.entries()]
      .filter(([, p]) => p.side === "opponent")
      .map(([, p]) => p.type)
      .sort();
    expect(aiTypes.filter((t) => t !== "pawn").sort()).toEqual(["king", "knight", "rook"]);
    expect(aiTypes.filter((t) => t === "pawn")).toHaveLength(2);
  });

  it("conscripts filler up to the cap when the player under-places", () => {
    // rook(5)+king+queen(9) = 14, M4 cap 20 → gap 6. Filler = rook(5) then a
    // pawn(1) (queen never affordable at gap ≤ 6), so enemy value is exactly 20
    // regardless of seed.
    const backRank: (PieceType | null)[] = ["rook", "king", "queen", null, null, null, null];
    const pawnFiles = [false, false, false, false, false, false, false];
    const size = { files: 7, ranks: 7 };
    for (const seed of [1, 7, 42]) {
      const fen = buildSkirmishFen(backRank, pawnFiles, size, 4, makeRng(seed));
      const pos = parseFen(fen, size);
      expect(enemyValue(pos)).toBe(20);
    }
  });

  it("draws filler only from the player's placed composition (knights → knights/pawns)", () => {
    // Player brings only knights. Filler must never include rook/bishop/queen.
    const backRank: (PieceType | null)[] = ["knight", "king", "knight", null, null, null, null];
    const pawnFiles = [false, false, false, false, false, false, false];
    const size = { files: 7, ranks: 7 };
    for (let seed = 1; seed <= 20; seed++) {
      const fen = buildSkirmishFen(backRank, pawnFiles, size, 4, makeRng(seed));
      const pos = parseFen(fen, size);
      for (const [, p] of pos.pieces) {
        if (p.side !== "opponent") continue;
        expect(["king", "knight", "pawn"]).toContain(p.type);
      }
    }
  });

  it("keeps the conscripted enemy back rank legal for every seed", () => {
    // Brings a rook + bishop so filler can exercise both legality constraints.
    const backRank: (PieceType | null)[] = ["rook", "knight", "bishop", "king", null, null, null];
    const pawnFiles = [true, true, false, false, false, false, false];
    const size = { files: 7, ranks: 7 };
    for (let seed = 1; seed <= 20; seed++) {
      const fen = buildSkirmishFen(backRank, pawnFiles, size, 5, makeRng(seed));
      const pos = parseFen(fen, size);
      const rank = enemyBackRank(pos, size);
      expect(backRankLegalityErrors(rank)).toEqual([]);
      expect(rank.filter((t) => t === "king")).toHaveLength(1);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const backRank: (PieceType | null)[] = ["rook", "knight", "bishop", "king", null, null, null];
    const pawnFiles = [true, true, false, false, false, false, false];
    const size = { files: 7, ranks: 7 };
    const a = buildSkirmishFen(backRank, pawnFiles, size, 5, makeRng(7));
    const b = buildSkirmishFen(backRank, pawnFiles, size, 5, makeRng(7));
    expect(a).toBe(b);
  });

  it("terminates and stays legal/at-or-under cap on a cramped small board", () => {
    // 6x6, M1 cap 8, place K+N (3) → gap 5 but few empty files. Must not throw.
    const backRank: (PieceType | null)[] = ["knight", "king", null, null, null, null];
    const pawnFiles = [false, false, false, false, false, false];
    const size = { files: 6, ranks: 6 };
    for (let seed = 1; seed <= 20; seed++) {
      const fen = buildSkirmishFen(backRank, pawnFiles, size, 1, makeRng(seed));
      const pos = parseFen(fen, size);
      expect(backRankLegalityErrors(enemyBackRank(pos, size))).toEqual([]);
      expect(enemyValue(pos)).toBeLessThanOrEqual(8);
    }
  });

  it("uses the boss army, not the player, when an aiPieceSet is given", () => {
    const backRank: (PieceType | null)[] = ["knight", "king", null, null, null, null];
    const pawnFiles = [true, false, false, false, false, false];
    const size = { files: 6, ranks: 6 };
    const bossSet: PieceSet = { backRank: ["king", "rook"], pawns: 2 };
    const fen = buildSkirmishFen(backRank, pawnFiles, size, 3, makeRng(3), bossSet);
    const pos = parseFen(fen, size);
    const aiTypes = [...pos.pieces.entries()]
      .filter(([, p]) => p.side === "opponent")
      .map(([, p]) => p.type)
      .sort();
    expect(aiTypes.filter((t) => t !== "pawn").sort()).toEqual(["king", "rook"]);
    expect(aiTypes.filter((t) => t === "pawn")).toHaveLength(2);
  });
});
