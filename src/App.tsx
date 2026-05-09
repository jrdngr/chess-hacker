// Top-level shell. Opens on the Draft Deck screen; picking a deck hands off
// to <Run>. The Draft Deck screen is a placeholder for the real card-draft
// flow — for now it offers a single "Standard Deck" button that starts a
// standard run with the default starter deck.

import { useEffect, useState } from "react";

import { Run } from "./components/Run/Run";
import { Ticker } from "./components/Ticker/Ticker";
import {
  loadPalette,
  loadThreats,
  loadVision,
  savePalette,
  saveThreats,
  saveVision,
  type PaletteId,
} from "./state/palette";

import styles from "./App.module.css";

type Route = "draft" | "standard";

export function App() {
  const [route, setRoute] = useState<Route>("draft");
  const [palette, setPalette] = useState<PaletteId>(() => loadPalette());
  const [vision, setVision] = useState<boolean>(() => loadVision());
  const [threats, setThreats] = useState<boolean>(() => loadThreats());

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

  const onToggleThreats = () => {
    setThreats((t) => {
      const next = !t;
      saveThreats(next);
      return next;
    });
  };

  return (
    <div className={styles.app}>
      {/* On the draft route the Ticker shows project name + palette + vision
          only. Inside a run, Run renders its own Ticker with run + match
          status, so we omit ours here to avoid stacking two strips. */}
      {route === "draft" && (
        <Ticker
          palette={palette}
          onPaletteChange={onPaletteChange}
          vision={vision}
          onToggleVision={onToggleVision}
          threats={threats}
          onToggleThreats={onToggleThreats}
        />
      )}
      <main className={styles.main}>
        {route === "draft" && <DraftDeckScreen onPickStandard={() => setRoute("standard")} />}
        {route === "standard" && (
          <Run
            mode="standard"
            onExit={() => setRoute("draft")}
            palette={palette}
            onPaletteChange={onPaletteChange}
            vision={vision}
            onToggleVision={onToggleVision}
            threats={threats}
            onToggleThreats={onToggleThreats}
          />
        )}
      </main>
    </div>
  );
}

function DraftDeckScreen({ onPickStandard }: { onPickStandard: () => void }) {
  return (
    <div className={styles.menu}>
      <h2 className={styles.menuTitle}>Draft Deck</h2>
      <div className={styles.menuList}>
        <button type="button" className={styles.menuButton} onClick={onPickStandard}>
          <span className={styles.menuButtonLabel}>Standard Deck</span>
        </button>
      </div>
    </div>
  );
}
