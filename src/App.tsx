// Top-level shell. Picks a top-level run mode, then hands off to the
// matching shell.
//
//   menu  → sandbox        → Match (runMode="dev")
//   menu  → standard       → Run (mode="standard") — the active default
//   menu  → royal          → disabled (post-prototype)
//   menu  → skirmish       → disabled (M10)
//
// The Run shell owns gold / deck / artifacts and routes between match,
// reward, and shop phases. Persistence (M9) will attach at the Run boundary.

import { useState } from "react";

import { Match } from "./components/Match";
import { Run } from "./components/Run/Run";

import styles from "./App.module.css";

type Route = "menu" | "sandbox" | "standard" | "royal" | "skirmish";

type ModeOption = {
  id: Exclude<Route, "menu">;
  label: string;
  description: string;
  enabled: boolean;
};

const MODE_OPTIONS: ReadonlyArray<ModeOption> = [
  {
    id: "standard",
    label: "Standard",
    description: "Variable board (4×6 → 8×8) with a points-budget piece curve. Default mode.",
    enabled: true,
  },
  {
    id: "royal",
    label: "Royal",
    description: "Classic 8x8 armies. Reserved for post-prototype.",
    enabled: false,
  },
  {
    id: "skirmish",
    label: "Skirmish",
    description: "Roguelite army-builder. Coming in M10.",
    enabled: false,
  },
  {
    id: "sandbox",
    label: "Sandbox",
    description: "Board editor (3x3–8x8), free card library, optional AI.",
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
        {route === "sandbox" && (
          <div className={styles.sandbox}>
            <div className={styles.sandboxBanner}>
              <span className={styles.sandboxBannerSegment}>
                <span className={styles.sandboxBannerLabel}>Mode</span>
                <span className={styles.sandboxBannerValue}>Sandbox</span>
              </span>
              <button type="button" onClick={() => setRoute("menu")} className={styles.sandboxQuit}>
                Quit sandbox
              </button>
            </div>
            <Match runMode="dev" />
          </div>
        )}
        {route === "standard" && <Run mode="standard" onExit={() => setRoute("menu")} />}
      </main>
    </div>
  );
}

function ModeMenu({ onPick }: { onPick: (route: Route) => void }) {
  return (
    <div className={styles.menu}>
      <h2 className={styles.menuTitle}>Choose a mode</h2>
      <div className={styles.menuList}>
        {MODE_OPTIONS.filter((opt) => opt.enabled).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={styles.menuButton}
            onClick={() => onPick(opt.id)}
          >
            <span className={styles.menuButtonLabel}>{opt.label}</span>
            <span className={styles.menuButtonDesc}>{opt.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
