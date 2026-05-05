// Per-match victory panel — shown in the Match side panel after a win,
// before advancing to the reward step. Lets the player look at the final
// position and confirm they're ready to move on.

import type { RunMatchOutcome, RunState } from "../../game/types";
import {
  isBossMatch,
  totalMatches,
  WIN_BONUS_BOSS,
  WIN_BONUS_NORMAL,
} from "../../game/progression/run";
import styles from "./Run.module.css";

type Props = {
  run: RunState;
  outcome: RunMatchOutcome;
  onContinue: () => void;
};

export function MatchWonPanel({ run, outcome, onContinue }: Props) {
  const boss = isBossMatch(run);
  const goldAward = boss ? WIN_BONUS_BOSS : WIN_BONUS_NORMAL;
  const isFinal = run.matchNumber >= totalMatches(run);
  return (
    <div className={styles.summary} role="status" aria-live="polite">
      <h2 className={styles.summaryTitle}>
        {isFinal ? "Run complete!" : boss ? "Boss defeated!" : "Match won!"}
      </h2>
      <p className={styles.summaryDetail}>+{goldAward} gold</p>
      <p className={styles.summaryDetail}>Turns played: {outcome.turnsPlayed}</p>
      <button type="button" className={styles.summaryButton} onClick={onContinue}>
        {isFinal ? "View run summary" : "Continue to rewards"}
      </button>
    </div>
  );
}
