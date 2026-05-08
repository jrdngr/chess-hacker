import { useRef } from "react";

import { useStore } from "../state/useStore";
import { downloadJson, exportFullState } from "../state/exporters";
import type { DesignerState } from "../state/types";

export function TopBar() {
  const { state, replace, resetLibrary } = useStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onExportFull = () => {
    downloadJson("choss-content-state.json", exportFullState(state));
  };

  const onImportFull = () => {
    fileInputRef.current?.click();
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as DesignerState;
        if (parsed.version !== 2) {
          alert(`Unsupported state version: ${(parsed as { version?: unknown }).version}`);
          return;
        }
        replace(parsed);
      } catch (err) {
        alert(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
    });
    e.target.value = "";
  };

  const onReset = () => {
    if (
      !confirm(
        "Reset all library entries back to the current game snapshot? User-created items and decks are preserved.",
      )
    ) {
      return;
    }
    resetLibrary();
  };

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button onClick={onExportFull}>Export full state</button>
      <button onClick={onImportFull}>Import full state</button>
      <button onClick={onReset}>Reset library snapshot</button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={onPickFile}
      />
    </div>
  );
}
