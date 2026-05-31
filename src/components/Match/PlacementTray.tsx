import { PieceGlyph } from "../Board/PieceGlyph";
import { SKIRMISH_PIECE_VALUE } from "../../game/progression/skirmish";
import type { Piece, PieceType } from "../../game/types";

import styles from "./PlacementTray.module.css";

type Props = {
  roster: ReadonlyArray<Piece>;
  placedIndicesSet: ReadonlySet<number>;
  selectedTrayIdx: number | null;
  currentValue: number;
  valueCap: number;
  conscriptValue: number;
  validationErrors: string[];
  canStart: boolean;
  subtitle: string;
  onTrayClick: (rosterIdx: number) => void;
  onTrayDragStart: (e: React.DragEvent, rosterIdx: number, pieceType: PieceType) => void;
  onTrayDragEnd: () => void;
  onTrayDragOver: (e: React.DragEvent) => void;
  onTrayDrop: (e: React.DragEvent) => void;
  onAutoPlace: () => void;
  onConfirm: () => void;
};

export function PlacementTray({
  roster,
  placedIndicesSet,
  selectedTrayIdx,
  currentValue,
  valueCap,
  conscriptValue,
  validationErrors,
  canStart,
  subtitle,
  onTrayClick,
  onTrayDragStart,
  onTrayDragEnd,
  onTrayDragOver,
  onTrayDrop,
  onAutoPlace,
  onConfirm,
}: Props) {
  return (
    <div className={styles.tray} onDragOver={onTrayDragOver} onDrop={onTrayDrop}>
      <div className={styles.trayTop}>
        <span className={styles.subtitle}>{subtitle}</span>
        <span className={`${styles.valueMeter} ${currentValue > valueCap ? styles.overCap : ""}`}>
          Value: {currentValue} / {valueCap}
        </span>
        {conscriptValue > 0 && (
          <span
            className={styles.conscripts}
            title="The enemy conscripts the value you leave unplaced."
          >
            Enemy conscripts: +{conscriptValue}
          </span>
        )}
        {validationErrors.length > 0 && (
          <span className={styles.errors}>
            {validationErrors.map((e, i) => (
              <span key={i} className={styles.error}>
                {e}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className={styles.trayPieces}>
        {roster.map((p, i) => {
          if (placedIndicesSet.has(i)) return null;
          const isSelected = selectedTrayIdx === i;
          return (
            <button
              key={`${p.type}-${i}`}
              type="button"
              className={`${styles.trayPiece} ${isSelected ? styles.selected : ""}`}
              onClick={() => onTrayClick(i)}
              draggable
              onDragStart={(e) => onTrayDragStart(e, i, p.type)}
              onDragEnd={onTrayDragEnd}
              aria-label={`${p.type} (${SKIRMISH_PIECE_VALUE[p.type]} value)`}
            >
              <span className={styles.trayGlyph}>
                <PieceGlyph piece={p} />
              </span>
              <span className={styles.trayLabel}>{p.type}</span>
            </button>
          );
        })}
        {placedIndicesSet.size === roster.length && (
          <span className={styles.trayEmpty}>All pieces placed</span>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.autoButton} onClick={onAutoPlace}>
          Auto-place
        </button>
        <button
          type="button"
          className={styles.startButton}
          disabled={!canStart}
          onClick={onConfirm}
        >
          Start match
        </button>
      </div>
    </div>
  );
}
