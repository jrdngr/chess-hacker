// Inline-SVG chess pieces (Cburnett, CC-BY-SA 3.0). Each SVG is imported as
// raw text and recolored via an injected <style> block: the body fills swap
// to `--piece-fill` and the inner stroke details to `--piece-outline`, which
// the wrapper sets to a slightly darker shade of the side colour. This keeps
// the silhouette tinted to the active palette while the original outline
// detail (knight's eye, rook crenellations, queen's collar, etc.) reads.
//
// Source: https://github.com/lichess-org/lila/tree/master/public/piece/cburnett

import type { Piece, PieceType, Side } from "../../game/types";

import bB from "../../assets/pieces/bB.svg?raw";
import bK from "../../assets/pieces/bK.svg?raw";
import bN from "../../assets/pieces/bN.svg?raw";
import bP from "../../assets/pieces/bP.svg?raw";
import bQ from "../../assets/pieces/bQ.svg?raw";
import bR from "../../assets/pieces/bR.svg?raw";
import wB from "../../assets/pieces/wB.svg?raw";
import wK from "../../assets/pieces/wK.svg?raw";
import wN from "../../assets/pieces/wN.svg?raw";
import wP from "../../assets/pieces/wP.svg?raw";
import wQ from "../../assets/pieces/wQ.svg?raw";
import wR from "../../assets/pieces/wR.svg?raw";

import styles from "./PieceGlyph.module.css";

type Props = {
  piece: Piece;
};

const SOURCES: Record<Side, Record<PieceType, string>> = {
  player: { king: wK, queen: wQ, rook: wR, bishop: wB, knight: wN, pawn: wP },
  opponent: { king: bK, queen: bQ, rook: bR, bishop: bB, knight: bN, pawn: bP },
};

// White-source SVGs use #fff for body fills and #000 for outlines/details;
// black-source SVGs use #000 for body fills and #ececec for inner details.
// We rewrite the colour attributes directly so the var()s land on each
// element without relying on a CSS attribute-selector cascade. A default
// fill is added to the root <svg> so paths in bP/bQ/bR (which rely on SVG's
// implicit black fill) inherit the body colour.
function recolor(svg: string, side: Side): string {
  const bodyFill = "var(--piece-fill)";
  const outlineFill = "var(--piece-outline)";
  const bodyHex = side === "player" ? '"#fff"' : '"#000"';
  const detailHex = side === "player" ? '"#000"' : '"#ececec"';
  return svg
    .replace(new RegExp(`fill=${bodyHex}`, "g"), `fill="${bodyFill}"`)
    .replace(new RegExp(`stroke=${bodyHex}`, "g"), `stroke="${bodyFill}"`)
    .replace(new RegExp(`fill=${detailHex}`, "g"), `fill="${outlineFill}"`)
    .replace(new RegExp(`stroke=${detailHex}`, "g"), `stroke="${outlineFill}"`)
    .replace(/<svg([^>]*)>/, `<svg$1 fill="${bodyFill}">`);
}

const RECOLORED: Record<Side, Record<PieceType, string>> = {
  player: {
    king: recolor(SOURCES.player.king, "player"),
    queen: recolor(SOURCES.player.queen, "player"),
    rook: recolor(SOURCES.player.rook, "player"),
    bishop: recolor(SOURCES.player.bishop, "player"),
    knight: recolor(SOURCES.player.knight, "player"),
    pawn: recolor(SOURCES.player.pawn, "player"),
  },
  opponent: {
    king: recolor(SOURCES.opponent.king, "opponent"),
    queen: recolor(SOURCES.opponent.queen, "opponent"),
    rook: recolor(SOURCES.opponent.rook, "opponent"),
    bishop: recolor(SOURCES.opponent.bishop, "opponent"),
    knight: recolor(SOURCES.opponent.knight, "opponent"),
    pawn: recolor(SOURCES.opponent.pawn, "opponent"),
  },
};

export function PieceGlyph({ piece }: Props) {
  const sideClass = piece.side === "player" ? styles.player : styles.opponent;
  return (
    <span
      className={`${styles.glyph} ${sideClass}`}
      role="img"
      aria-label={`${piece.side} ${piece.type}`}
      dangerouslySetInnerHTML={{ __html: RECOLORED[piece.side][piece.type] }}
    />
  );
}
