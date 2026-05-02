// Geometric glyphs for each piece type. Per docs/design/theme.md:
//   king   = crown silhouette (filled triangle with notches)
//   queen  = diamond
//   rook   = square block
//   bishop = tall pointed triangle
//   knight = asymmetric L / arrow
//   pawn   = small circle
//
// Same shape for both sides; color distinguishes them.

import type { Piece, PieceType } from "../../game/types";

import styles from "./PieceGlyph.module.css";

type Props = {
  piece: Piece;
};

// Each glyph is drawn inside a 100×100 viewBox.
const GLYPHS: Record<PieceType, JSX.Element> = {
  // Crown: a triangle with three notches cut from the top.
  king: (
    <path
      d="M 18 80
         L 18 38
         L 32 50
         L 38 28
         L 50 46
         L 62 28
         L 68 50
         L 82 38
         L 82 80 Z"
      fill="currentColor"
    />
  ),
  // Diamond.
  queen: <polygon points="50,16 84,50 50,84 16,50" fill="currentColor" />,
  // Square block.
  rook: <rect x="22" y="22" width="56" height="56" fill="currentColor" />,
  // Tall pointed triangle.
  bishop: <polygon points="50,14 80,82 20,82" fill="currentColor" />,
  // Asymmetric arrow / L.
  knight: (
    <path
      d="M 24 80
         L 24 44
         L 50 18
         L 76 36
         L 60 36
         L 60 56
         L 76 56
         L 76 80 Z"
      fill="currentColor"
    />
  ),
  // Small circle.
  pawn: <circle cx="50" cy="50" r="22" fill="currentColor" />,
};

export function PieceGlyph({ piece }: Props) {
  const sideClass = piece.side === "player" ? styles.player : styles.opponent;
  return (
    <svg
      className={`${styles.glyph} ${sideClass}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${piece.side} ${piece.type}`}
    >
      {GLYPHS[piece.type]}
    </svg>
  );
}
