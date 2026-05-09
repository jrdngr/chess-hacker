// Top-level shell. Opens on the Draft Deck flow; once the player commits
// to a deck (either by picking a pre-made theme deck or by drafting one),
// the chosen deck and starting artifact ids are handed off to <Run>.
//
// The draft flow lives in <DraftFlow> (`src/components/Draft/`). It owns
// the deck-select + card-draft + artifact-draft state machine and only
// fires `onComplete` once with the finished deck and artifact list.

import { useEffect, useState } from "react";

import { DraftFlow } from "./components/Draft/DraftFlow";
import { Run } from "./components/Run/Run";
import { Ticker } from "./components/Ticker/Ticker";
import type { Card } from "./game/types";
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
  // Captured by <DraftFlow> on commit; consumed by <Run> on the next route.
  // Kept at the top level so the route flip doesn't lose them, and so a
  // future "play again with same deck" affordance has them on hand.
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
        {route === "draft" && (
          <DraftFlow
            onComplete={(deck, artifactIds) => {
              setStartingDeck(deck);
              setStartingArtifactIds(artifactIds);
              setRoute("standard");
            }}
          />
        )}
        {route === "standard" && (
          <Run
            mode="standard"
            onExit={() => setRoute("draft")}
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
