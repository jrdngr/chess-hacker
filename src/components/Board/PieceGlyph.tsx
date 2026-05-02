// Lichess-default chess piece glyphs (Cburnett SVG set).
//
// The SVGs are served as static files from /pieces/{w,b}{K,Q,R,B,N,P}.svg.
// Source: https://github.com/lichess-org/lila/tree/master/public/piece/cburnett
// (Cburnett, CC-BY-SA 3.0).

import type { Piece, PieceType, Side } from "../../game/types";

import styles from "./PieceGlyph.module.css";

type Props = {
  piece: Piece;
};

const TYPE_CODE: Record<PieceType, string> = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "P",
};

const SIDE_CODE: Record<Side, string> = {
  player: "w",
  opponent: "b",
};

function pieceUrl(piece: Piece): string {
  return `/pieces/${SIDE_CODE[piece.side]}${TYPE_CODE[piece.type]}.svg`;
}

export function PieceGlyph({ piece }: Props) {
  return (
    <img
      className={styles.glyph}
      src={pieceUrl(piece)}
      alt={`${piece.side} ${piece.type}`}
      draggable={false}
    />
  );
}
