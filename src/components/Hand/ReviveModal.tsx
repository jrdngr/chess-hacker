// Modal for Recover (choose revive).
//
// Shows the consumed pile and lets the player pick one card to return to
// hand. On pick, calls `onPick(index)` with the chosen card's index in the
// consumed pile.

import type { Card } from "../../game/types";
import styles from "./ScryModal.module.css";

type Props = {
  cards: Card[];
  onPick: (index: number) => void;
  onCancel: () => void;
};

export function ReviveModal({ cards, onPick, onCancel }: Props) {
  return (
    <div className={styles.backdrop} role="dialog" aria-label="Revive a consumed card">
      <div className={styles.dialog}>
        <h2 className={styles.title}>Revive a card</h2>
        <p className={styles.hint}>
          Pick a card from your consumed pile to return to your hand.
        </p>
        <ul className={styles.cardList}>
          {cards.map((card, i) => (
            <li key={`${card.id}-${i}`} className={styles.cardRow}>
              <span className={styles.position}>{i + 1}.</span>
              <span className={styles.cardName}>
                <span className={styles.cost}>{card.cost}</span>
                <span>{card.name}</span>
              </span>
              <span className={styles.controls}>
                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={() => onPick(i)}
                  aria-label={`Pick ${card.name}`}
                >
                  Pick
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.confirmButton} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
