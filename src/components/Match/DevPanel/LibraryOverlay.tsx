import { useMemo } from "react";

import { groupCardsByArchetype } from "../../../game/cards/library";
import type { Card } from "../../../game/types";

import styles from "./DevPanel.module.css";

type Props = {
  libraryDisabled: boolean;
  onPlayLibraryCard: (card: Card) => void;
  /** Drag a library card onto the board (synth + enter targeting). */
  onLibraryCardDragStart: (card: Card) => void;
  onLibraryCardDragEnd: () => void;
  onClose: () => void;
};

export function LibraryOverlay({
  libraryDisabled,
  onPlayLibraryCard,
  onLibraryCardDragStart,
  onLibraryCardDragEnd,
  onClose,
}: Props) {
  const groupedCards = useMemo(() => groupCardsByArchetype(), []);

  return (
    <aside className={`${styles.devPanel} ${styles.libraryPanel}`}>
      <div className={styles.libraryHeader}>
        <h3 className={styles.heading}>Library</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close library"
        >
          ×
        </button>
      </div>
      <p className={styles.note}>
        Plays are free and don't enter the spent pile. Effects (statuses, added cards, summons)
        persist. Click to play, or drag onto the board.
      </p>
      <div className={styles.libraryListFull}>
        {groupedCards.map(([archetype, cards]) => (
          <div key={archetype} className={styles.libraryGroup}>
            <div className={styles.libraryGroupHeading}>{archetype}</div>
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={styles.libraryCard}
                disabled={libraryDisabled}
                onClick={() => onPlayLibraryCard(card)}
                draggable={!libraryDisabled}
                onDragStart={(e) => {
                  if (libraryDisabled) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", card.id);
                  if (typeof e.dataTransfer.setDragImage === "function") {
                    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                  }
                  onLibraryCardDragStart(card);
                }}
                onDragEnd={onLibraryCardDragEnd}
                data-card-id={card.id}
              >
                <span className={styles.libraryCardCost}>{card.cost}</span>
                <span className={styles.libraryCardName}>{card.name}</span>
                <span className={styles.libraryCardDesc}>{card.description}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
