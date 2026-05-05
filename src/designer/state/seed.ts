import { CARD_LIBRARY } from "../../game/cards/library";
import { ARTIFACT_LIBRARY } from "../../game/artifacts/library";
import { BOSS_DEFS } from "../../game/bosses/library";

import type {
  DesignerArtifactEntry,
  DesignerBossEntry,
  DesignerCardEntry,
  DesignerState,
} from "./types";

/**
 * Build a fresh DesignerState seeded from the game's runtime libraries.
 * Used on first launch and by "Reset library snapshot". Library entries
 * are deep-cloned so subsequent edits don't mutate the live runtime data.
 */
export function freshDesignerState(): DesignerState {
  const cards: Record<string, DesignerCardEntry> = {};
  for (const card of Object.values(CARD_LIBRARY)) {
    cards[card.id] = {
      data: clone(card),
      source: "library",
      modified: false,
    };
  }

  const artifacts: Record<string, DesignerArtifactEntry> = {};
  for (const a of Object.values(ARTIFACT_LIBRARY)) {
    artifacts[a.id] = {
      data: clone(a),
      source: "library",
      modified: false,
    };
  }

  const bosses: Record<string, DesignerBossEntry> = {};
  for (const b of BOSS_DEFS) {
    bosses[b.id] = {
      data: clone(b),
      source: "library",
      modified: false,
    };
  }

  return {
    version: 1,
    cards,
    artifacts,
    bosses,
    decks: {},
  };
}

/**
 * Re-snapshot all `library` entries (preserving any `user` entries and any
 * authored decks). Use after pulling fresh game changes — without this,
 * the designer would still show the old library snapshot from localStorage.
 */
export function reseedLibrary(prev: DesignerState): DesignerState {
  const fresh = freshDesignerState();
  // Keep user-created entries as-is.
  for (const e of Object.values(prev.cards)) {
    if (e.source === "user") fresh.cards[e.data.id] = e;
  }
  for (const e of Object.values(prev.artifacts)) {
    if (e.source === "user") fresh.artifacts[e.data.id] = e;
  }
  for (const e of Object.values(prev.bosses)) {
    if (e.source === "user") fresh.bosses[e.data.id] = e;
  }
  fresh.decks = { ...prev.decks };
  return fresh;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
