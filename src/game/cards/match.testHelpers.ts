import type { BoardContext, PlayTarget } from "./match";
import type { Piece, Side } from "../types";

export const emptyBoard: BoardContext = {
  pieceAt: () => null,
  hasWall: () => false,
  isAttackedBy: () => false,
  isRooted: () => false,
};

export function noTarget(): PlayTarget {
  return { kind: "none" };
}

type WithPiecesOptions = {
  attackedByPlayer?: ReadonlySet<string>;
  rooted?: ReadonlySet<string>;
  boardRanks?: number;
  boardFiles?: number;
};

export function withPieces(map: Record<string, Piece>, opts: WithPiecesOptions = {}): BoardContext {
  const attacked = opts.attackedByPlayer ?? new Set<string>();
  const rooted = opts.rooted ?? new Set<string>();
  return {
    pieceAt: (sq) => map[sq] ?? null,
    hasWall: () => false,
    isAttackedBy: (sq, by: Side) => by === "player" && attacked.has(sq),
    isRooted: (sq) => rooted.has(sq),
    boardRanks: opts.boardRanks,
    boardFiles: opts.boardFiles,
  };
}
