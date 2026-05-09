// Reusable card-list dialog primitive.
//
// All three of the existing modals (Stack Trace scry, Restore from Backup revive, draw /
// spent inspector) share the same shape: a backdrop, a titled card-list, and
// an action footer. M5 (reward + shop), M8 (boss preview), and any future
// pile-style picker can ride on this same primitive.
//
// Each row's controls vary — Scry has up/down arrows, Revive has a Pick
// button, Inspector has none. The `renderControls` prop lets callers slot in
// row-level affordances without re-implementing the surrounding chrome.
//
// Hover / keyboard-focus on a row reveals a portal-based tooltip with the
// card's archetype + description. The tooltip portals to document.body so it
// escapes `.cardList`'s `overflow-y: auto` (which would otherwise clip an
// in-flow tooltip).

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { Card } from "../../game/types";
import { CardKeywords } from "./CardKeywords";
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

type TooltipState = {
  card: Card;
  // Viewport-relative anchor rect of the hovered row. The portal renders
  // `position: fixed`, so these coordinates are direct.
  anchorTop: number;
  anchorLeft: number;
  anchorRight: number;
  anchorHeight: number;
};

export function CardListModal({
  title,
  hint,
  cards,
  renderControls,
  emptyMessage = "(empty)",
  footer,
}: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltipFor = (card: Card, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setTooltip({
      card,
      anchorTop: rect.top,
      anchorLeft: rect.left,
      anchorRight: rect.right,
      anchorHeight: rect.height,
    });
  };

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
              <li
                key={`${card.id}-${i}`}
                className={styles.cardRow}
                tabIndex={0}
                onMouseEnter={(e) => showTooltipFor(card, e.currentTarget)}
                onMouseLeave={() => setTooltip(null)}
                onFocus={(e) => showTooltipFor(card, e.currentTarget)}
                onBlur={() => setTooltip(null)}
              >
                <span className={styles.position}>{i + 1}.</span>
                <span className={styles.cardName}>
                  <span className={styles.cost}>{card.cost}</span>
                  <span>{card.name}</span>
                  <CardKeywords card={card} />
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
      {tooltip && <CardTooltip {...tooltip} />}
    </div>
  );
}

function CardTooltip({ card, anchorTop, anchorLeft, anchorRight, anchorHeight }: TooltipState) {
  // Portal target — falls back to a no-op render if document is not
  // available (e.g. SSR / test environments without jsdom body).
  if (typeof document === "undefined") return null;

  // Default to the right of the row, vertically centred. If that would
  // overflow the viewport's right edge, swing to the left of the row.
  const TOOLTIP_WIDTH = 260;
  const VIEWPORT_PAD = 12;
  const GAP = 8;
  const wouldOverflowRight = anchorRight + GAP + TOOLTIP_WIDTH > window.innerWidth - VIEWPORT_PAD;
  const style: React.CSSProperties = wouldOverflowRight
    ? {
        position: "fixed",
        top: anchorTop + anchorHeight / 2,
        left: anchorLeft - GAP - TOOLTIP_WIDTH,
        width: TOOLTIP_WIDTH,
        transform: "translateY(-50%)",
      }
    : {
        position: "fixed",
        top: anchorTop + anchorHeight / 2,
        left: anchorRight + GAP,
        width: TOOLTIP_WIDTH,
        transform: "translateY(-50%)",
      };

  return createPortal(
    <div className={styles.tooltip} style={style} role="tooltip">
      <div className={styles.tooltipName}>{card.name}</div>
      <div className={styles.tooltipMeta}>
        Cost {card.cost} · {card.archetype} · {card.rarity}
      </div>
      <div className={styles.tooltipDescription}>{card.description}</div>
    </div>,
    document.body,
  );
}
