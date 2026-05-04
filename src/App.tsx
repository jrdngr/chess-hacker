// Top-level shell. Picks a top-level run mode, then hands off to the
// matching shell. Royal and Skirmish are reserved as future modes; Sandbox
// is the development-only playground parallel to them.
//
// M5 routing surface (planned):
//   menu  → run start (mode pick)
//          → match  → reward  → shop  → match  → ...  → run end / menu
// The run shell will live in a sibling component (e.g. `<Run mode="royal" />`)
// driven by RunState (see src/game/types.ts). It will own gold, deck,
// artifacts, and act/match indices, and pass the per-match Card[] / Piece[]
// down to <Match>. Persistence (M9) attaches at the run boundary.

import { useState } from "react";

import { Match } from "./components/Match";

import styles from "./App.module.css";

type RunMode = "menu" | "sandbox";

type ModeOption = {
  id: Exclude<RunMode, "menu"> | "royal" | "skirmish";
  label: string;
  description: string;
  enabled: boolean;
};

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  {
    id: "sandbox",
    label: "Sandbox",
    description: "Board editor, free card library, optional AI.",
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
        {runMode === "sandbox" && <Match runMode="dev" onExit={() => setRunMode("menu")} />}
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
            onClick={() => opt.enabled && opt.id === "sandbox" && onPick("sandbox")}
          >
            <span className={styles.menuButtonLabel}>{opt.label}</span>
            <span className={styles.menuButtonDesc}>{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
