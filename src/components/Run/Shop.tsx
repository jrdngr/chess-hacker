// Shop UI: rotating offers (cards + booster packs + artifacts), reroll, card
// removal.
//
// The shop is data-driven from the run's seeded RNG — see game/shop/shop.ts.

import { useState } from "react";

import { CardListModal } from "../Hand/CardListModal";
import {
  addPickedPackCard,
  buyArtifactOffer,
  buyCardOffer,
  openBoosterOffer,
  removeCard,
  rerollShop,
} from "../../game/shop/shop";
import { ARTIFACT_SLOT_CAP } from "../../game/types";
import type { BoosterPack, Card, RunState, Shop as ShopState } from "../../game/types";

import styles from "./Shop.module.css";
import cardListStyles from "../Hand/CardListModal.module.css";

type Props = {
  run: RunState;
  shop: ShopState;
  onUpdate: (next: { state: RunState; shop: ShopState }) => void;
  onLeave: () => void;
};

export function Shop({ run, shop, onUpdate, onLeave }: Props) {
  // Pack-pick modal state — non-null means a pack is open and the player is
  // about to pick 1 card from `pack.contents`.
  const [openedPack, setOpenedPack] = useState<BoosterPack | null>(null);
  // Removal-mode toggle — swaps the deck list into a "click to remove" layout.
  const [removalMode, setRemovalMode] = useState(false);

  const onBuyCard = (index: number) => {
    const next = buyCardOffer(run, shop, index);
    if (next) onUpdate(next);
  };

  const onBuyArtifact = (index: number) => {
    const next = buyArtifactOffer(run, shop, index);
    if (next) onUpdate(next);
  };

  const atArtifactCap = run.artifacts.length >= ARTIFACT_SLOT_CAP;

  const onOpenPack = (index: number) => {
    const next = openBoosterOffer(run, shop, index);
    if (!next) return;
    onUpdate({ state: next.state, shop: next.shop });
    setOpenedPack(next.pack);
  };

  const onPickPackCard = (card: Card) => {
    onUpdate({ state: addPickedPackCard(run, card), shop });
    setOpenedPack(null);
  };

  const onReroll = () => {
    const next = rerollShop(run, shop);
    if (next) onUpdate(next);
  };

  const onRemoveDeckCard = (index: number) => {
    const next = removeCard(run, shop, index);
    if (next) {
      onUpdate(next);
      setRemovalMode(false);
    }
  };

  const canReroll = run.gold >= shop.rerollCost;
  const canRemove = run.gold >= shop.removalCost && run.deck.length > 0;

  return (
    <div className={styles.shop}>
      <header className={styles.header}>
        <h2 className={styles.title}>Shop</h2>
        <div className={styles.headerStats}>
          <span className={styles.gold} aria-label={`Gold: ${run.gold}`}>
            <span className={styles.goldValue}>{run.gold}</span>
            <span className={styles.goldLabel}>gold</span>
          </span>
        </div>
      </header>

      <ul className={styles.offers} aria-label="Shop offers">
        {shop.offers.map((offer, i) => (
          <li key={i} className={styles.offerRow}>
            {offer.kind === "card" && (
              <button
                type="button"
                className={styles.offerCard}
                onClick={() => onBuyCard(i)}
                disabled={offer.sold || run.gold < offer.price}
                aria-label={
                  offer.sold
                    ? `${offer.card.name} (sold)`
                    : `Buy ${offer.card.name} for ${offer.price} gold: ${offer.card.description}`
                }
                data-card-id={offer.card.id}
              >
                <span className={styles.cost}>{offer.card.cost}</span>
                <span className={styles.name}>{offer.card.name}</span>
                <span className={styles.archetype}>
                  {offer.card.archetype} · {offer.card.rarity}
                </span>
                <span className={styles.description}>{offer.card.description}</span>
                <span className={styles.price}>{offer.sold ? "sold" : `${offer.price}g`}</span>
              </button>
            )}
            {offer.kind === "booster" && (
              <button
                type="button"
                className={styles.offerCard}
                onClick={() => onOpenPack(i)}
                disabled={offer.sold || run.gold < offer.price}
                aria-label={
                  offer.sold
                    ? `${offer.pack.name} (opened)`
                    : `Open ${offer.pack.name} for ${offer.price} gold`
                }
              >
                <span className={styles.packBadge}>Pack</span>
                <span className={styles.name}>{offer.pack.name}</span>
                <span className={styles.archetype}>Pick 1 of {offer.pack.contents.length}</span>
                <span className={styles.description}>
                  {offer.pack.contents.map((c) => c.name).join(", ")}
                </span>
                <span className={styles.price}>{offer.sold ? "opened" : `${offer.price}g`}</span>
              </button>
            )}
            {offer.kind === "artifact" && (
              <button
                type="button"
                className={styles.offerCard}
                onClick={() => onBuyArtifact(i)}
                disabled={offer.sold || run.gold < offer.price || atArtifactCap}
                aria-label={
                  offer.sold
                    ? `${offer.artifact.name} (sold)`
                    : atArtifactCap
                      ? `${offer.artifact.name} — artifact slots full`
                      : `Buy artifact ${offer.artifact.name} for ${offer.price} gold: ${offer.artifact.description}`
                }
                data-artifact-id={offer.artifact.id}
              >
                <span className={styles.packBadge}>Artifact</span>
                <span className={styles.name}>{offer.artifact.name}</span>
                <span className={styles.archetype}>{offer.artifact.rarity}</span>
                <span className={styles.description}>{offer.artifact.description}</span>
                <span className={styles.price}>
                  {offer.sold ? "sold" : atArtifactCap ? "full" : `${offer.price}g`}
                </span>
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.services}>
        <button
          type="button"
          className={styles.serviceButton}
          onClick={onReroll}
          disabled={!canReroll}
        >
          Reroll · {shop.rerollCost}g
        </button>
        <button
          type="button"
          className={styles.serviceButton}
          onClick={() => setRemovalMode((v) => !v)}
          disabled={!removalMode && !canRemove}
        >
          {removalMode ? "Cancel removal" : `Remove a card · ${shop.removalCost}g`}
        </button>
      </div>

      {removalMode && (
        <CardListModal
          title="Remove a card from your deck"
          hint={`Removing one card costs ${shop.removalCost} gold. Future removals get more expensive.`}
          cards={run.deck}
          renderControls={(_card, i) => (
            <button
              type="button"
              className={cardListStyles.confirmButton}
              onClick={() => onRemoveDeckCard(i)}
              disabled={run.gold < shop.removalCost}
            >
              Remove
            </button>
          )}
          footer={
            <button
              type="button"
              className={cardListStyles.confirmButton}
              onClick={() => setRemovalMode(false)}
            >
              Cancel
            </button>
          }
        />
      )}

      {openedPack && (
        <CardListModal
          title={openedPack.name}
          hint="Pick 1 card to add to your deck."
          cards={openedPack.contents}
          renderControls={(card) => (
            <button
              type="button"
              className={cardListStyles.confirmButton}
              onClick={() => onPickPackCard(card)}
            >
              Pick
            </button>
          )}
        />
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.continueButton} onClick={onLeave}>
          Continue
        </button>
      </div>
    </div>
  );
}
