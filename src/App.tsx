// Top-level shell. Opens on mode selection, then the Draft Deck flow;
// once the player commits to a deck (either by picking a pre-made theme
// deck or by drafting one), the chosen deck and starting artifact ids are
// handed off to <Run> in the selected mode.

import { useEffect, useState } from "react";

import { DraftFlow } from "./components/Draft/DraftFlow";
import { ModeSelect } from "./components/ModeSelect";
import { Run } from "./components/Run/Run";
import { Ticker } from "./components/Ticker/Ticker";
import type { Card, RunMode } from "./game/types";
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

type Route = "modeSelect" | "draft" | "run";

export function App() {
  const [route, setRoute] = useState<Route>("modeSelect");
  const [selectedMode, setSelectedMode] = useState<RunMode>("standard");
  const [palette, setPalette] = useState<PaletteId>(() => loadPalette());
  const [vision, setVision] = useState<boolean>(() => loadVision());
  const [threats, setThreats] = useState<boolean>(() => loadThreats());
  const [startingDeck, setStartingDeck] = useState<Card[] | null>(null);
  const [startingArtifactIds, setStartingArtifactIds] = useState<string[] | null>(null);

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
      {route !== "run" && (
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
        {route === "modeSelect" && (
          <ModeSelect
            onSelect={(mode) => {
              setSelectedMode(mode);
              setRoute("draft");
            }}
          />
        )}
        {route === "draft" && (
          <DraftFlow
            onComplete={(deck, artifactIds) => {
              setStartingDeck(deck);
              setStartingArtifactIds(artifactIds);
              setRoute("run");
            }}
          />
        )}
        {route === "run" && (
          <Run
            mode={selectedMode}
            onExit={() => setRoute("modeSelect")}
            startingDeck={startingDeck ?? undefined}
            startingArtifactIds={startingArtifactIds ?? undefined}
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
