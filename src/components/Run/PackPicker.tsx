// Booster-pack pick UI — shows the pack's cards side-by-side as full card
// tiles. The player clicks a card to highlight it, then commits the pick by
// pressing Confirm. Cancelling is intentionally absent: opening a pack has
// already deducted the gold, so the pick must be made.

import { useState } from "react";

import { CardKeywords } from "../Hand/CardKeywords";
import { FormattedText } from "../FormattedText";
import type { BoosterPack, Card } from "../../game/types";

import styles from "./PackPicker.module.css";

type Props = {
  pack: BoosterPack;
  onConfirm: (card: Card) => void;
};

export function PackPicker({ pack, onConfirm }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const onConfirmClick = () => {
    if (selected === null) return;
    onConfirm(pack.contents[selected]);
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-label={pack.name}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>{pack.name}</h2>
        <p className={styles.hint}>Pick 1 card to add to your deck.</p>
        <ul className={styles.cards} aria-label="Pack contents">
          {pack.contents.map((card, i) => {
            const isSelected = selected === i;
            const cls = [styles.card, isSelected && styles.selected].filter(Boolean).join(" ");
            return (
              <li key={i} className={styles.cardSlot}>
                <button
                  type="button"
                  className={cls}
                  aria-pressed={isSelected}
                  aria-label={`${card.name}, cost ${card.cost}. ${card.description}`}
                  data-card-id={card.id}
                  onClick={() => setSelected(i)}
                >
                  <span className={styles.cost}>{card.cost}</span>
                  <span className={styles.name}>{card.name}</span>
                  <span className={styles.archetype}>
                    {card.archetype} · {card.rarity}
                  </span>
                  <CardKeywords card={card} />
                  <span className={styles.description}>
                    <FormattedText text={card.description} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.confirm}
            onClick={onConfirmClick}
            disabled={selected === null}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
