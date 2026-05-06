// The player's hand of cards. Click a card to play it; cards that need a
// target enter "targeting" mode and the next eligible board click resolves
// the play.
//
// The hand is dumb: it renders the cards passed in and reports clicks back.
// All state (energy gating, targeting, draw pile) lives in the Match.

import type { CardTarget, HandCard } from "../../game/types";

import { CardKeywords } from "./CardKeywords";
import styles from "./Hand.module.css";

// Two-step targeting cards (pick A, then pick B) don't fit a single drag-and-
// drop gesture; they must be played via click. Hand-card targets (Bookmark) also
// click-only — the second click lands on another card in the hand. Everything
// else — single-square targets and no-target cards — is draggable from the
// hand.
const NON_DRAGGABLE_TARGETS: ReadonlySet<CardTarget["kind"]> = new Set([
  "two-own-pieces",
  "marionette",
  "hand-card",
]);

type Props = {
  hand: ReadonlyArray<HandCard>;
  energy: number;
  /** Hand index that is currently "in flight" waiting for a target, if any. */
  targetingIndex: number | null;
  /** Whether the player is allowed to interact with their hand right now. */
  enabled: boolean;
  drawPileCount: number;
  discardPileCount: number;
  consumedPileCount: number;
  /**
   * Hand indexes the active boss modifier forbids playing (e.g. Boss A's
   * "no walls" rule disables every place-wall card). Greys out the card and
   * blocks click + drag.
   */
  forbiddenIndexes?: ReadonlySet<number>;
  onCardClick: (index: number) => void;
  /** Drag a targeted card from the hand onto a board square to play it. */
  onCardDragStart?: (index: number) => void;
  onCardDragEnd?: () => void;
  /** Open the draw-pile inspector modal. */
  onDrawPileClick?: () => void;
  /** Open the discard-pile inspector modal. */
  onDiscardPileClick?: () => void;
  /** Open the consumed-pile inspector modal. */
  onConsumedPileClick?: () => void;
};

export function Hand({
  hand,
  energy,
  targetingIndex,
  enabled,
  drawPileCount,
  discardPileCount,
  consumedPileCount,
  forbiddenIndexes,
  onCardClick,
  onCardDragStart,
  onCardDragEnd,
  onDrawPileClick,
  onDiscardPileClick,
  onConsumedPileClick,
}: Props) {
  // When the active targeting card asks for a hand-card target (Bookmark),
  // every hand slot except the playing one and curses becomes a click
  // target. We surface that mode so the slots can be highlighted.
  const targetingHandCard =
    targetingIndex !== null && hand[targetingIndex]?.card.target.kind === "hand-card";
  return (
    <div className={styles.handArea}>
      <button
        type="button"
        className={styles.pile}
        aria-label="Draw pile"
        onClick={onDrawPileClick}
        disabled={!onDrawPileClick}
      >
        <span className={styles.pileLabel}>Draw</span>
        <span className={styles.pileCount}>{drawPileCount}</span>
      </button>

      <div className={styles.hand} role="list" aria-label="Hand">
        {hand.length === 0 ? (
          <div className={styles.emptyHand}>Hand is empty</div>
        ) : (
          hand.map((slot, i) => {
            const card = slot.card;
            const affordable = energy >= card.cost;
            const isTargeting = targetingIndex === i;
            const forbidden = forbiddenIndexes?.has(i) ?? false;
            const playable = enabled && affordable && !forbidden;
            // When Bookmark is asking for a hand-card target, the slot is
            // clickable as a target if it isn't the playing slot, isn't a
            // curse, and isn't already retained.
            const isBookmarkTarget =
              targetingHandCard && !isTargeting && !card.curse && !slot.retained;
            const clickable = playable || isBookmarkTarget;
            // Two-step cards (Switch Files, Remote Access) and hand-card targets
            // (Bookmark) still resolve via click; everything else can be dragged
            // onto the board.
            const draggable = playable && !NON_DRAGGABLE_TARGETS.has(card.target.kind);
            const retained = slot.retained || card.retain === true;
            const cls = [
              styles.card,
              !clickable && styles.disabled,
              isTargeting && styles.targeting,
              isBookmarkTarget && styles.stashTarget,
              card.curse && styles.curse,
              retained && styles.retained,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={`${card.id}-${i}`}
                type="button"
                role="listitem"
                className={cls}
                onClick={() => clickable && onCardClick(i)}
                disabled={!clickable}
                draggable={draggable}
                onDragStart={(e) => {
                  if (!draggable || !onCardDragStart) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                  // Anchor the drag preview at its top-left so the card
                  // hangs down-right from the cursor instead of trailing
                  // wherever the user grabbed it. (setDragImage is missing
                  // under jsdom — guard for tests.)
                  if (typeof e.dataTransfer.setDragImage === "function") {
                    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                  }
                  onCardDragStart(i);
                }}
                onDragEnd={() => onCardDragEnd?.()}
                aria-label={`${card.name}, cost ${card.cost}. ${card.description}${forbidden ? " — forbidden by boss modifier." : ""}${retained ? " — retained." : ""}`}
                data-card-id={card.id}
                title={forbidden ? "Forbidden by the active boss modifier" : undefined}
              >
                <span className={styles.cost}>{card.cost}</span>
                <span className={styles.name}>{card.name}</span>
                <span className={styles.archetype}>{card.archetype}</span>
                <CardKeywords card={card} retained={retained} />
                <span className={styles.description}>{card.description}</span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.pileGroup}>
        <button
          type="button"
          className={styles.pile}
          aria-label="Discard pile"
          onClick={onDiscardPileClick}
          disabled={!onDiscardPileClick}
        >
          <span className={styles.pileLabel}>Discard</span>
          <span className={styles.pileCount}>{discardPileCount}</span>
        </button>
        <button
          type="button"
          className={styles.pile}
          aria-label="Consumed pile"
          onClick={onConsumedPileClick}
          disabled={!onConsumedPileClick}
        >
          <span className={styles.pileLabel}>Consumed</span>
          <span className={styles.pileCount}>{consumedPileCount}</span>
        </button>
      </div>
    </div>
  );
}
