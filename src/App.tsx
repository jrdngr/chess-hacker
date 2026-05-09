// Top-level shell. Picks a top-level run mode, then hands off to the
// matching shell.
//
//   menu  → standard       → Run (mode="standard") — the active default
//   menu  → royal          → disabled (post-prototype)
//   menu  → skirmish       → disabled (M10)
//
// Sandbox has been removed — the dev panel inside a run covers its use cases.

import { useEffect, useState } from "react";

import { Run } from "./components/Run/Run";
import { Ticker } from "./components/Ticker/Ticker";
import { loadPalette, loadVision, savePalette, saveVision, type PaletteId } from "./state/palette";

import styles from "./App.module.css";

type Route = "menu" | "standard" | "royal" | "skirmish";

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
    description:
      "Three square boards (6×6 → 7×7 → 8×8, one per act) with a points-budget piece curve. Default mode.",
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
];

export function App() {
  const [route, setRoute] = useState<Route>("menu");
  const [palette, setPalette] = useState<PaletteId>(() => loadPalette());
  const [vision, setVision] = useState<boolean>(() => loadVision());

  // Apply the active palette to <html data-palette="..."> so every CSS
  // variable swap cascades through the app for free.
  useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  const onPaletteChange = (p: PaletteId) => {
    setPalette(p);
    savePalette(p);
  };

  const onToggleVision = () => {
    setVision((v) => {
      const next = !v;
      saveVision(next);
      return next;
    });
  };

  return (
    <div className={styles.app}>
      {/* On the menu route the Ticker shows project name + palette + vision
          only. Inside a run, Run renders its own Ticker with run + match
          status, so we omit ours here to avoid stacking two strips. */}
      {route === "menu" && (
        <Ticker
          palette={palette}
          onPaletteChange={onPaletteChange}
          vision={vision}
          onToggleVision={onToggleVision}
        />
      )}
      <main className={styles.main}>
        {route === "menu" && <ModeMenu onPick={setRoute} />}
        {route === "standard" && (
          <Run
            mode="standard"
            onExit={() => setRoute("menu")}
            palette={palette}
            onPaletteChange={onPaletteChange}
            vision={vision}
            onToggleVision={onToggleVision}
          />
        )}
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
