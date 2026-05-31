import type { ChoseEngine, LegalMove } from "../../game/chess/engine";
import type { AlgebraicSquare, Card, MatchCardState } from "../../game/types";
import { isInPlayerHalf } from "../../game/cards/match";
import { fileOf, rankNumberOf } from "../../game/chess/coords";
import type { BoardMode } from "../Board/Board";

export function computeValidTargetSquares(
  targetingCard: Card | null,
  engine: ChoseEngine,
  cardState: MatchCardState,
  partialTarget: AlgebraicSquare | null,
  marionetteMoves: LegalMove[],
  walledSet: ReadonlySet<AlgebraicSquare>,
  rootedSet: ReadonlySet<AlgebraicSquare>,
): ReadonlySet<AlgebraicSquare> {
  if (!targetingCard) return new Set();
  const out = new Set<AlgebraicSquare>();
  const allPieces = engine.pieces();
  const targetKind = targetingCard.target.kind;
  if (targetKind === "marionette" && partialTarget) {
    for (const m of marionetteMoves) out.add(m.to);
    return out;
  }
  if (targetKind === "two-own-pieces" && partialTarget) {
    for (const { square, piece } of allPieces) {
      if (piece.side === "player" && square !== partialTarget) out.add(square);
    }
    return out;
  }
  if (targetKind === "marionette") {
    for (const { square, piece } of allPieces) {
      if (piece.side !== "opponent") continue;
      if (engine.foreignLegalMoves(square).length > 0) out.add(square);
    }
    return out;
  }
  if (targetKind === "two-own-pieces") {
    for (const { square, piece } of allPieces) {
      if (piece.side === "player") out.add(square);
    }
    return out;
  }
  if (targetKind === "two-enemy-non-king-pieces") {
    if (partialTarget) {
      for (const { square, piece } of allPieces) {
        if (piece.side !== "opponent") continue;
        if (piece.type === "king") continue;
        if (square === partialTarget) continue;
        out.add(square);
      }
      return out;
    }
    for (const { square, piece } of allPieces) {
      if (piece.side !== "opponent") continue;
      if (piece.type === "king") continue;
      out.add(square);
    }
    return out;
  }
  if (targetKind === "own-piece-then-adjacent-empty") {
    if (partialTarget) {
      const f0 = fileOf(partialTarget);
      const r0 = rankNumberOf(partialTarget);
      const { files, ranks } = engine.size();
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (df === 0 && dr === 0) continue;
          const f = f0 + df;
          const r = r0 + dr;
          if (f < 0 || f >= files) continue;
          if (r < 1 || r > ranks) continue;
          const sq = "abcdefgh"[f] + r;
          if (engine.pieceAt(sq)) continue;
          if (walledSet.has(sq)) continue;
          out.add(sq);
        }
      }
      return out;
    }
    for (const { square, piece } of allPieces) {
      if (piece.side !== "player") continue;
      if (piece.type === "king") continue;
      out.add(square);
    }
    return out;
  }
  if (
    targetKind === "square" ||
    targetKind === "empty-square" ||
    targetKind === "empty-square-own-half"
  ) {
    const allowOccupied = targetKind === "square";
    const ownHalfOnly = targetKind === "empty-square-own-half";
    const { files, ranks } = engine.size();
    for (let r = 1; r <= ranks; r++) {
      for (let f = 0; f < files; f++) {
        const sq = "abcdefgh"[f] + r;
        if (!allowOccupied && engine.pieceAt(sq)) continue;
        if (walledSet.has(sq)) continue;
        if (ownHalfOnly && !isInPlayerHalf(sq, ranks)) continue;
        out.add(sq);
      }
    }
    return out;
  }
  if (targetKind === "enemy-piece") {
    for (const { square, piece } of allPieces) {
      if (piece.side === "opponent") out.add(square);
    }
    return out;
  }
  if (targetKind === "enemy-non-king-piece") {
    const requireAttacked =
      targetingCard.effect.kind === "destroy-piece" &&
      targetingCard.effect.filter === "attacked-by-player";
    for (const { square, piece } of allPieces) {
      if (piece.side !== "opponent") continue;
      if (piece.type === "king") continue;
      if (requireAttacked && !engine.isSquareAttackedBy(square, "player")) continue;
      out.add(square);
    }
    return out;
  }
  if (targetKind === "rooted-enemy-and-own-piece" || targetKind === "enemy-and-own-piece") {
    if (partialTarget) {
      for (const { square, piece } of allPieces) {
        if (piece.side === "player" && square !== partialTarget) out.add(square);
      }
      return out;
    }
    for (const { square, piece } of allPieces) {
      if (piece.side !== "opponent") continue;
      if (piece.type === "king") continue;
      if (targetKind === "rooted-enemy-and-own-piece" && !rootedSet.has(square)) continue;
      out.add(square);
    }
    return out;
  }
  if (targetKind === "own-promotable-piece") {
    for (const { square, piece } of allPieces) {
      if (piece.side !== "player") continue;
      if (piece.type === "king" || piece.type === "queen") continue;
      out.add(square);
    }
    return out;
  }
  if (targetKind === "own-piece" || targetKind === "own-non-king-piece") {
    const excludeKing = targetKind === "own-non-king-piece";
    const patchPattern =
      targetingCard.effect.kind === "empower-piece" && targetingCard.effect.singleUse === true
        ? targetingCard.effect.pattern
        : null;
    for (const { square, piece } of allPieces) {
      if (piece.side !== "player") continue;
      if (excludeKing && piece.type === "king") continue;
      if (patchPattern !== null && piece.type === patchPattern) continue;
      out.add(square);
    }
    return out;
  }
  if (targetKind === "own-pawn") {
    for (const { square, piece } of allPieces) {
      if (piece.side === "player" && piece.type === "pawn") out.add(square);
    }
    return out;
  }
  if (targetKind === "enemy-minor-piece") {
    for (const { square, piece } of allPieces) {
      if (piece.side !== "opponent") continue;
      if (piece.type === "knight" || piece.type === "bishop" || piece.type === "pawn")
        out.add(square);
    }
    return out;
  }
  if (targetKind === "own-non-king-piece-then-empty-square") {
    if (partialTarget) {
      const { files, ranks } = engine.size();
      for (let r = 1; r <= ranks; r++) {
        for (let f = 0; f < files; f++) {
          const sq = "abcdefgh"[f] + String(r);
          if (engine.pieceAt(sq)) continue;
          if (walledSet.has(sq)) continue;
          out.add(sq);
        }
      }
      return out;
    }
    for (const { square, piece } of allPieces) {
      if (piece.side === "player" && piece.type !== "king") out.add(square);
    }
    return out;
  }
  if (targetKind === "own-piece-then-empty-square") {
    if (partialTarget) {
      const { files, ranks } = engine.size();
      for (let r = 1; r <= ranks; r++) {
        for (let f = 0; f < files; f++) {
          const sq = "abcdefgh"[f] + String(r);
          if (engine.pieceAt(sq)) continue;
          if (walledSet.has(sq)) continue;
          out.add(sq);
        }
      }
      return out;
    }
    for (const { square, piece } of allPieces) {
      if (piece.side === "player") out.add(square);
    }
    return out;
  }
  if (targetKind === "captured-friendly-piece-then-empty-square-own-half") {
    if (partialTarget) {
      const { files, ranks } = engine.size();
      const halfRank = Math.floor(ranks / 2);
      for (let r = 1; r <= halfRank; r++) {
        for (let f = 0; f < files; f++) {
          const sq = "abcdefgh"[f] + String(r);
          if (engine.pieceAt(sq)) continue;
          if (walledSet.has(sq)) continue;
          out.add(sq);
        }
      }
      return out;
    }
    if ((cardState.capturedPieces ?? []).length > 0) {
      const { files, ranks } = engine.size();
      const halfRank = Math.floor(ranks / 2);
      for (let r = 1; r <= halfRank; r++) {
        for (let f = 0; f < files; f++) {
          const sq = "abcdefgh"[f] + String(r);
          if (engine.pieceAt(sq)) continue;
          if (walledSet.has(sq)) continue;
          out.add(sq);
        }
      }
    }
    return out;
  }
  return out;
}

export function computeBoardMode(
  targetingCard: Card | null,
  partialTarget: AlgebraicSquare | null,
  validTargetSquares: ReadonlySet<AlgebraicSquare>,
): BoardMode {
  if (!targetingCard) return { kind: "play" };
  const k = targetingCard.target.kind;
  if (k === "none") {
    return {
      kind: "drop-anywhere",
      cardName: targetingCard.name,
      hint: `Drop anywhere on the board to play ${targetingCard.name}`,
    };
  }
  let hint = "";
  if (k === "square") hint = `Pick a square for ${targetingCard.name}`;
  else if (k === "empty-square") hint = `Pick an empty square for ${targetingCard.name}`;
  else if (k === "empty-square-own-half")
    hint = `Pick an empty square in your half (ranks 1–4) for ${targetingCard.name}`;
  else if (k === "enemy-piece") hint = `Pick an enemy piece for ${targetingCard.name}`;
  else if (k === "enemy-non-king-piece") {
    if (
      targetingCard.effect.kind === "destroy-piece" &&
      targetingCard.effect.filter === "attacked-by-player"
    ) {
      hint = `Pick an enemy piece your forces are attacking for ${targetingCard.name}`;
    } else {
      hint = `Pick an enemy non-King piece for ${targetingCard.name}`;
    }
  } else if (k === "own-piece") hint = `Pick one of your pieces for ${targetingCard.name}`;
  else if (k === "own-non-king-piece")
    hint = `Pick one of your non-King pieces for ${targetingCard.name}`;
  else if (k === "two-own-pieces")
    hint = partialTarget
      ? `Pick the second piece for ${targetingCard.name}`
      : `Pick the first piece for ${targetingCard.name}`;
  else if (k === "two-enemy-non-king-pieces")
    hint = partialTarget
      ? `Pick the second enemy non-King piece for ${targetingCard.name}`
      : `Pick the first enemy non-King piece for ${targetingCard.name}`;
  else if (k === "own-piece-then-adjacent-empty")
    hint = partialTarget
      ? `Pick an adjacent empty square for ${targetingCard.name}`
      : `Pick one of your pieces for ${targetingCard.name}`;
  else if (k === "marionette")
    hint = partialTarget
      ? `Pick a destination for ${targetingCard.name}`
      : `Pick an enemy piece to control with ${targetingCard.name}`;
  else if (k === "rooted-enemy-and-own-piece")
    hint = partialTarget
      ? `Pick one of your pieces to swap with the rooted enemy for ${targetingCard.name}`
      : `Pick a rooted enemy piece for ${targetingCard.name}`;
  else if (k === "enemy-and-own-piece")
    hint = partialTarget
      ? `Pick one of your pieces to swap with the chosen enemy for ${targetingCard.name}`
      : `Pick an enemy piece for ${targetingCard.name}`;
  else if (k === "own-pawn") hint = `Pick one of your pawns for ${targetingCard.name}`;
  else if (k === "enemy-minor-piece")
    hint = `Pick an enemy knight, bishop, or pawn for ${targetingCard.name}`;
  else if (k === "own-non-king-piece-then-empty-square")
    hint = partialTarget
      ? `Pick any empty square for ${targetingCard.name}`
      : `Pick one of your non-King pieces for ${targetingCard.name}`;
  else if (k === "own-piece-then-empty-square")
    hint = partialTarget
      ? `Pick any empty square for ${targetingCard.name}`
      : `Pick one of your pieces for ${targetingCard.name}`;
  else if (k === "own-promotable-piece")
    hint = `Pick a pawn, knight, bishop, or rook for ${targetingCard.name}`;
  else if (k === "captured-friendly-piece-then-empty-square-own-half")
    hint = `Pick an empty square in your half to place the revived piece for ${targetingCard.name}`;
  return { kind: "target", cardName: targetingCard.name, hint, valid: validTargetSquares };
}
