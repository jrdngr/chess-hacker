// Artifact sidebar — shows the player's currently-held artifacts. Used in
// the Match shell, Shop, and end-of-run summary so the held artifacts are
// always visible. Hover an artifact to read the full description.

import { ARTIFACT_SLOT_CAP } from "../../game/types";
import type { Artifact } from "../../game/types";

import styles from "./ArtifactSidebar.module.css";

type Props = {
  artifacts: ReadonlyArray<Artifact>;
  /**
   * Layout. `row` (default) is for full-width screens (Shop, RunSummary);
   * `column` is for the Match shell which already has a vertical side panel.
   */
  layout?: "row" | "column";
};

export function ArtifactSidebar({ artifacts, layout = "row" }: Props) {
  return (
    <section
      className={`${styles.sidebar} ${layout === "column" ? styles.column : styles.row}`}
      aria-label="Artifacts"
    >
      <header className={styles.header}>
        <span className={styles.label}>Artifacts</span>
        <span className={styles.count}>
          {artifacts.length} / {ARTIFACT_SLOT_CAP}
        </span>
      </header>
      {artifacts.length === 0 ? (
        <p className={styles.empty}>None acquired yet.</p>
      ) : (
        <ul className={styles.list}>
          {artifacts.map((a) => (
            <li
              key={a.id}
              className={`${styles.item} ${rarityClass(a.rarity)}`}
              title={`${a.name} (${a.rarity}) — ${a.description}`}
              data-artifact-id={a.id}
            >
              <span className={styles.name}>{a.name}</span>
              <span className={styles.desc}>{a.description}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function rarityClass(rarity: Artifact["rarity"]): string {
  if (rarity === "rare") return styles.rare;
  if (rarity === "uncommon") return styles.uncommon;
  return styles.common;
}
