// The player's hand of cards. Click a card to play it; cards that need a
// target enter "targeting" mode and the next eligible board click resolves
// the play.
//
// The hand is dumb: it renders the cards passed in and reports clicks back.
// All state (energy gating, targeting, draw pile) lives in the Match.

import type { Card } from "../../game/types";

import styles from "./Hand.module.css";

type Props = {
  hand: ReadonlyArray<Card>;
  energy: number;
  /** Hand index that is currently "in flight" waiting for a target, if any. */
  targetingIndex: number | null;
  /** Whether the player is allowed to interact with their hand right now. */
  enabled: boolean;
  drawPileCount: number;
  discardPileCount: number;
  onCardClick: (index: number) => void;
};

export function Hand({
  hand,
  energy,
  targetingIndex,
  enabled,
  drawPileCount,
  discardPileCount,
  onCardClick,
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

      <div className={styles.pile} aria-label="Discard pile">
        <span className={styles.pileLabel}>Discard</span>
        <span className={styles.pileCount}>{discardPileCount}</span>
      </div>
    </div>
  );
}
