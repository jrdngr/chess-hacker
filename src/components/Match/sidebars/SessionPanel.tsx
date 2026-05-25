// SESSION panel — turn (hex) / ply / to-move / opponent / dashed sep /
// gold / interest.

import type { ReactNode } from "react";

import type { BossDef, MatchCardState, Side } from "../../../game/types";
import { Panel } from "./Panel";
import styles from "./SessionPanel.module.css";

type Props = {
  cardState: MatchCardState;
  /** Whose turn is it (chess engine.turn()). */
  toMove: Side;
  /** True if AI is mid-think — overrides toMove display. */
  aiThinking?: boolean;
  /** Optional active boss — populates OPPONENT row. */
  boss?: BossDef | null;
  /** Run gold + last interest. Both omitted when out-of-run (tests). */
  gold?: number;
  interest?: number;
};

function Stat({
  label,
  value,
  emphasis,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: "player" | "opp" | "dim";
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span
        className={`${styles.statValue} ${
          emphasis === "player"
            ? styles.player
            : emphasis === "opp"
              ? styles.opp
              : emphasis === "dim"
                ? styles.dim
                : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function SessionPanel({ cardState, toMove, aiThinking, boss, gold, interest }: Props) {
  const turn = cardState.turn;
  const ply = Math.max(1, turn * 2 - 1);

  return (
    <Panel title="SESSION">
      <Stat label="TURN" value={`0x${turn.toString(16).padStart(2, "0").toUpperCase()}`} />
      <Stat label="PLY" value={ply} />
      <Stat
        label="TO MOVE"
        value={aiThinking ? "AI…" : toMove === "player" ? "USR" : "OPP"}
        emphasis={aiThinking ? "dim" : toMove === "player" ? "player" : "opp"}
      />
      <Stat
        label="OPPONENT"
        value={boss ? boss.name.toUpperCase() : "STOCKFISH"}
        emphasis={boss ? "opp" : "dim"}
      />

      {(gold !== undefined || interest !== undefined) && (
        <>
          <hr className={styles.dash} />
          {gold !== undefined && <Stat label="GOLD" value={gold} />}
          {interest !== undefined && interest > 0 && (
            <Stat label="INT" value={`+${interest}`} emphasis="dim" />
          )}
        </>
      )}
    </Panel>
  );
}
