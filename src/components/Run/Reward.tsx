// Post-match reward step: card draft (1 of 3) or skip-for-gold.
//
// In M5 the reward is just gold + a card draft. M6 will plug the artifact
// pick into the same step (only after boss matches); M10 adds the piece
// draft for Skirmish.

import type { Card, DraftOffer, RunState } from "../../game/types";
import styles from "./Reward.module.css";

type Props = {
  run: RunState;
  offer: DraftOffer;
  onPick: (card: Card) => void;
  onSkip: () => void;
};

export function Reward({ run, offer, onPick, onSkip }: Props) {
  return (
    <div className={styles.reward}>
      <header className={styles.header}>
        <h2 className={styles.title}>Match {run.matchNumber} won</h2>
        <p className={styles.subtitle}>Pick a card to add to your deck — or skip for gold.</p>
      </header>
      <div className={styles.draftRow} role="list" aria-label="Card draft offers">
        {offer.cards.map((card, i) => (
          <button
            key={`${card.id}-${i}`}
            type="button"
            role="listitem"
            className={styles.draftCard}
            onClick={() => onPick(card)}
            aria-label={`Pick ${card.name}, cost ${card.cost}: ${card.description}`}
            data-card-id={card.id}
          >
            <span className={styles.cost}>{card.cost}</span>
            <span className={styles.name}>{card.name}</span>
            <span className={styles.archetype}>
              {card.archetype} · {card.rarity}
            </span>
            <span className={styles.description}>{card.description}</span>
          </button>
        ))}
        {offer.cards.length === 0 && (
          <p className={styles.empty}>No cards available — proceeding to shop.</p>
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.skip} onClick={onSkip}>
          Skip for {offer.skipGold} gold
        </button>
      </div>
    </div>
  );
}
