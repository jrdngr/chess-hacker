// End-of-run screen — shown for both wins and losses. The Run shell routes
// here on phase = "won" or "lost".

import type { RunState } from "../../game/types";
import styles from "./Run.module.css";

type Props = {
  run: RunState;
  onExit: () => void;
};

export function RunSummary({ run, onExit }: Props) {
  const won = run.phase === "won";
  return (
    <div className={styles.summary} role="status" aria-live="polite">
      <h2 className={styles.summaryTitle}>{won ? "Run complete!" : "Run over"}</h2>
      <p className={styles.summaryDetail}>
        {won
          ? `You finished all ${run.matchNumber} matches. Final gold: ${run.gold}.`
          : `Lost on match ${run.matchNumber}. Final gold: ${run.gold}.`}
      </p>
      <p className={styles.summaryDetail}>Deck size: {run.deck.length} cards.</p>
      <button type="button" className={styles.summaryButton} onClick={onExit}>
        Back to menu
      </button>
    </div>
  );
}
