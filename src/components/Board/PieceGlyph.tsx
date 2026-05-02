// Traditional chess piece glyphs.
//
// Hand-authored SVG paths that read as classical chess pieces (king with
// cross, queen with 5-pointed crown, rook with battlements, bishop with
// mitre, knight as a horse head, pawn). Same shape for both sides; the
// piece's side colors the fill, and a dark stroke keeps light pieces
// readable on light squares.

import type { Piece, PieceType } from "../../game/types";

import styles from "./PieceGlyph.module.css";

type Props = {
  piece: Piece;
};

// Each glyph is drawn inside a 100×100 viewBox.
const GLYPHS: Record<PieceType, JSX.Element> = {
  king: (
    <g>
      {/* cross on top */}
      <path d="M 47 6 H 53 V 14 H 61 V 20 H 53 V 30 H 47 V 20 H 39 V 14 H 47 Z" />
      {/* crown / body */}
      <path
        d="M 50 30
           C 38 30 32 38 34 50
           L 28 56
           L 24 50
           L 22 64
           L 30 70
           L 28 82
           L 72 82
           L 70 70
           L 78 64
           L 76 50
           L 72 56
           L 66 50
           C 68 38 62 30 50 30 Z"
      />
      {/* base */}
      <path d="M 22 84 H 78 V 92 H 22 Z" />
    </g>
  ),
  queen: (
    <g>
      {/* five-pointed crown with dots */}
      <circle cx="20" cy="22" r="3" />
      <circle cx="35" cy="16" r="3" />
      <circle cx="50" cy="12" r="3" />
      <circle cx="65" cy="16" r="3" />
      <circle cx="80" cy="22" r="3" />
      <path
        d="M 20 26
           L 28 50
           L 35 22
           L 42 50
           L 50 18
           L 58 50
           L 65 22
           L 72 50
           L 80 26
           L 76 60
           L 24 60 Z"
      />
      {/* collar + body */}
      <path d="M 24 62 H 76 L 72 70 H 28 Z" />
      <path d="M 28 72 H 72 L 76 84 H 24 Z" />
      {/* base */}
      <path d="M 20 86 H 80 V 94 H 20 Z" />
    </g>
  ),
  rook: (
    <g>
      {/* battlements */}
      <path d="M 24 14 H 34 V 24 H 40 V 14 H 50 V 24 H 56 V 14 H 66 V 24 H 76 V 36 H 24 Z" />
      {/* neck */}
      <path d="M 30 38 H 70 V 44 H 30 Z" />
      {/* body taper */}
      <path d="M 32 46 H 68 L 72 78 H 28 Z" />
      {/* base */}
      <path d="M 22 80 H 78 V 88 H 22 Z" />
      <path d="M 18 90 H 82 V 96 H 18 Z" />
    </g>
  ),
  bishop: (
    <g>
      {/* finial */}
      <circle cx="50" cy="10" r="4" />
      {/* mitre */}
      <path
        d="M 50 14
           C 36 22 30 38 32 54
           L 68 54
           C 70 38 64 22 50 14 Z"
      />
      {/* slit */}
      <path d="M 44 30 H 56 V 34 H 44 Z" fill="rgba(0,0,0,0.55)" />
      {/* collar */}
      <path d="M 28 56 H 72 V 64 H 28 Z" />
      {/* body */}
      <path d="M 30 66 H 70 L 74 80 H 26 Z" />
      {/* base */}
      <path d="M 20 82 H 80 V 90 H 20 Z" />
      <path d="M 16 92 H 84 V 96 H 16 Z" />
    </g>
  ),
  knight: (
    <g>
      {/* horse head silhouette */}
      <path
        d="M 30 76
           L 30 60
           C 30 48 36 40 44 36
           L 40 28
           L 46 22
           L 50 14
           L 60 18
           L 70 30
           L 76 44
           L 78 60
           L 78 76 Z"
      />
      {/* mane cut */}
      <path
        d="M 60 28
           L 56 36
           L 64 36 Z"
        fill="rgba(0,0,0,0.5)"
      />
      {/* eye */}
      <circle cx="58" cy="42" r="2.4" fill="rgba(0,0,0,0.7)" />
      {/* base */}
      <path d="M 22 78 H 82 V 86 H 22 Z" />
      <path d="M 18 88 H 86 V 96 H 18 Z" />
    </g>
  ),
  pawn: (
    <g>
      {/* head */}
      <circle cx="50" cy="26" r="13" />
      {/* collar */}
      <path d="M 36 42 H 64 L 60 50 H 40 Z" />
      {/* body */}
      <path d="M 36 52 L 30 80 L 70 80 L 64 52 Z" />
      {/* base */}
      <path d="M 22 82 H 78 V 90 H 22 Z" />
      <path d="M 18 92 H 82 V 96 H 18 Z" />
    </g>
  ),
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
      <g
        fill="currentColor"
        stroke="var(--piece-outline, rgba(0,0,0,0.85))"
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {GLYPHS[piece.type]}
      </g>
    </svg>
  );
}
