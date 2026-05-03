// The player's hand of cards. Click a card to play it; cards that need a
// target enter "targeting" mode and the next eligible board click resolves
// the play.
//
// The hand is dumb: it renders the cards passed in and reports clicks back.
// All state (energy gating, targeting, draw pile) lives in the Match.

import type { Card, CardTarget } from "../../game/types";

import styles from "./Hand.module.css";

// Two-step targeting cards (pick A, then pick B) don't fit a single drag-and-
// drop gesture; they must be played via click. Everything else — single-square
// targets and no-target cards — is draggable from the hand.
const NON_DRAGGABLE_TARGETS: ReadonlySet<CardTarget["kind"]> = new Set([
  "two-own-pieces",
  "marionette",
]);

type Props = {
  hand: ReadonlyArray<Card>;
  energy: number;
  /** Hand index that is currently "in flight" waiting for a target, if any. */
  targetingIndex: number | null;
  /** Whether the player is allowed to interact with their hand right now. */
  enabled: boolean;
  drawPileCount: number;
  consumedPileCount: number;
  onCardClick: (index: number) => void;
  /** Drag a targeted card from the hand onto a board square to play it. */
  onCardDragStart?: (index: number) => void;
  onCardDragEnd?: () => void;
};

export function Hand({
  hand,
  energy,
  targetingIndex,
  enabled,
  drawPileCount,
  consumedPileCount,
  onCardClick,
  onCardDragStart,
  onCardDragEnd,
}: Props) {
  return (
    <div className={styles.handArea}>
      <div className={styles.pile} aria-label="Draw pile">
        <span className={styles.pileLabel}>Draw</span>
        <span className={styles.pileCount}>{drawPileCount}</span>
      </div>

      <div className={styles.hand} role="list" aria-label="Hand">
        {hand.length === 0 ? (
          <div className={styles.emptyHand}>Hand is empty</div>
        ) : (
          hand.map((card, i) => {
            const affordable = energy >= card.cost;
            const isTargeting = targetingIndex === i;
            const playable = enabled && affordable;
            // Two-step cards (Switch Files, Marionette) still resolve via
            // click; everything else can be dragged onto the board. No-target
            // cards drop "anywhere on the board" (the whole board lights up).
            const draggable = playable && !NON_DRAGGABLE_TARGETS.has(card.target.kind);
            const cls = [styles.card, !playable && styles.disabled, isTargeting && styles.targeting]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={`${card.id}-${i}`}
                type="button"
                role="listitem"
                className={cls}
                onClick={() => playable && onCardClick(i)}
                disabled={!playable}
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
                aria-label={`${card.name}, cost ${card.cost}. ${card.description}`}
                data-card-id={card.id}
              >
                <span className={styles.cost}>{card.cost}</span>
                <span className={styles.name}>{card.name}</span>
                <span className={styles.archetype}>{card.archetype}</span>
                <span className={styles.description}>{card.description}</span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.pile} aria-label="Spent pile">
        <span className={styles.pileLabel}>Spent</span>
        <span className={styles.pileCount}>{consumedPileCount}</span>
      </div>
    </div>
  );
}
