// RUN PATH panel — horizontal 9-dot strip. Boss matches use opp red and an
// "!" glyph; the current node glows. Data comes from totalMatches(state) +
// standardMatchConfig(i).isBoss; no new state required.

import { Fragment } from "react";

import { totalMatches } from "../../../game/progression/run";
import { standardMatchConfig } from "../../../game/progression/standard";
import type { RunState } from "../../../game/types";

import { Panel } from "./Panel";
import styles from "./RunPathPanel.module.css";

type Props = {
  run: RunState;
};

export function RunPathPanel({ run }: Props) {
  const total = totalMatches(run);
  const current = run.matchNumber;
  return (
    <Panel title="RUN PATH" ticker={`${current}/${total}`}>
      <div className={styles.row} role="list" aria-label="Run path">
        {Array.from({ length: total }).map((_, i) => {
          const matchNumber = i + 1;
          const isBoss = run.mode === "standard" ? standardMatchConfig(matchNumber).isBoss : false;
          const done = matchNumber < current;
          const here = matchNumber === current;
          const klass = [
            styles.dot,
            isBoss ? styles.boss : styles.normal,
            done ? styles.done : "",
            here ? styles.here : "",
          ]
            .filter(Boolean)
            .join(" ");
          const label = isBoss
            ? `Boss match ${matchNumber}${here ? " — current" : ""}`
            : `Match ${matchNumber}${here ? " — current" : ""}`;
          return (
            <Fragment key={i}>
              <span className={klass} role="listitem" aria-label={label} aria-current={here}>
                {isBoss ? "!" : ""}
              </span>
              {i < total - 1 && (
                <span className={`${styles.line} ${done ? styles.lineDone : ""}`} aria-hidden />
              )}
            </Fragment>
          );
        })}
      </div>
    </Panel>
  );
}
