// Reusable card-list dialog primitive.
//
// All three of the existing modals (Foresight scry, Recover revive, draw /
// spent inspector) share the same shape: a backdrop, a titled card-list, and
// an action footer. M5 (reward + shop), M8 (boss preview), and any future
// pile-style picker can ride on this same primitive.
//
// Each row's controls vary — Scry has up/down arrows, Revive has a Pick
// button, Inspector has none. The `renderControls` prop lets callers slot in
// row-level affordances without re-implementing the surrounding chrome.

import type { ReactNode } from "react";

import type { Card } from "../../game/types";
import styles from "./CardListModal.module.css";

type Props = {
  /** Dialog title (also used as `aria-label`). */
  title: string;
  /** Optional helper text under the title. */
  hint?: string;
  /** The cards to display, in render order. */
  cards: ReadonlyArray<Card>;
  /**
   * Optional per-row controls (buttons, arrows, etc.). Receives the card
   * and its index. Returns null / undefined to skip controls for that row.
   */
  renderControls?: (card: Card, index: number) => ReactNode;
  /**
   * Optional message shown in place of the card list when `cards.length === 0`.
   * Defaults to "(empty)" — pass null to render nothing.
   */
  emptyMessage?: ReactNode;
  /** Footer slot — typically Confirm / Cancel buttons. */
  footer?: ReactNode;
};

export function CardListModal({
  title,
  hint,
  cards,
  renderControls,
  emptyMessage = "(empty)",
  footer,
}: Props) {
  return (
    <div className={styles.backdrop} role="dialog" aria-label={title}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>{title}</h2>
        {hint && <p className={styles.hint}>{hint}</p>}
        {cards.length === 0 ? (
          emptyMessage !== null && <p className={styles.hint}>{emptyMessage}</p>
        ) : (
          <ul className={styles.cardList}>
            {cards.map((card, i) => (
              <li key={`${card.id}-${i}`} className={styles.cardRow}>
                <span className={styles.position}>{i + 1}.</span>
                <span className={styles.cardName}>
                  <span className={styles.cost}>{card.cost}</span>
                  <span>{card.name}</span>
                </span>
                {renderControls && (
                  <span className={styles.controls}>{renderControls(card, i)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {footer && <div className={styles.actions}>{footer}</div>}
      </div>
    </div>
  );
}

