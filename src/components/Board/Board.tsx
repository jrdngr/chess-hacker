// 8x8 board. Click a piece to select; click a highlighted square to move.
// Both sides controlled by the human (M1 milestone — AI arrives in M2).

import { squareName, type ChoseEngine, type LegalMove } from "../../game/chess/engine";
import type { AlgebraicSquare, FileIndex, Piece, RankIndex } from "../../game/types";

import { PieceGlyph } from "./PieceGlyph";
import styles from "./Board.module.css";

type Props = {
  engine: ChoseEngine;
  selected: AlgebraicSquare | null;
  legalMovesFromSelected: LegalMove[];
  onSquareClick: (square: AlgebraicSquare) => void;
  /** Disable interaction (e.g. when the match is over). */
  locked?: boolean;
};

const RANKS_TOP_DOWN: RankIndex[] = [7, 6, 5, 4, 3, 2, 1, 0];
const FILES_LEFT_RIGHT: FileIndex[] = [0, 1, 2, 3, 4, 5, 6, 7];

export function Board({ engine, selected, legalMovesFromSelected, onSquareClick, locked }: Props) {
  // ChoseEngine mutates internally on move(), so we recompute these every render.
  // Memoizing on `[engine]` would serve stale data because the ref doesn't change.
  const piecesBySquare = new Map<AlgebraicSquare, Piece>();
  for (const { square, piece } of engine.pieces()) piecesBySquare.set(square, piece);

  const targetMoves = new Map<AlgebraicSquare, LegalMove>();
  for (const mv of legalMovesFromSelected) targetMoves.set(mv.to, mv);

  // Highlight the king's square when the side-to-move is in check.
  let checkSquare: AlgebraicSquare | null = null;
  if (engine.inCheck()) {
    const sideInCheck = engine.turn();
    for (const { square, piece } of engine.pieces()) {
      if (piece.type === "king" && piece.side === sideInCheck) {
        checkSquare = square;
        break;
      }
    }
  }

  return (
    <div className={styles.boardWrapper} aria-label="Chess board">
      <div className={styles.board} role="grid">
        {RANKS_TOP_DOWN.map((rank) => (
          <div key={rank} className={styles.row} role="row">
            {FILES_LEFT_RIGHT.map((file) => {
              const sq = squareName(file, rank);
              const piece = piecesBySquare.get(sq) ?? null;
              const isLight = (file + rank) % 2 === 1;
              const isSelected = selected === sq;
              const target = targetMoves.get(sq);
              const isInCheck = sq === checkSquare;

              const cls = [
                styles.square,
                isLight ? styles.light : styles.dark,
                isSelected && styles.selected,
                target && (target.isCapture ? styles.capture : styles.target),
                isInCheck && styles.check,
                locked && styles.locked,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={sq}
                  type="button"
                  className={cls}
                  role="gridcell"
                  aria-label={describeSquare(sq, piece, target)}
                  onClick={() => !locked && onSquareClick(sq)}
                  disabled={locked}
                >
                  {file === 0 && <span className={styles.rankLabel}>{rank + 1}</span>}
                  {rank === 0 && <span className={styles.fileLabel}>{"abcdefgh"[file]}</span>}
                  {piece && <PieceGlyph piece={piece} />}
                  {target && !piece && <span className={styles.targetDot} aria-hidden />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function describeSquare(
  sq: AlgebraicSquare,
  piece: ReturnType<ChoseEngine["pieces"]>[number]["piece"] | null,
  target: LegalMove | undefined,
): string {
  const parts: string[] = [sq];
  if (piece) parts.push(`${piece.side} ${piece.type}`);
  if (target) parts.push(target.isCapture ? "capture" : "move");
  return parts.join(", ");
}
