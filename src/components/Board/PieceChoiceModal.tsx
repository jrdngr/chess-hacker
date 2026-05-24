import type { PieceType, Side } from "../../game/types";
import { PieceGlyph } from "./PieceGlyph";

import styles from "./PieceChoiceModal.module.css";

export type PromotionChoice = "q" | "r" | "b" | "n";

export type PieceOption = { type: PieceType; side: Side; label?: string };

type Props = {
  title: string;
  options: PieceOption[];
  onPick: (index: number) => void;
  onCancel?: () => void;
};

export function PieceChoiceModal({ title, options, onPick, onCancel }: Props) {
  return (
    <div className={styles.backdrop} role="dialog" aria-label={title}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.choices}>
          {options.map(({ type, side, label }, i) => (
            <button
              key={`${type}-${i}`}
              type="button"
              className={styles.choice}
              onClick={() => onPick(i)}
              aria-label={label ?? type}
              title={label ?? type}
            >
              <PieceGlyph piece={{ type, side }} />
            </button>
          ))}
        </div>
        {onCancel && (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
