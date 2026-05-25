import { useMemo, useRef, useState } from "react";

import { allArtifacts } from "../../../game/artifacts/library";
import { ARTIFACT_SLOT_CAP } from "../../../game/types";
import type { Artifact } from "../../../game/types";
import { FormattedText } from "../../FormattedText";

import styles from "./DevPanel.module.css";

/**
 * Artifact-editor entry. Existing artifacts can be marked `removed` and undone;
 * newly added ones drop entirely when un-added.
 */
type ArtifactEntry =
  | { kind: "existing"; artifact: Artifact; key: string; removed: boolean }
  | { kind: "new"; artifact: Artifact; key: string };

type Props = {
  artifacts: ReadonlyArray<Artifact>;
  onSave: (next: Artifact[]) => void;
  onClose: () => void;
};

export function ArtifactEditorOverlay({ artifacts, onSave, onClose }: Props) {
  const [entries, setEntries] = useState<ArtifactEntry[]>(() =>
    artifacts.map((artifact, i) => ({
      kind: "existing",
      artifact,
      key: `existing-${i}-${artifact.id}`,
      removed: false,
    })),
  );
  const newKeyRef = useRef(0);

  const liveEntries = entries.filter((e) => e.kind === "new" || !e.removed);
  const liveCount = liveEntries.length;
  const removedCount = entries.filter((e) => e.kind === "existing" && e.removed).length;
  const addedCount = entries.filter((e) => e.kind === "new").length;
  const heldIds = new Set(liveEntries.map((e) => e.artifact.id));

  const groupedLibrary = useMemo(() => {
    const groups = new Map<Artifact["rarity"], Artifact[]>();
    for (const a of allArtifacts()) {
      const list = groups.get(a.rarity);
      if (list) list.push(a);
      else groups.set(a.rarity, [a]);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    const order: Artifact["rarity"][] = ["common", "uncommon", "rare"];
    return order
      .filter((r) => groups.has(r))
      .map((r) => [r, groups.get(r)!] as [Artifact["rarity"], Artifact[]]);
  }, []);

  const toggleRemove = (key: string) => {
    setEntries((prev) =>
      prev.flatMap((e) => {
        if (e.key !== key) return [e];
        if (e.kind === "new") return [];
        return [{ ...e, removed: !e.removed }];
      }),
    );
  };

  const addArtifact = (artifact: Artifact) => {
    setEntries((prev) => [...prev, { kind: "new", artifact, key: `new-${newKeyRef.current++}` }]);
  };

  const handleSave = () => {
    const next: Artifact[] = [];
    for (const entry of entries) {
      if (entry.kind === "existing" && !entry.removed) next.push(entry.artifact);
      else if (entry.kind === "new") next.push(entry.artifact);
    }
    onSave(next);
  };

  return (
    <aside className={`${styles.devPanel} ${styles.libraryPanel}`}>
      <div className={styles.libraryHeader}>
        <h3 className={styles.heading}>Artifact editor</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close artifact editor"
        >
          ×
        </button>
      </div>
      <p className={styles.note}>
        Add or remove artifacts on the run. Slot cap is {ARTIFACT_SLOT_CAP}; the dev editor lets you
        go over for testing. Changes apply on Save.
      </p>

      <div className={styles.deckSummaryRow}>
        <span>{liveCount} artifacts</span>
        {addedCount > 0 && <span className={styles.deckSummaryAdded}>+{addedCount}</span>}
        {removedCount > 0 && <span className={styles.deckSummaryRemoved}>−{removedCount}</span>}
      </div>

      <div className={styles.deckActions}>
        <button type="button" className={styles.smallButton} onClick={handleSave}>
          Save artifacts
        </button>
        <button type="button" className={styles.smallButton} onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className={styles.libraryListFull}>
        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Held</div>
          {entries.length === 0 && <div className={styles.note}>No artifacts held.</div>}
          {entries.map((entry) => {
            const removed = entry.kind === "existing" && entry.removed;
            const tag = entry.kind === "new" ? "new" : "draw";
            return (
              <div
                key={entry.key}
                className={`${styles.deckEntry} ${styles.artifactEntry} ${removed ? styles.deckEntryRemoved : ""}`}
              >
                <span className={styles.deckEntryBody}>
                  <span className={styles.libraryCardName}>{entry.artifact.name}</span>
                  <span className={styles.libraryCardDesc}>
                    <FormattedText text={entry.artifact.description} />
                  </span>
                </span>
                <span className={`${styles.deckEntryTag} ${styles[`deckEntryTag_${tag}`] ?? ""}`}>
                  {entry.kind === "new" ? "new" : entry.artifact.rarity}
                </span>
                <button
                  type="button"
                  className={styles.deckEntryRemoveButton}
                  onClick={() => toggleRemove(entry.key)}
                  aria-label={removed ? "Restore artifact" : "Remove artifact"}
                >
                  {entry.kind === "new" ? "×" : removed ? "↺" : "×"}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Add from library</div>
          {groupedLibrary.map(([rarity, list]) => (
            <div key={rarity} className={styles.libraryGroup}>
              <div className={styles.libraryGroupHeading}>{rarity}</div>
              {list.map((a) => {
                const alreadyHeld = heldIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={styles.libraryCard}
                    disabled={alreadyHeld}
                    onClick={() => addArtifact(a)}
                    data-artifact-id={a.id}
                  >
                    <span className={styles.libraryCardName}>{a.name}</span>
                    <span className={styles.libraryCardDesc}>
                      <FormattedText text={a.description} />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
