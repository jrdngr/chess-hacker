// Per-match victory panel — shown in the Match side panel after a win,
// before advancing to the reward step. Lets the player look at the final
// position and confirm they're ready to move on.

import type { MatchOutcome, RunMatchOutcome, RunState } from "../../game/types";
import {
  isBossMatch,
  totalMatches,
  WIN_BONUS_BOSS,
  WIN_BONUS_NORMAL,
} from "../../game/progression/run";
import { FEAT_GOLD_CAP, totalFeatGold } from "../../game/progression/feats";
import styles from "./Run.module.css";

type Props = {
  run: RunState;
  outcome: RunMatchOutcome;
  onContinue: () => void;
};

export function MatchWonPanel({ run, outcome, onContinue }: Props) {
  const boss = isBossMatch(run);
  const winBonus = boss ? WIN_BONUS_BOSS : WIN_BONUS_NORMAL;
  const featGold = totalFeatGold(outcome.feats);
  const rawFeatGold = outcome.feats.reduce((sum, f) => sum + f.gold, 0);
  const featGoldCapped = rawFeatGold > featGold;
  const isFinal = run.matchNumber >= totalMatches(run);
  const reason = winReason(outcome.outcome);
  return (
    <div className={styles.summary} role="status" aria-live="polite">
      <h2 className={styles.summaryTitle}>
        {isFinal ? "Run complete!" : boss ? "Boss defeated!" : "Match won!"}
      </h2>
      {reason && <p className={styles.summaryReason}>{reason}</p>}
      <p className={styles.summaryDetail}>+{winBonus + featGold} gold</p>
      {outcome.feats.length > 0 && (
        <ul className={styles.summaryFeats}>
          {outcome.feats.map((feat) => (
            <li key={feat.id} className={styles.summaryFeat}>
              <span>{feat.label}</span>
              <span className={styles.summaryFeatGold}>+{feat.gold}</span>
            </li>
          ))}
        </ul>
      )}
      {featGoldCapped && (
        <p className={styles.summaryDetail}>Feat gold capped at {FEAT_GOLD_CAP}</p>
      )}
      <p className={styles.summaryDetail}>Turns played: {outcome.turnsPlayed}</p>
      <button type="button" className={styles.summaryButton} onClick={onContinue}>
        {isFinal ? "View run summary" : "Continue to rewards"}
      </button>
    </div>
  );
}

function winReason(outcome: MatchOutcome): string | null {
  switch (outcome.kind) {
    case "checkmate":
      return "Checkmate";
    case "king-captured":
      return "King Capture";
    default:
      return null;
  }
}
