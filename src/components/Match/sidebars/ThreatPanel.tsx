// THREAT panel — boss intel + Stockfish strength readout. With a boss active
// the panel switches to a red accent and shows the modifier description; in
// regular matches it falls back to a "NO HOSTILE INTEL // ENGAGE.AI"
// placeholder.
//
// Free-play exposes a manual depth dropdown (`difficulty`/`onDifficultyChange`).
// Run mode instead drives strength from the per-match schedule (CH-031) and
// passes `strength` for a read-only readout — the player can't hand-pick depth
// mid-run.

import type { BossDef } from "../../../game/types";
import type { AiStrength, Difficulty } from "../../../ai/stockfish";

import { Panel } from "./Panel";
import styles from "./ThreatPanel.module.css";

type Props = {
  boss?: BossDef | null;
  /** Free-play manual selector. Omit in run mode. */
  difficulty?: Difficulty;
  onDifficultyChange?: (d: Difficulty) => void;
  /** Run-mode read-only strength readout. Omit in free-play. */
  strength?: AiStrength;
};

export function ThreatPanel({ boss, difficulty, onDifficultyChange, strength }: Props) {
  const showSelector = difficulty != null && onDifficultyChange != null;
  return (
    <Panel
      title="THREAT"
      ticker={boss ? "INTEL" : "AI"}
      accentVar={boss ? "--p-opp" : "--p-primary"}
      className={styles.panel}
    >
      {boss ? (
        <>
          <div className={styles.bossName}>{boss.name.toUpperCase()}</div>
          <div className={styles.body}>{boss.modifierDescription}</div>
          <div className={styles.hint}>HINT &gt;&gt; READ MODIFIER BEFORE COMMITTING</div>
        </>
      ) : (
        <>
          <div className={styles.placeholder}>NO HOSTILE INTEL // ENGAGE.AI</div>
          <div className={styles.body}>
            Stockfish is at the helm. Tune depth to taste; harder depths search further but make the
            AI take longer to move.
          </div>
        </>
      )}
      {showSelector ? (
        <div className={styles.depthRow}>
          <label htmlFor="threat-depth" className={styles.depthLabel}>
            STOCKFISH DEPTH
          </label>
          <select
            id="threat-depth"
            className={styles.depthSelect}
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value as Difficulty)}
          >
            <option value="easy">EASY · D2</option>
            <option value="normal">NORMAL · D6</option>
            <option value="hard">HARD · D10</option>
          </select>
        </div>
      ) : strength ? (
        <div className={styles.depthRow}>
          <span className={styles.depthLabel}>STOCKFISH</span>
          <span className={styles.depthSelect}>
            SKILL {strength.skillLevel ?? 20} · D{strength.depth ?? 6}
          </span>
        </div>
      ) : null}
    </Panel>
  );
}
