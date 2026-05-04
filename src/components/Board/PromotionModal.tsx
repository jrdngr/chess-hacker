import type { PieceType, Side } from "../../game/types";
import { PieceGlyph } from "./PieceGlyph";

import styles from "./PromotionModal.module.css";

export type PromotionChoice = "q" | "r" | "b" | "n";

const CHOICES: ReadonlyArray<{ code: PromotionChoice; type: PieceType; label: string }> = [
  { code: "q", type: "queen", label: "Queen" },
  { code: "r", type: "rook", label: "Rook" },
  { code: "b", type: "bishop", label: "Bishop" },
  { code: "n", type: "knight", label: "Knight" },
];

type Props = {
  side: Side;
  onPick: (choice: PromotionChoice) => void;
  onCancel: () => void;
};

export function PromotionModal({ side, onPick, onCancel }: Props) {
  return (
    <div className={styles.backdrop} role="dialog" aria-label="Promote pawn">
      <div className={styles.dialog}>
        <h2 className={styles.title}>Promote to…</h2>
        <div className={styles.choices}>
          {CHOICES.map(({ code, type, label }) => (
            <button
              key={code}
              type="button"
              className={styles.choice}
              onClick={() => onPick(code)}
              aria-label={`Promote to ${label}`}
              title={label}
            >
              <PieceGlyph piece={{ type, side }} />
            </button>
          ))}
        </div>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
