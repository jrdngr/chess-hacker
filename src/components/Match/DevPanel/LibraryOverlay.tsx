import { useMemo, useState } from "react";

import { getUpgradedCard, groupCardsByArchetype } from "../../../game/cards/library";
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

function matchesSearch(card: Card, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const name = card.name.toLowerCase();
  return terms.every((term) => name.includes(term));
}

export function LibraryOverlay({
  libraryDisabled,
  onPlayLibraryCard,
  onLibraryCardDragStart,
  onLibraryCardDragEnd,
  onClose,
}: Props) {
  const groupedCards = useMemo(() => groupCardsByArchetype(), []);
  const [search, setSearch] = useState("");

  const searchTerms = useMemo(
    () =>
      search
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0),
    [search],
  );

  const filteredGroups = useMemo(() => {
    if (searchTerms.length === 0) return groupedCards;
    const result: Array<[string, Card[]]> = [];
    for (const [archetype, cards] of groupedCards) {
      const filtered = cards.filter((c) => matchesSearch(c, searchTerms));
      if (filtered.length > 0) result.push([archetype, filtered]);
    }
    return result;
  }, [groupedCards, searchTerms]);

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
      <input
        type="text"
        className={styles.librarySearch}
        placeholder="Search cards…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p className={styles.note}>
        Plays are free and don't enter the spent pile. Effects (statuses, added cards, summons)
        persist. Click to play, or drag onto the board.
      </p>
      <div className={styles.libraryListFull}>
        {filteredGroups.map(([archetype, cards]) => (
          <div key={archetype} className={styles.libraryGroup}>
            <div className={styles.libraryGroupHeading}>{archetype}</div>
            {cards.map((card) => (
              <div key={card.id} className={styles.libraryCardRow}>
                <button
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
                <button
                  type="button"
                  className={styles.libraryUpgradeBtn}
                  disabled={libraryDisabled}
                  onClick={() => {
                    const upgraded = getUpgradedCard(card);
                    if (upgraded) onPlayLibraryCard(upgraded);
                  }}
                  title="Play upgraded version"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
