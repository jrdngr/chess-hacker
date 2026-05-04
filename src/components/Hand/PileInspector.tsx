// Inspector modal for the Draw and Spent piles. Read-only — shows the
// cards in the requested order and lets the user dismiss the dialog.

import type { Card } from "../../game/types";
import styles from "./ScryModal.module.css";

type Props = {
  title: string;
  hint: string;
  cards: ReadonlyArray<Card>;
  onClose: () => void;
};

export function PileInspector({ title, hint, cards, onClose }: Props) {
  return (
    <div className={styles.backdrop} role="dialog" aria-label={title}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.hint}>{hint}</p>
        {cards.length === 0 ? (
          <p className={styles.hint}>(empty)</p>
        ) : (
          <ul className={styles.cardList}>
            {cards.map((card, i) => (
              <li key={`${card.id}-${i}`} className={styles.cardRow}>
                <span className={styles.position}>{i + 1}.</span>
                <span className={styles.cardName}>
                  <span className={styles.cost}>{card.cost}</span>
                  <span>{card.name}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.confirmButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
