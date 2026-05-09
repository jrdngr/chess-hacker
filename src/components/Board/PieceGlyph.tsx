// Lichess-default chess piece glyphs (Cburnett SVG set), recoloured per
// active palette via `mask-image`. The SVG's alpha defines the silhouette;
// the underlying div fills with `--piece-mine` / `--piece-opp` so player
// pieces are amber and opponent pieces are red, with a matching-tone glow.
//
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
  const sideClass = piece.side === "player" ? styles.player : styles.opponent;
  const url = pieceUrl(piece);
  return (
    <span
      className={`${styles.glyph} ${sideClass}`}
      style={{
        // Same URL feeds both webkit + standard mask properties.
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
      }}
      role="img"
      aria-label={`${piece.side} ${piece.type}`}
    />
  );
}
