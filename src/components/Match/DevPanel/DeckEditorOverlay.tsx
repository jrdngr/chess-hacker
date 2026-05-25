import { useMemo, useRef, useState } from "react";

import { groupCardsByArchetype } from "../../../game/cards/library";
import type { Card } from "../../../game/types";
import { FormattedText } from "../../FormattedText";

import styles from "./DevPanel.module.css";

/**
 * Deck-editor entry: a single row in the editor, tagged with where it came
 * from so saving can rebuild the draw / discard / consumed piles correctly.
 * `kind: "new"` rows came from the library and append to the draw pile on
 * save; existing rows preserve their position in their original pile if
 * not removed.
 */
type DeckEntry =
  | { kind: "draw"; card: Card; key: string; removed: boolean }
  | { kind: "discard"; card: Card; key: string; removed: boolean }
  | { kind: "consumed"; card: Card; key: string; removed: boolean }
  | { kind: "new"; card: Card; key: string };

type Props = {
  drawPile: ReadonlyArray<Card>;
  discardPile: ReadonlyArray<Card>;
  consumedPile: ReadonlyArray<Card>;
  namedDecks: ReadonlyArray<{ name: string; cards: Card[] }>;
  onLoadDeck: (cards: Card[]) => void;
  onSave: (next: {
    drawPile: Card[];
    discardPile: Card[];
    consumedPile: Card[];
    addedCards: Card[];
  }) => void;
  onClose: () => void;
};

export function DeckEditorOverlay({
  drawPile,
  discardPile,
  consumedPile,
  namedDecks,
  onLoadDeck,
  onSave,
  onClose,
}: Props) {
  const [entries, setEntries] = useState<DeckEntry[]>(() => {
    const out: DeckEntry[] = [];
    drawPile.forEach((card, i) => {
      out.push({ kind: "draw", card, key: `draw-${i}`, removed: false });
    });
    discardPile.forEach((card, i) => {
      out.push({ kind: "discard", card, key: `discard-${i}`, removed: false });
    });
    consumedPile.forEach((card, i) => {
      out.push({ kind: "consumed", card, key: `consumed-${i}`, removed: false });
    });
    return out;
  });
  const [exportText, setExportText] = useState<string | null>(null);
  const newKeyRef = useRef(0);

  const libraryCards = useMemo(() => groupCardsByArchetype(), []);

  const liveCards = entries.filter((e) => e.kind === "new" || !e.removed);
  const liveCount = liveCards.length;
  const removedCount = entries.filter((e) => e.kind !== "new" && e.removed).length;
  const addedCount = entries.filter((e) => e.kind === "new").length;

  const toggleRemove = (key: string) => {
    setEntries((prev) =>
      prev.flatMap((e) => {
        if (e.key !== key) return [e];
        if (e.kind === "new") return [];
        return [{ ...e, removed: !e.removed }];
      }),
    );
  };

  const addCard = (card: Card) => {
    setEntries((prev) => [...prev, { kind: "new", card, key: `new-${newKeyRef.current++}` }]);
  };

  const handleSave = () => {
    const newDraw: Card[] = [];
    const newDiscard: Card[] = [];
    const newConsumed: Card[] = [];
    const added: Card[] = [];
    for (const entry of entries) {
      if (entry.kind === "draw" && !entry.removed) newDraw.push(entry.card);
      else if (entry.kind === "discard" && !entry.removed) newDiscard.push(entry.card);
      else if (entry.kind === "consumed" && !entry.removed) newConsumed.push(entry.card);
      else if (entry.kind === "new") {
        newDraw.push(entry.card);
        added.push(entry.card);
      }
    }
    onSave({
      drawPile: newDraw,
      discardPile: newDiscard,
      consumedPile: newConsumed,
      addedCards: added,
    });
  };

  const handleExport = () => {
    setExportText(liveCards.map((e) => e.card.id).join(","));
  };

  return (
    <aside className={`${styles.devPanel} ${styles.libraryPanel}`}>
      <div className={styles.libraryHeader}>
        <h3 className={styles.heading}>Deck editor</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close deck editor"
        >
          ×
        </button>
      </div>
      <p className={styles.note}>
        Edit your draw + spent piles. Removed cards leave both piles; added cards drop into the draw
        pile. Hand cards are unaffected. Changes apply on Save.
      </p>

      <div className={styles.deckSummaryRow}>
        <span>{liveCount} cards</span>
        {addedCount > 0 && <span className={styles.deckSummaryAdded}>+{addedCount}</span>}
        {removedCount > 0 && <span className={styles.deckSummaryRemoved}>−{removedCount}</span>}
      </div>

      <div className={styles.deckActions}>
        <button type="button" className={styles.smallButton} onClick={handleSave}>
          Save deck
        </button>
        <button type="button" className={styles.smallButton} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.smallButton} onClick={handleExport}>
          Export deck
        </button>
      </div>

      {exportText !== null && (
        <div className={styles.exportBlock}>
          <textarea
            className={styles.exportTextarea}
            readOnly
            value={exportText}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      {namedDecks.length > 0 && (
        <div className={styles.namedDecks}>
          <div className={styles.libraryGroupHeading}>Named decks (Content Designer)</div>
          {namedDecks.map((deck) => (
            <div key={deck.name} className={styles.namedDeckRow}>
              <span className={styles.namedDeckName}>{deck.name}</span>
              <span className={styles.namedDeckCount}>{deck.cards.length} cards</span>
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => {
                  if (
                    confirm(
                      `Replace the current run deck and the match's draw / discard / consumed piles with '${deck.name}' (${deck.cards.length} cards)?`,
                    )
                  ) {
                    onLoadDeck(deck.cards.slice());
                  }
                }}
              >
                Load
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.libraryListFull}>
        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Current deck</div>
          {entries.length === 0 && <div className={styles.note}>Deck is empty.</div>}
          {entries.map((entry) => {
            const removed = entry.kind !== "new" && entry.removed;
            const tag = entry.kind;
            return (
              <div
                key={entry.key}
                className={`${styles.deckEntry} ${removed ? styles.deckEntryRemoved : ""}`}
              >
                <span className={styles.libraryCardCost}>{entry.card.cost}</span>
                <span className={styles.deckEntryBody}>
                  <span className={styles.libraryCardName}>{entry.card.name}</span>
                  <span className={styles.libraryCardDesc}>
                    <FormattedText text={entry.card.description} />
                  </span>
                </span>
                <span className={`${styles.deckEntryTag} ${styles[`deckEntryTag_${tag}`] ?? ""}`}>
                  {tag}
                </span>
                <button
                  type="button"
                  className={styles.deckEntryRemoveButton}
                  onClick={() => toggleRemove(entry.key)}
                  aria-label={removed ? "Restore card" : "Remove card"}
                >
                  {entry.kind === "new" ? "×" : removed ? "↺" : "×"}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Add from library</div>
          {libraryCards.map(([archetype, cards]) => (
            <div key={archetype} className={styles.libraryGroup}>
              <div className={styles.libraryGroupHeading}>{archetype}</div>
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={styles.libraryCard}
                  onClick={() => addCard(card)}
                  data-card-id={card.id}
                >
                  <span className={styles.libraryCardCost}>{card.cost}</span>
                  <span className={styles.libraryCardName}>{card.name}</span>
                  <span className={styles.libraryCardDesc}>
                    <FormattedText text={card.description} />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
