// Top-level shell. Picks a top-level run mode, then hands off to the
// matching shell.
//
//   menu  → sandbox        → Match (runMode="dev")
//   menu  → royal          → Run (mode="royal")  [3-match mini-run, M5]
//   menu  → skirmish       → Run (mode="skirmish") — disabled until M10
//
// The Run shell owns gold / deck / artifacts and routes between match,
// reward, and shop phases. Persistence (M9) will attach at the Run boundary.

import { useState } from "react";

import { Match } from "./components/Match";
import { Run } from "./components/Run/Run";

import styles from "./App.module.css";

type Route = "menu" | "sandbox" | "royal" | "skirmish";

type ModeOption = {
  id: Exclude<Route, "menu">;
  label: string;
  description: string;
  enabled: boolean;
};

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  {
    id: "royal",
    label: "Royal",
    description: "Standard chess armies + cards. 3-match mini-run.",
    enabled: true,
  },
  {
    id: "skirmish",
    label: "Skirmish",
    description: "Roguelite army-builder + cards. Coming in M10.",
    enabled: false,
  },
  {
    id: "sandbox",
    label: "Sandbox",
    description: "Board editor, free card library, optional AI.",
    enabled: true,
  },
];

export function App() {
  const [route, setRoute] = useState<Route>("menu");

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>choss</h1>
        <span className={styles.tag}>cards · M5 prototype</span>
      </header>
      <main className={styles.main}>
        {route === "menu" && <ModeMenu onPick={setRoute} />}
        {route === "sandbox" && <Match runMode="dev" onExit={() => setRoute("menu")} />}
        {route === "royal" && <Run mode="royal" onExit={() => setRoute("menu")} />}
      </main>
    </div>
  );
}

function ModeMenu({ onPick }: { onPick: (route: Route) => void }) {
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
            onClick={() => opt.enabled && onPick(opt.id)}
          >
            <span className={styles.menuButtonLabel}>{opt.label}</span>
            <span className={styles.menuButtonDesc}>{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
