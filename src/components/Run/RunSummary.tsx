// End-of-run screen — shown for both wins and losses. The Run shell routes
// here on phase = "won" or "lost". Artifacts are visible in the run banner
// above; no need to repeat them here.

import type { MatchOutcome, RunState } from "../../game/types";
import styles from "./Run.module.css";

type Props = {
  run: RunState;
  /** Outcome of the final match — used to show why the run ended (checkmate / stalemate / draw). */
  outcome?: MatchOutcome;
  onExit: () => void;
};

export function RunSummary({ run, outcome, onExit }: Props) {
  const won = run.phase === "won";
  const reason = outcome ? describeOutcome(outcome, won) : null;
  return (
    <div className={styles.summary} role="status" aria-live="polite">
      <h2 className={styles.summaryTitle}>{won ? "Run complete!" : "Run over"}</h2>
      {reason && <p className={styles.summaryReason}>{reason}</p>}
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

function describeOutcome(outcome: MatchOutcome, _won: boolean): string | null {
  switch (outcome.kind) {
    case "checkmate":
      return "Checkmate";
    case "king-captured":
      return "King Capture";
    case "stalemate":
      return "Stalemate";
    case "draw":
      return `Draw — ${drawReasonLabel(outcome.reason)}`;
    case "ongoing":
      return null;
  }
}

function drawReasonLabel(
  reason: "insufficient-material" | "threefold-repetition" | "fifty-move" | "other",
): string {
  switch (reason) {
    case "insufficient-material":
      return "insufficient material";
    case "threefold-repetition":
      return "threefold repetition";
    case "fifty-move":
      return "fifty-move rule";
    case "other":
      return "agreed";
  }
}
