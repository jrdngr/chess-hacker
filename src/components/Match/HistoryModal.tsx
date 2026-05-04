// History modal — shows every action taken in the match (most recent first)
// with a button that exports the entire log as JSON for copy-pasting into
// bug reports. Built on the same backdrop primitive as the other Match
// modals; styles live in HistoryModal.module.css.

import { useMemo, useRef, useState } from "react";

import { describeEvent, serializeHistory, type HistoryEvent } from "./history";
import styles from "./HistoryModal.module.css";

type Props = {
  events: ReadonlyArray<HistoryEvent>;
  onClose: () => void;
};

export function HistoryModal({ events, onClose }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Most recent first.
  const ordered = useMemo(() => events.slice().reverse(), [events]);
  const json = useMemo(() => serializeHistory(events), [events]);

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
    <div className={styles.backdrop} role="dialog" aria-label="Match history">
      <div className={styles.dialog}>
        <header className={styles.header}>
          <h2 className={styles.title}>History</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close history"
          >
            ×
          </button>
        </header>
        <p className={styles.hint}>
          Most recent first. Scroll to see older events. Export as JSON to paste into a bug report.
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
            aria-label="Match history JSON"
          />
        )}

        <ul className={styles.eventList}>
          {ordered.length === 0 ? (
            <li className={styles.empty}>(no events yet)</li>
          ) : (
            ordered.map((ev, i) => (
              <li key={`${events.length - 1 - i}`} className={styles.eventRow}>
                <span className={styles.eventIndex}>#{events.length - i}</span>
                <span className={styles.eventText}>{describeEvent(ev)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
