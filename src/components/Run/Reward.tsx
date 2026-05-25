// Post-match reward step. In Standard mode this is boss-only (non-boss wins
// skip directly to shop). In Skirmish mode every win comes here for the piece
// draft before optionally continuing to boss rewards.
//
// Resolution order (Skirmish): pieceDraft → (bossPick → bossArtifact if boss) → shop.
// Resolution order (Standard): bossPick → bossArtifact → shop.

import { CardListModal } from "../Hand/CardListModal";
import { FormattedText } from "../FormattedText";
import { PieceDraft } from "./PieceDraft";
import type {
  Artifact,
  BossArtifactOffer,
  BossPickOffer,
  BossPickOption,
  PieceDraftOffer,
  PieceType,
  RunState,
} from "../../game/types";
import styles from "./Reward.module.css";
import cardListStyles from "../Hand/CardListModal.module.css";

type Props = {
  run: RunState;
  bossArtifactOffer: BossArtifactOffer | null;
  bossPickOffer: BossPickOffer | null;
  pieceDraftOffer: PieceDraftOffer | null;
  onPickBossArtifact: (artifact: Artifact) => void;
  onSkipBossArtifact: () => void;
  onPickBossOption: (option: BossPickOption) => void;
  onDeleteDeckCard: (deckIndex: number) => void;
  onPickPiece: (pieceType: PieceType) => void;
  onSkipPieceDraft: () => void;
};

export function Reward({
  run,
  bossArtifactOffer,
  bossPickOffer,
  pieceDraftOffer,
  onPickBossArtifact,
  onSkipBossArtifact,
  onPickBossOption,
  onDeleteDeckCard,
  onPickPiece,
  onSkipPieceDraft,
}: Props) {
  // Piece draft comes first in Skirmish — gates boss rewards.
  if (pieceDraftOffer) {
    return (
      <PieceDraft
        offer={pieceDraftOffer}
        roster={run.roster ?? []}
        onPick={onPickPiece}
        onSkip={onSkipPieceDraft}
      />
    );
  }

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
              <span className={styles.description}>
                <FormattedText text={describeBossOption(opt)} />
              </span>
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

  // Boss artifact pick is the final reward step. Once it's resolved (picked
  // or skipped → null), the parent transitions the run to the shop phase.
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
              <span className={styles.description}>
                <FormattedText text={a.description} />
              </span>
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

  // All boss-reward steps resolved — parent will advance to shop on the next
  // tick. Render nothing in the meantime.
  return null;
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
