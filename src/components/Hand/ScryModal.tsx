// Foresight scry modal. Shows the top N cards of the draw pile and lets the
// player reorder them. On confirm, calls `onConfirm(newOrder)` with the cards
// in the order they should be placed back on top of the deck (top-of-deck is
// index 0).

import { useState } from "react";

import type { Card } from "../../game/types";
import { CardListModal } from "./CardListModal";
import styles from "./CardListModal.module.css";

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
    <CardListModal
      title="Foresight"
      hint="Top of your deck. Reorder them; the first card here will be the next one drawn."
      cards={order}
      renderControls={(card, i) => (
        <>
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
        </>
      )}
      footer={
        <button type="button" className={styles.confirmButton} onClick={() => onConfirm(order)}>
          Confirm
        </button>
      }
    />
  );
}
