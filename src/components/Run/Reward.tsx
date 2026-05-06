// Post-match reward step. Always offers a card draft (1-of-3 or skip-for-gold);
// after a boss win, also offers a Monster-Train-style 3-pick (energy / draw /
// delete-cards) followed by the existing 1-of-3 artifact pick from the rare-
// skewed boss pool. Resolution order: boss-pick → bossArtifact → cardDraft.

import { CardListModal } from "../Hand/CardListModal";
import type {
  Artifact,
  BossArtifactOffer,
  BossPickOffer,
  BossPickOption,
  Card,
  DraftOffer,
  RunState,
} from "../../game/types";
import styles from "./Reward.module.css";
import cardListStyles from "../Hand/CardListModal.module.css";

type Props = {
  run: RunState;
  offer: DraftOffer | null;
  bossArtifactOffer: BossArtifactOffer | null;
  bossPickOffer: BossPickOffer | null;
  onPick: (card: Card) => void;
  onSkip: () => void;
  onPickBossArtifact: (artifact: Artifact) => void;
  onSkipBossArtifact: () => void;
  onPickBossOption: (option: BossPickOption) => void;
  onDeleteDeckCard: (deckIndex: number) => void;
};

export function Reward({
  run,
  offer,
  bossArtifactOffer,
  bossPickOffer,
  onPick,
  onSkip,
  onPickBossArtifact,
  onSkipBossArtifact,
  onPickBossOption,
  onDeleteDeckCard,
}: Props) {
  // Boss-pick comes first — gates everything else. The 3 fixed options have
  // no skip; once picked, either the run advances (energy/draw → adds artifact)
  // or the deletion modal opens (delete-cards → bossDeleteCharges = 2).
  if (bossPickOffer) {
    return (
      <div className={styles.reward}>
        <header className={styles.header}>
          <h2 className={styles.title}>Boss defeated</h2>
          <p className={styles.subtitle}>Pick one boon — it lasts the rest of the run.</p>
        </header>
        <div className={styles.draftRow} role="list" aria-label="Boss reward options">
          {bossPickOffer.options.map((opt, i) => (
            <button
              key={`${opt.kind}-${i}`}
              type="button"
              role="listitem"
              className={`${styles.draftCard} ${styles.rare}`}
              onClick={() => onPickBossOption(opt)}
              aria-label={describeBossOption(opt)}
              data-boss-option={opt.kind}
            >
              <span className={styles.archetype}>boon</span>
              <span className={styles.name}>{bossOptionName(opt)}</span>
              <span className={styles.description}>{describeBossOption(opt)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Delete-cards mode: a boss-pick is mid-resolution and the player still has
  // delete charges to spend before the next reward step opens.
  if ((run.bossDeleteCharges ?? 0) > 0) {
    const remaining = run.bossDeleteCharges ?? 0;
    return (
      <div className={styles.reward}>
        <header className={styles.header}>
          <h2 className={styles.title}>Trim the deck</h2>
          <p className={styles.subtitle}>
            Pick {remaining} more {remaining === 1 ? "card" : "cards"} to delete.
          </p>
        </header>
        <CardListModal
          title="Delete a card from your deck"
          hint={`Boss boon — free deletion. ${remaining} ${remaining === 1 ? "deletion" : "deletions"} left.`}
          cards={run.deck}
          renderControls={(_card, idx) => (
            <button
              type="button"
              className={cardListStyles.confirmButton}
              onClick={() => onDeleteDeckCard(idx)}
            >
              Delete
            </button>
          )}
        />
      </div>
    );
  }

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

function bossOptionName(opt: BossPickOption): string {
  switch (opt.kind) {
    case "energy-per-turn-bonus":
      return `+${opt.amount} energy / turn`;
    case "draw-per-turn-bonus":
      return `+${opt.amount} draw / turn`;
    case "delete-cards":
      return `Delete ${opt.count} cards`;
  }
}

function describeBossOption(opt: BossPickOption): string {
  switch (opt.kind) {
    case "energy-per-turn-bonus":
      return `Gain +${opt.amount} energy at the start of each of your turns for the rest of the run.`;
    case "draw-per-turn-bonus":
      return `Draw ${opt.amount} additional card at the start of each of your turns for the rest of the run.`;
    case "delete-cards":
      return `Permanently remove ${opt.count} cards from your deck. Free.`;
  }
}
