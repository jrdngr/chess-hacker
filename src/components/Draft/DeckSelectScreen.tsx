// Deck-select screen for the pre-game draft flow.
//
// Shows the three pre-made themed decks (loaded from
// `src/game/cards/decks/named/*.json` via `getNamedDecks`) plus a fourth
// "Draft new deck" action. Each pre-made row has a "View cards" button on
// the right that opens the existing CardListModal so the player can inspect
// the deck contents before committing.
//
// Picking a pre-made deck calls `onPickPremade(cards, artifactId)`. Picking
// the draft action calls `onStartDraft()` and the parent transitions into
// the card-draft picker.

import { useMemo, useState } from "react";

import type { Card } from "../../game/types";
import { getNamedDecks, type NamedDeck } from "../../game/cards/library";
import { getArtifactById } from "../../game/artifacts/library";
import { CardListModal } from "../Hand/CardListModal";

import styles from "./Draft.module.css";

type Props = {
  onPickPremade: (deck: Card[], artifactIds: string[]) => void;
  onStartDraft: () => void;
};

function describeRarities(cards: Card[]): string {
  let c = 0;
  let u = 0;
  let r = 0;
  for (const card of cards) {
    if (card.rarity === "common") c++;
    else if (card.rarity === "uncommon") u++;
    else if (card.rarity === "rare") r++;
  }
  return `${c}C / ${u}U / ${r}R`;
}

function bundledArtifactName(deck: NamedDeck): string | null {
  if (!deck.artifactId) return null;
  try {
    return getArtifactById(deck.artifactId).name;
  } catch {
    return null;
  }
}

export function DeckSelectScreen({ onPickPremade, onStartDraft }: Props) {
  const decks = useMemo(() => getNamedDecks(), []);
  const [previewing, setPreviewing] = useState<NamedDeck | null>(null);

  return (
    <div className={styles.flow}>
      <h2 className={styles.title}>Draft Deck</h2>
      <p className={styles.subtitle}>Pick a curated deck or draft your own</p>
      <div className={styles.deckList}>
        <div className={styles.deckRow}>
          <button
            type="button"
            className={`${styles.deckButton} ${styles.draftButton}`}
            onClick={onStartDraft}
          >
            <span className={styles.deckLabel}>Draft new deck</span>
            <span className={styles.deckDesc}>
              Pick 1 of 3 cards over 10 rounds (6 commons, 3 uncommons, 1 rare), then pick 1 of 3
              uncommon artifacts.
            </span>
          </button>
        </div>
        {decks.map((deck) => {
          const artifactName = bundledArtifactName(deck);
          return (
            <div className={styles.deckRow} key={deck.name}>
              <button
                type="button"
                className={styles.deckButton}
                onClick={() => onPickPremade(deck.cards, deck.artifactId ? [deck.artifactId] : [])}
              >
                <span className={styles.deckLabel}>{deck.name}</span>
                {deck.description && <span className={styles.deckDesc}>{deck.description}</span>}
                <span className={styles.deckMeta}>
                  {deck.cards.length} cards · {describeRarities(deck.cards)}
                  {artifactName && <> · Artifact: {artifactName}</>}
                </span>
              </button>
              <button
                type="button"
                className={styles.viewButton}
                onClick={() => setPreviewing(deck)}
                aria-label={`View cards in ${deck.name}`}
              >
                View cards
              </button>
            </div>
          );
        })}
      </div>

      {previewing && (
        <CardListModal
          title={previewing.name}
          hint={previewing.description}
          cards={previewing.cards}
          footer={
            <button type="button" className={styles.cancel} onClick={() => setPreviewing(null)}>
              Close
            </button>
          }
        />
      )}
    </div>
  );
}
