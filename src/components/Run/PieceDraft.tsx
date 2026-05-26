import { PieceGlyph } from "../Board/PieceGlyph";
import { SKIRMISH_PIECE_VALUE, placementValue } from "../../game/progression/skirmish";
import type { Piece, PieceDraftOffer, PieceType } from "../../game/types";

import styles from "./PieceDraft.module.css";

type Props = {
  offer: PieceDraftOffer;
  roster: ReadonlyArray<Piece>;
  nextMatchValueCap: number | null;
  onPick: (pieceType: PieceType) => void;
  onSkip: () => void;
};

const PIECE_NAMES: Record<PieceType, string> = {
  pawn: "Pawn",
  knight: "Knight",
  bishop: "Bishop",
  rook: "Rook",
  queen: "Queen",
  king: "King",
};

export function PieceDraft({ offer, roster, nextMatchValueCap, onPick, onSkip }: Props) {
  const rosterTypes = roster.map((p) => p.type);
  const totalValue = placementValue(rosterTypes);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Draft a piece</h2>
        <p className={styles.subtitle}>Add a piece to your roster for future matches.</p>
      </header>

      <div className={styles.draftRow} role="list" aria-label="Piece draft offers">
        {offer.pieces.map((type, i) => (
          <button
            key={`${type}-${i}`}
            type="button"
            role="listitem"
            className={styles.pieceCard}
            onClick={() => onPick(type)}
            aria-label={`Draft ${PIECE_NAMES[type]} (value ${SKIRMISH_PIECE_VALUE[type]})`}
          >
            <span className={styles.pieceGlyph}>
              <PieceGlyph piece={{ type, side: "player" }} />
            </span>
            <span className={styles.pieceName}>{PIECE_NAMES[type]}</span>
            <span className={styles.pieceValue}>{SKIRMISH_PIECE_VALUE[type]} value</span>
          </button>
        ))}
      </div>

      <div className={styles.roster}>
        {roster.map((p, i) => (
          <span key={`${p.type}-${i}`} className={styles.rosterPiece}>
            <PieceGlyph piece={p} />
          </span>
        ))}
      </div>
      <p className={styles.rosterInfo}>
        Roster: {roster.length} pieces, {totalValue} total value
        {nextMatchValueCap !== null && ` · Next match budget: ${nextMatchValueCap}`}
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip for {offer.skipGold} gold
        </button>
      </div>
    </div>
  );
}
