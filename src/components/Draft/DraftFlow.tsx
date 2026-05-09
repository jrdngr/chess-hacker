// Pre-game draft flow — orchestrates the deck-select → card draft →
// artifact draft state machine.
//
// `<App>` mounts this on the "draft" route. When the player commits
// (either by picking a pre-made deck or by completing the draft picker),
// `onComplete(deck, artifactIds)` fires and the parent flips to the run
// route, threading those values into `<Run>` via its `startingDeck` /
// `startingArtifactIds` props.
//
// The flow has three internal stages:
//   1. `deckSelect` — three pre-made decks plus a "Draft new deck" action.
//   2. `cardDraft`  — only when the player chose to draft. 10 picks of
//                     1-of-3 (6 commons → 3 uncommons → 1 rare).
//   3. `artifactDraft` — only on the draft path. 1 pick of 3 uncommons.
//
// The pre-made path skips both pickers and commits directly.

import { useState } from "react";

import type { Card } from "../../game/types";

import { ArtifactDraftPicker } from "./ArtifactDraftPicker";
import { CardDraftPicker } from "./CardDraftPicker";
import { DeckSelectScreen } from "./DeckSelectScreen";

type Stage = "deckSelect" | "cardDraft" | "artifactDraft";

type Props = {
  onComplete: (deck: Card[], artifactIds: string[]) => void;
};

export function DraftFlow({ onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("deckSelect");
  const [draftedDeck, setDraftedDeck] = useState<Card[] | null>(null);

  if (stage === "deckSelect") {
    return (
      <DeckSelectScreen
        onPickPremade={(deck, artifactIds) => onComplete(deck, artifactIds)}
        onStartDraft={() => setStage("cardDraft")}
      />
    );
  }

  if (stage === "cardDraft") {
    return (
      <CardDraftPicker
        onComplete={(deck) => {
          setDraftedDeck(deck);
          setStage("artifactDraft");
        }}
        onCancel={() => setStage("deckSelect")}
      />
    );
  }

  // artifactDraft
  return (
    <ArtifactDraftPicker
      onComplete={(artifactId) => {
        const deck = draftedDeck ?? [];
        onComplete(deck, [artifactId]);
      }}
      onCancel={() => {
        // Backtrack one stage. The drafted deck is preserved so the player
        // doesn't have to redo card picks; they just see the artifact
        // picker again on re-entry.
        setStage("cardDraft");
        setDraftedDeck(null);
      }}
    />
  );
}
