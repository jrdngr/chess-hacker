import type {
  DesignerArtifactEntry,
  DesignerBossEntry,
  DesignerCardEntry,
  DesignerState,
  NewPropertyAnnotation,
} from "./types";

/**
 * Single-item export envelope. The shape is the same one the game already
 * consumes (e.g. for cards: byte-compatible with `src/game/cards/data/<id>.json`),
 * with an OPTIONAL `__designerNew` field present only when the user
 * introduced new property values. A downstream agent reads `__designerNew`,
 * extends the relevant union types and validators, then strips the key.
 */
type WithNew<T> = T & { __designerNew?: NewPropertyAnnotation[] };

function withNew<T>(data: T, news?: NewPropertyAnnotation[]): WithNew<T> {
  if (!news || news.length === 0) return { ...data } as WithNew<T>;
  return { ...data, __designerNew: news } as WithNew<T>;
}

export function exportCardEntry(entry: DesignerCardEntry): WithNew<typeof entry.data> {
  return withNew(entry.data, entry.newProperties);
}

export function exportArtifactEntry(entry: DesignerArtifactEntry): WithNew<typeof entry.data> {
  return withNew(entry.data, entry.newProperties);
}

export function exportBossEntry(entry: DesignerBossEntry): WithNew<typeof entry.data> {
  return withNew(entry.data, entry.newProperties);
}

export function exportDeck(deck: {
  name: string;
  description?: string;
  cards: { id: string; count: number }[];
}): { name: string; description?: string; cards: { id: string; count: number }[] } {
  const out: { name: string; description?: string; cards: { id: string; count: number }[] } = {
    name: deck.name,
    cards: deck.cards.map((c) => ({ id: c.id, count: c.count })),
  };
  if (deck.description) out.description = deck.description;
  return out;
}

/** Full DesignerState — reimportable to restore the workspace verbatim. */
export function exportFullState(state: DesignerState): DesignerState {
  return state;
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
