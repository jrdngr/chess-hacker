// Restore from Backup modal — pick a card from the consumed pile to return to hand.

import type { Card } from "../../game/types";
import { CardListModal } from "./CardListModal";
import styles from "./CardListModal.module.css";

type Props = {
  cards: Card[];
  onPick: (index: number) => void;
  onCancel: () => void;
};

export function ReviveModal({ cards, onPick, onCancel }: Props) {
  return (
    <CardListModal
      title="Revive a card"
      hint="Pick a card from your consumed pile to return to your hand."
      cards={cards}
      renderControls={(card, i) => (
        <button
          type="button"
          className={styles.confirmButton}
          onClick={() => onPick(i)}
          aria-label={`Pick ${card.name}`}
        >
          Pick
        </button>
      )}
      footer={
        <button type="button" className={styles.confirmButton} onClick={onCancel}>
          Cancel
        </button>
      }
    />
  );
}
