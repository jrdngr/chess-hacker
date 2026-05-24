import styles from "./EvalBar.module.css";

type Props = {
  scoreCp: number | null;
  scoreMate: number | null;
  turnsLeft?: number;
};

function sigmoid(cp: number): number {
  return 1 / (1 + Math.exp(-cp / 400));
}

function formatScore(scoreCp: number | null, scoreMate: number | null): string {
  if (scoreMate !== null) return `M${Math.abs(scoreMate)}`;
  if (scoreCp !== null) return (scoreCp >= 0 ? "+" : "") + (scoreCp / 100).toFixed(1);
  return "0.0";
}

export function EvalBar({ scoreCp, scoreMate, turnsLeft }: Props) {
  let whitePct: number;
  if (scoreMate !== null) {
    whitePct = scoreMate > 0 ? 95 : 5;
  } else {
    whitePct = sigmoid(scoreCp ?? 0) * 100;
  }
  const blackPct = 100 - whitePct;

  return (
    <div className={styles.evalBar} aria-label="Position evaluation">
      <div className={styles.blackHalf} style={{ flex: blackPct }} />
      <div className={styles.whiteHalf} style={{ flex: whitePct }} />
      <span className={styles.label}>{formatScore(scoreCp, scoreMate)}</span>
      {turnsLeft !== undefined && <span className={styles.turnsLeft}>{turnsLeft}T</span>}
    </div>
  );
}
