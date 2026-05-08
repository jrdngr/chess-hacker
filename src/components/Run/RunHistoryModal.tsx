// Run-history modal — shows every event in the run's log (most recent first)
// with Copy JSON / Show JSON controls so the player can paste a complete log
// into a bug report. Reuses the styling from the per-match HistoryModal.

import { useMemo, useRef, useState } from "react";

import { describeRunEvent, serializeRunHistory, type RunHistoryEvent } from "./runHistory";
import styles from "../Match/HistoryModal.module.css";

type Props = {
  events: ReadonlyArray<RunHistoryEvent>;
  onClose: () => void;
};

export function RunHistoryModal({ events, onClose }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Most recent first.
  const ordered = useMemo(() => events.slice().reverse(), [events]);
  const json = useMemo(() => serializeRunHistory(events), [events]);

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
      } else if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand("copy");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fall through — user can still select-all manually in the textarea.
      setShowJson(true);
    }
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-label="Run log">
      <div className={styles.dialog}>
        <header className={styles.header}>
          <h2 className={styles.title}>Run log</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close run log"
          >
            ×
          </button>
        </header>
        <p className={styles.hint}>
          Every event in this run, most recent first. The export bundles run setup, match starts /
          ends, every chess move and card play, and shop / reward picks — paste into a bug report to
          reproduce the run.
        </p>

        <div className={styles.actions}>
          <button type="button" onClick={copy} className={styles.exportButton}>
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className={styles.toggleButton}
          >
            {showJson ? "Hide JSON" : "Show JSON"}
          </button>
        </div>

        {showJson && (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={json}
            readOnly
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Run log JSON"
          />
        )}

        <ul className={styles.eventList}>
          {ordered.length === 0 ? (
            <li className={styles.empty}>(no events yet)</li>
          ) : (
            ordered.map((ev, i) => (
              <li key={`${events.length - 1 - i}`} className={styles.eventRow}>
                <span className={styles.eventIndex}>#{events.length - i}</span>
                <span className={styles.eventText}>{describeRunEvent(ev)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
