// Post-match reward step. Always offers a card draft (1-of-3 or skip-for-gold);
// after a boss win, also offers a 1-of-3 artifact pick from the rare-skewed
// boss pool. The boss artifact pick resolves first; the card draft renders
// once it's resolved (picked or skipped).

import type { Artifact, BossArtifactOffer, Card, DraftOffer, RunState } from "../../game/types";
import styles from "./Reward.module.css";

type Props = {
  run: RunState;
  offer: DraftOffer | null;
  bossArtifactOffer: BossArtifactOffer | null;
  onPick: (card: Card) => void;
  onSkip: () => void;
  onPickBossArtifact: (artifact: Artifact) => void;
  onSkipBossArtifact: () => void;
};

export function Reward({
  run,
  offer,
  bossArtifactOffer,
  onPick,
  onSkip,
  onPickBossArtifact,
  onSkipBossArtifact,
}: Props) {
  // Boss artifact pick gates the rest of the reward step. Once it's resolved
  // (picked or skipped → null), we fall through to the card draft.
  if (bossArtifactOffer) {
    return (
      <div className={styles.reward}>
        <header className={styles.header}>
          <h2 className={styles.title}>Boss defeated</h2>
          <p className={styles.subtitle}>
            Pick an artifact from the boss-tier pool — or skip for gold.
          </p>
        </header>
        <div className={styles.draftRow} role="list" aria-label="Boss artifact offers">
          {bossArtifactOffer.artifacts.map((a, i) => (
            <button
              key={`${a.id}-${i}`}
              type="button"
              role="listitem"
              className={`${styles.draftCard} ${rarityClass(a.rarity)}`}
              onClick={() => onPickBossArtifact(a)}
              aria-label={`Pick ${a.name}, ${a.rarity}: ${a.description}`}
              data-artifact-id={a.id}
            >
              <span className={styles.archetype}>{a.rarity}</span>
              <span className={styles.name}>{a.name}</span>
              <span className={styles.description}>{a.description}</span>
            </button>
          ))}
          {bossArtifactOffer.artifacts.length === 0 && (
            <p className={styles.empty}>No artifacts available.</p>
          )}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onSkipBossArtifact}>
            Skip for {bossArtifactOffer.skipGold} gold
          </button>
        </div>
      </div>
    );
  }

  // Card draft hasn't been generated yet — render nothing for one tick.
  if (!offer) return null;

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

function rarityClass(rarity: Artifact["rarity"]): string {
  if (rarity === "rare") return styles.rare;
  if (rarity === "uncommon") return styles.uncommon;
  return styles.common;
}
