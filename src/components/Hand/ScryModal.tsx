// Modal for Foresight (scry).
//
// Shows the top N cards of the draw pile and lets the player reorder them.
// On confirm, calls `onConfirm(newOrder)` with the cards in the order they
// should be placed back on top of the deck (top-of-deck is index 0).

import { useState } from "react";

import type { Card } from "../../game/types";
import styles from "./ScryModal.module.css";

type Props = {
  cards: Card[];
  onConfirm: (newOrder: Card[]) => void;
};

export function ScryModal({ cards, onConfirm }: Props) {
  const [order, setOrder] = useState<Card[]>(cards);

  const swap = (a: number, b: number) => {
    if (a < 0 || b < 0 || a >= order.length || b >= order.length) return;
    const next = order.slice();
    [next[a], next[b]] = [next[b], next[a]];
    setOrder(next);
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-label="Foresight scry">
      <div className={styles.dialog}>
        <h2 className={styles.title}>Foresight</h2>
        <p className={styles.hint}>
          Top of your deck. Reorder them; the first card here will be the next one drawn.
        </p>
        <ul className={styles.cardList}>
          {order.map((card, i) => (
            <li key={`${card.id}-${i}`} className={styles.cardRow}>
              <span className={styles.position}>{i + 1}.</span>
              <span className={styles.cardName}>
                <span className={styles.cost}>{card.cost}</span>
                <span>{card.name}</span>
              </span>
              <span className={styles.controls}>
                <button
                  type="button"
                  className={styles.moveButton}
                  onClick={() => swap(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move ${card.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.moveButton}
                  onClick={() => swap(i, i + 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${card.name} down`}
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.confirmButton} onClick={() => onConfirm(order)}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
