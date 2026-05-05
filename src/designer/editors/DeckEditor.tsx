import { useMemo, useState } from "react";

import { EntryList, type ListItem } from "../components/EntryList";
import { Field, Row, Section, TwoPane } from "../components/Layout";
import { useStore } from "../state/useStore";
import { downloadJson, exportDeck } from "../state/exporters";
import type { DesignerDeckEntry } from "../state/types";

export function DeckEditor() {
  const { state, update } = useStore();
  const [selectedName, setSelectedName] = useState<string | null>(() => {
    const names = Object.keys(state.decks).sort();
    return names[0] ?? null;
  });

  const items: ListItem[] = useMemo(
    () =>
      Object.values(state.decks)
        .map((d) => ({
          id: d.name,
          label: d.name,
          sublabel: `${d.cards.reduce((acc, c) => acc + c.count, 0)} cards`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [state.decks],
  );

  const entry = selectedName ? state.decks[selectedName] : null;

  const onCreate = () => {
    const name = prompt("Deck name:")?.trim();
    if (!name) return;
    if (state.decks[name]) {
      alert("A deck with that name already exists.");
      return;
    }
    update((s) => ({
      ...s,
      decks: { ...s.decks, [name]: { name, cards: [] } },
    }));
    setSelectedName(name);
  };

  const onUpdate = (next: DesignerDeckEntry, prevName?: string) => {
    update((s) => {
      const decks = { ...s.decks };
      if (prevName && prevName !== next.name) delete decks[prevName];
      decks[next.name] = next;
      return { ...s, decks };
    });
    setSelectedName(next.name);
  };

  const onDelete = (name: string) => {
    if (!confirm(`Delete deck '${name}'?`)) return;
    update((s) => {
      const decks = { ...s.decks };
      delete decks[name];
      return { ...s, decks };
    });
    setSelectedName(null);
  };

  return (
    <TwoPane
      left={
        <EntryList
          items={items}
          selectedId={selectedName}
          onSelect={setSelectedName}
          onCreate={onCreate}
          createLabel="+ New deck"
          emptyMessage="No decks. Click + New deck to create one."
        />
      }
      right={
        entry ? (
          <DeckForm key={entry.name} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
        ) : (
          <div style={{ opacity: 0.6 }}>Select a deck on the left to edit.</div>
        )
      }
    />
  );
}

function DeckForm({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: DesignerDeckEntry;
  onUpdate: (next: DesignerDeckEntry, prevName?: string) => void;
  onDelete: (name: string) => void;
}) {
  const { state } = useStore();
  const [saveStatus, setSaveStatus] = useState<string>("");

  const setEntry = (patch: Partial<DesignerDeckEntry>) => {
    onUpdate({ ...entry, ...patch }, entry.name);
  };

  const totalCount = entry.cards.reduce((acc, c) => acc + c.count, 0);

  const sortedCardIds = Object.keys(state.cards).sort();
  const knownIds = new Set(sortedCardIds);

  const setCount = (id: string, count: number) => {
    const safe = Math.max(0, Math.floor(count));
    const next = entry.cards.filter((c) => c.id !== id);
    if (safe > 0) next.push({ id, count: safe });
    setEntry({ cards: next });
  };

  const onSaveToGame = async () => {
    setSaveStatus("Saving…");
    try {
      const res = await fetch("/__designer/decks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: entry.name,
          deck: exportDeck(entry),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { ok: boolean; path: string };
      setSaveStatus(`Wrote ${body.path}`);
    } catch (err) {
      setSaveStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // current cards already in the deck — render with quantity controls
  const inDeck = new Set(entry.cards.map((c) => c.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 820 }}>
      <Row>
        <h2 style={{ margin: 0 }}>{entry.name}</h2>
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>{totalCount} cards</span>
        <div style={{ flex: 1 }} />
        <button onClick={onSaveToGame}>Save to game</button>
        <button onClick={() => downloadJson(`${slugify(entry.name)}.json`, exportDeck(entry))}>
          Export JSON
        </button>
        <button onClick={() => onDelete(entry.name)} style={{ color: "#e57373" }}>
          Delete
        </button>
      </Row>
      {saveStatus && (
        <div
          style={{
            fontSize: 12,
            padding: "4px 8px",
            background: saveStatus.startsWith("Failed") ? "#3a1f1f" : "#1f3a2a",
            borderRadius: 4,
          }}
        >
          {saveStatus}
        </div>
      )}

      <Section title="Identity">
        <Field label="name" hint="used as the file slug when saving to game">
          <input
            type="text"
            value={entry.name}
            onChange={(e) => onUpdate({ ...entry, name: e.target.value }, entry.name)}
            style={{ width: 320 }}
          />
        </Field>
        <Field label="description">
          <textarea
            value={entry.description ?? ""}
            onChange={(e) => setEntry({ description: e.target.value || undefined })}
            rows={2}
            style={{ width: "100%" }}
          />
        </Field>
      </Section>

      <Section title={`Cards in deck (${entry.cards.length} unique, ${totalCount} total)`}>
        {entry.cards.length === 0 && (
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            No cards yet. Use the catalogue below to add some.
          </div>
        )}
        {entry.cards.map((c) => (
          <Row key={c.id} gap={8}>
            <span style={{ minWidth: 220, fontSize: 12 }}>
              {c.id}
              {!knownIds.has(c.id) && (
                <span style={{ marginLeft: 8, color: "#e57373", fontSize: 11 }}>unknown id</span>
              )}
            </span>
            <button onClick={() => setCount(c.id, c.count - 1)}>−</button>
            <input
              type="number"
              value={c.count}
              min={0}
              onChange={(e) => setCount(c.id, Number(e.target.value))}
              style={{ width: 60 }}
            />
            <button onClick={() => setCount(c.id, c.count + 1)}>+</button>
          </Row>
        ))}
      </Section>

      <Section title="Card catalogue">
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
          Click a card to add 1 copy. Already-included cards show their current count.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 4,
          }}
        >
          {sortedCardIds.map((id) => {
            const e = state.cards[id];
            const cur = entry.cards.find((c) => c.id === id);
            const count = cur?.count ?? 0;
            return (
              <button
                key={id}
                onClick={() => setCount(id, count + 1)}
                style={{
                  textAlign: "left",
                  padding: "4px 8px",
                  background: inDeck.has(id) ? "#1f2329" : "#0e1013",
                  border: "1px solid #2a2d33",
                }}
                title={e.data.description}
              >
                <div style={{ fontSize: 12 }}>
                  {e.data.name}
                  {count > 0 && <span style={{ marginLeft: 6, opacity: 0.7 }}>×{count}</span>}
                </div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>
                  {e.data.archetype} · cost {e.data.cost}
                </div>
              </button>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
