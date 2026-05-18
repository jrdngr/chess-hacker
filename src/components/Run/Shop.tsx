// Shop UI: rotating offers (cards + booster packs + artifacts), reroll, card
// removal.
//
// The shop is data-driven from the run's seeded RNG — see game/shop/shop.ts.

import { useState } from "react";

import { CardListModal } from "../Hand/CardListModal";
import { CardKeywords } from "../Hand/CardKeywords";
import { PackPicker } from "./PackPicker";
import {
  addPickedPackCard,
  buyArtifactOffer,
  buyCardOffer,
  openBoosterOffer,
  removeCard,
  rerollShop,
  upgradeDeckCard,
} from "../../game/shop/shop";
import { getUpgradedCard, isUpgraded } from "../../game/cards/library";
import { ARTIFACT_SLOT_CAP } from "../../game/types";
import type {
  Artifact,
  BoosterPack,
  Card,
  RunState,
  Shop as ShopState,
  ShopOffer,
} from "../../game/types";

import styles from "./Shop.module.css";
import cardListStyles from "../Hand/CardListModal.module.css";

/**
 * Structured description of a shop action — fed to `onAction` so the run
 * log can record what the player did with enough detail to reproduce the
 * state change. Fires after the action resolves; the corresponding state
 * update flows through `onUpdate` as usual.
 */
export type ShopAction =
  | { kind: "buy-card"; offerIndex: number; card: Card; pricePaid: number }
  | {
      kind: "open-pack";
      offerIndex: number;
      pack: BoosterPack;
      pricePaid: number;
    }
  | { kind: "pick-pack-card"; card: Card }
  | {
      kind: "buy-artifact";
      offerIndex: number;
      artifact: Artifact;
      pricePaid: number;
    }
  | { kind: "reroll"; cost: number; newOffers: ReadonlyArray<ShopOffer> }
  | { kind: "remove-card"; deckIndex: number; card: Card; pricePaid: number }
  | {
      kind: "smith-card";
      deckIndex: number;
      fromCard: Card;
      toCard: Card;
      pricePaid: number;
    };

type Props = {
  run: RunState;
  shop: ShopState;
  onUpdate: (next: { state: RunState; shop: ShopState }) => void;
  onLeave: () => void;
  /**
   * Optional: receives a structured action description after each shop
   * interaction resolves. Used by the run shell to feed its log; ignored
   * by tests that don't care about telemetry.
   */
  onAction?: (action: ShopAction) => void;
};

export function Shop({ run, shop, onUpdate, onLeave, onAction }: Props) {
  // Pack-pick modal state — non-null means a pack is open and the player is
  // about to pick 1 card from `pack.contents`.
  const [openedPack, setOpenedPack] = useState<BoosterPack | null>(null);
  // Removal-mode toggle — swaps the deck list into a "click to remove" layout.
  const [removalMode, setRemovalMode] = useState(false);
  // Smith-mode toggle — swaps the deck list into a "click to upgrade" layout.
  const [smithMode, setSmithMode] = useState(false);

  const onBuyCard = (index: number) => {
    const offer = shop.offers[index];
    const next = buyCardOffer(run, shop, index);
    if (next) {
      onUpdate(next);
      if (offer && offer.kind === "card") {
        onAction?.({
          kind: "buy-card",
          offerIndex: index,
          card: offer.card,
          pricePaid: offer.price,
        });
      }
    }
  };

  const onBuyArtifact = (index: number) => {
    const offer = shop.offers[index];
    const next = buyArtifactOffer(run, shop, index);
    if (next) {
      onUpdate(next);
      if (offer && offer.kind === "artifact") {
        onAction?.({
          kind: "buy-artifact",
          offerIndex: index,
          artifact: offer.artifact,
          pricePaid: offer.price,
        });
      }
    }
  };

  const atArtifactCap = run.artifacts.length >= ARTIFACT_SLOT_CAP;

  const onOpenPack = (index: number) => {
    const offer = shop.offers[index];
    const next = openBoosterOffer(run, shop, index);
    if (!next) return;
    onUpdate({ state: next.state, shop: next.shop });
    setOpenedPack(next.pack);
    if (offer && offer.kind === "booster") {
      onAction?.({
        kind: "open-pack",
        offerIndex: index,
        pack: next.pack,
        pricePaid: offer.price,
      });
    }
  };

  const onPickPackCard = (card: Card) => {
    onUpdate({ state: addPickedPackCard(run, card), shop });
    setOpenedPack(null);
    onAction?.({ kind: "pick-pack-card", card });
  };

  const onReroll = () => {
    const cost = shop.rerollCost;
    const next = rerollShop(run, shop);
    if (next) {
      onUpdate(next);
      onAction?.({ kind: "reroll", cost, newOffers: next.shop.offers });
    }
  };

  const onRemoveDeckCard = (index: number) => {
    const card = run.deck[index];
    const cost = shop.removalCost;
    const next = removeCard(run, shop, index);
    if (next) {
      onUpdate(next);
      setRemovalMode(false);
      if (card) {
        onAction?.({
          kind: "remove-card",
          deckIndex: index,
          card,
          pricePaid: cost,
        });
      }
    }
  };

  const onSmithDeckCard = (index: number) => {
    const card = run.deck[index];
    const cost = shop.smithCost;
    const upgraded = card ? getUpgradedCard(card) : null;
    const next = upgradeDeckCard(run, shop, index);
    if (next) {
      onUpdate(next);
      setSmithMode(false);
      if (card && upgraded) {
        onAction?.({
          kind: "smith-card",
          deckIndex: index,
          fromCard: card,
          toCard: upgraded,
          pricePaid: cost,
        });
      }
    }
  };

  const canReroll = run.gold >= shop.rerollCost;
  const canRemove = run.gold >= shop.removalCost && run.deck.length > 0;
  const hasUpgradableCard = run.deck.some((c) => !isUpgraded(c));
  const canSmith = run.gold >= shop.smithCost && hasUpgradableCard;

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
                <CardKeywords card={offer.card} />
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
                    : `Open ${offer.pack.name} for ${offer.price} gold. Contents are revealed after purchase — pick 1 of ${offer.pack.contents.length}.`
                }
              >
                <span className={styles.packBadge}>Pack</span>
                <span className={styles.name}>{offer.pack.name}</span>
                <span className={styles.archetype}>Pick 1 of {offer.pack.contents.length}</span>
                <span className={styles.description}>Contents revealed on purchase.</span>
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
        <button
          type="button"
          className={styles.serviceButton}
          onClick={() => setSmithMode((v) => !v)}
          disabled={!smithMode && !canSmith}
        >
          {smithMode
            ? "Cancel upgrade"
            : !hasUpgradableCard
              ? "All cards upgraded"
              : `Upgrade a card · ${shop.smithCost}g`}
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

      {smithMode && (
        <CardListModal
          title="Upgrade a card in your deck"
          hint={`Each upgrade costs ${shop.smithCost} gold. Future upgrades get more expensive.`}
          cards={run.deck}
          renderControls={(card, i) => {
            if (isUpgraded(card)) {
              return <span className={styles.upgradedBadge}>Upgraded</span>;
            }
            const upgraded = getUpgradedCard(card);
            return (
              <>
                {upgraded && (
                  <span className={styles.smithPreview}>
                    <span className={styles.smithPreviewArrow}>→</span>
                    <span className={styles.smithPreviewCost}>{upgraded.cost}</span>
                    <span className={styles.smithPreviewDescription}>{upgraded.description}</span>
                  </span>
                )}
                <button
                  type="button"
                  className={cardListStyles.confirmButton}
                  onClick={() => onSmithDeckCard(i)}
                  disabled={run.gold < shop.smithCost || !upgraded}
                >
                  Upgrade
                </button>
              </>
            );
          }}
          footer={
            <button
              type="button"
              className={cardListStyles.confirmButton}
              onClick={() => setSmithMode(false)}
            >
              Cancel
            </button>
          }
        />
      )}

      {openedPack && <PackPicker pack={openedPack} onConfirm={onPickPackCard} />}

      <div className={styles.footer}>
        <button type="button" className={styles.continueButton} onClick={onLeave}>
          Continue
        </button>
      </div>
    </div>
  );
}
