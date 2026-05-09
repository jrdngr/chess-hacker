// ARTIFACTS panel — uppercase name list, colour-coded by rarity using
// variations of the active palette's primary tone. Description is hidden in
// the panel body and surfaced via hover/focus tooltip. Empty rows render
// EMPTY SLOT up to a cap of 5.

import type { Artifact, CardRarity } from "../../../game/types";

import { Panel } from "./Panel";
import styles from "./ArtifactsPanel.module.css";

const SLOT_CAP = 5;

const RARITY_CLASS: Record<CardRarity, string> = {
  common: styles.common,
  uncommon: styles.uncommon,
  rare: styles.rare,
};

type Props = {
  artifacts: ReadonlyArray<Artifact>;
};

export function ArtifactsPanel({ artifacts }: Props) {
  const empty = Math.max(0, SLOT_CAP - artifacts.length);
  return (
    <Panel title="ARTIFACTS" ticker={`${artifacts.length}/${SLOT_CAP}`}>
      <div className={styles.list}>
        {artifacts.map((a) => (
          <div
            key={a.id}
            className={`${styles.item} ${RARITY_CLASS[a.rarity] ?? ""}`}
            tabIndex={0}
            aria-label={`${a.name} — ${a.description}`}
          >
            <span className={styles.name}>
              {a.emoji ? <span className={styles.emoji}>{a.emoji}</span> : null}
              {a.name.toUpperCase()}
            </span>
            <span className={styles.tooltip} role="tooltip">
              <span className={styles.tooltipName}>{a.name}</span>
              <span className={styles.tooltipDesc}>{a.description}</span>
            </span>
          </div>
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <div key={`empty-${i}`} className={styles.empty} aria-hidden>
            EMPTY SLOT
          </div>
        ))}
      </div>
    </Panel>
  );
}
