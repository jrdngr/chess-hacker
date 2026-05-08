import { useState } from "react";

import { CardEditor } from "./editors/CardEditor";
import { ArtifactEditor } from "./editors/ArtifactEditor";
import { BossEditor } from "./editors/BossEditor";
import { DeckEditor } from "./editors/DeckEditor";
import { StatusEffectEditor } from "./editors/StatusEffectEditor";
import { TopBar } from "./components/TopBar";

type Tab = "cards" | "artifacts" | "bosses" | "statusEffects" | "decks";

const TABS: { id: Tab; label: string }[] = [
  { id: "cards", label: "Cards" },
  { id: "artifacts", label: "Artifacts" },
  { id: "bosses", label: "Bosses" },
  { id: "statusEffects", label: "Status Effects" },
  { id: "decks", label: "Decks" },
];

export function App() {
  const [tab, setTab] = useState<Tab>("cards");

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 16px",
          background: "#0e1013",
          borderBottom: "1px solid #2a2d33",
        }}
      >
        <strong style={{ marginRight: 12 }}>choss · Content Designer</strong>
        <nav style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? "#4a90e2" : "transparent",
                border: tab === t.id ? "1px solid #4a90e2" : "1px solid #2a2d33",
                color: tab === t.id ? "#0e1013" : undefined,
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <TopBar />
      </header>
      <main style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {tab === "cards" && <CardEditor />}
        {tab === "artifacts" && <ArtifactEditor />}
        {tab === "bosses" && <BossEditor />}
        {tab === "statusEffects" && <StatusEffectEditor />}
        {tab === "decks" && <DeckEditor />}
      </main>
    </div>
  );
}
