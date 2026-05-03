// Top-level shell. Picks a top-level run mode, then hands off to the
// matching shell. Royal and Skirmish are reserved as future modes; Dev is a
// development-only sandbox parallel to them. Prototype Match preserves the
// current vs-AI / Local-PvP playground until Royal and Skirmish ship.

import { useState } from "react";

import { Match } from "./components/Match";

import styles from "./App.module.css";

type RunMode = "menu" | "dev" | "prototype";

type ModeOption = {
  id: Exclude<RunMode, "menu">;
  label: string;
  description: string;
  enabled: boolean;
};

const MODE_OPTIONS: ReadonlyArray<
  ModeOption | { id: "royal" | "skirmish"; label: string; description: string; enabled: false }
> = [
  {
    id: "dev",
    label: "Dev",
    description: "Sandbox: board editor, free card library, optional AI.",
    enabled: true,
  },
  {
    id: "royal",
    label: "Royal",
    description: "Standard chess armies + cards. Coming soon.",
    enabled: false,
  },
  {
    id: "skirmish",
    label: "Skirmish",
    description: "Roguelite army-builder + cards. Coming soon.",
    enabled: false,
  },
  {
    id: "prototype",
    label: "Prototype Match",
    description: "vs-AI / Local-PvP playground (will be retired).",
    enabled: true,
  },
];

export function App() {
  const [runMode, setRunMode] = useState<RunMode>("menu");

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>choss</h1>
        <span className={styles.tag}>cards · M3 prototype</span>
      </header>
      <main className={styles.main}>
        {runMode === "menu" && <ModeMenu onPick={setRunMode} />}
        {runMode === "dev" && <Match runMode="dev" onExit={() => setRunMode("menu")} />}
        {runMode === "prototype" && <Match runMode="prototype" onExit={() => setRunMode("menu")} />}
      </main>
    </div>
  );
}

function ModeMenu({ onPick }: { onPick: (mode: RunMode) => void }) {
  return (
    <div className={styles.menu}>
      <h2 className={styles.menuTitle}>Choose a mode</h2>
      <div className={styles.menuList}>
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={styles.menuButton}
            disabled={!opt.enabled}
            onClick={() => opt.enabled && onPick(opt.id as RunMode)}
          >
            <span className={styles.menuButtonLabel}>{opt.label}</span>
            <span className={styles.menuButtonDesc}>{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
