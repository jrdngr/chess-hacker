// Captured-piece row, rendered above and below the board (Lichess style).
//
// The pieces are sorted lowest-value-first within a row. If a side has a
// material advantage, a "+N" indicator appears at the end of *that side's*
// row (the side that's ahead).

import type { Piece } from "../../game/types";

import { PieceGlyph } from "./PieceGlyph";
import { PIECE_VALUE } from "./material";
import styles from "./CapturedPieces.module.css";

type Props = {
  /** Pieces the side this row belongs to has captured (i.e. the loser's pieces). */
  pieces: Piece[];
  /** Material advantage in pawns to show as "+N", or undefined / 0 to hide. */
  advantage?: number;
};

export function CapturedPieces({ pieces, advantage }: Props) {
  const sorted = [...pieces].sort((a, b) => PIECE_VALUE[a.type] - PIECE_VALUE[b.type]);

  return (
    <div className={styles.row} aria-label="Captured pieces">
      {sorted.map((p, i) => (
        <span key={i} className={`${styles.cell} ${p.side === "opponent" ? styles.darkPiece : ""}`}>
          <PieceGlyph piece={p} />
        </span>
      ))}
      {advantage !== undefined && advantage > 0 && (
        <span className={styles.advantage}>+{advantage}</span>
      )}
    </div>
  );
}
