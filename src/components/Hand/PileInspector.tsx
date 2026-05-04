// Read-only inspector for the Draw and Spent piles.

import type { Card } from "../../game/types";
import { CardListModal } from "./CardListModal";
import styles from "./CardListModal.module.css";

type Props = {
  title: string;
  hint: string;
  cards: ReadonlyArray<Card>;
  onClose: () => void;
};

export function PileInspector({ title, hint, cards, onClose }: Props) {
  return (
    <CardListModal
      title={title}
      hint={hint}
      cards={cards}
      footer={
        <button type="button" className={styles.confirmButton} onClick={onClose}>
          Close
        </button>
      }
    />
  );
}
