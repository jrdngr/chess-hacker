// Shop generation, reroll / removal scaling, buy / interest logic.
//
// Pure helpers — the Run shell holds the live `Shop` and feeds it through
// these functions. Tuning knobs live at the top so balance changes are local.

import { CARD_LIBRARY, getUpgradedCard, isUpgraded } from "../cards/library";
import { type Rng } from "../cards/match";
import { pickRandomArtifacts } from "../artifacts/library";
import { consumeRng, pickRandomCards, eligibleCardsByRarity } from "../progression/run";
import { ARTIFACT_SLOT_CAP } from "../types";
import type { Artifact, BoosterPack, Card, RunState, Shop, ShopOffer } from "../types";

// ---- Tuning knobs (see docs/design/economy.md) -----------------------------

/** Number of single-card offers per shop visit. */
export const SHOP_CARDS = 4;
/** Number of booster packs per shop visit. */
export const SHOP_PACKS = 2;
/** Number of artifact offers per shop visit. */
export const SHOP_ARTIFACTS = 1;
/** Cards revealed inside a common booster pack — player picks 1. */
export const PACK_CARD_COUNT = 3;
/** Common pack price — fixed so the pack is always a known, cheap commitment. */
export const COMMON_PACK_PRICE = 5;

/** Reroll cost: starts at base, +step per reroll already used this shop. */
export const REROLL_COST_BASE = 5;
export const REROLL_COST_STEP = 1;

/** Removal cost: starts at base, +step per removal already used this run. */
export const REMOVAL_COST_BASE = 50;
export const REMOVAL_COST_STEP = 25;

/** Smith (card upgrade) cost: starts at base, +step per Smith already used this run. */
export const SMITH_COST_BASE = 50;
export const SMITH_COST_STEP = 25;

/** Interest at shop close: +1 per `INTEREST_PER` saved gold, capped. */
export const INTEREST_PER = 5;
export const INTEREST_CAP = 5;

// ---- Pricing ---------------------------------------------------------------

/** Card price by rarity — spread per docs/design/economy.md (~5–15 gold). */
function priceForCard(card: Card, rng: Rng): number {
  const base = card.rarity === "rare" ? 13 : card.rarity === "uncommon" ? 8 : 5;
  // ±1 randomness so two-of-a-rarity in the same shop don't tie exactly.
  return base + Math.floor(rng() * 3);
}

/** Artifact price by rarity — artifacts are pricier than single cards. */
function priceForArtifact(artifact: Artifact, rng: Rng): number {
  const base = artifact.rarity === "rare" ? 25 : artifact.rarity === "uncommon" ? 18 : 12;
  return base + Math.floor(rng() * 4);
}

export function rerollCostFor(rerollsUsed: number): number {
  return REROLL_COST_BASE + REROLL_COST_STEP * rerollsUsed;
}

export function removalCostFor(removalsUsed: number): number {
  return REMOVAL_COST_BASE + REMOVAL_COST_STEP * removalsUsed;
}

export function smithCostFor(smithUsed: number): number {
  return SMITH_COST_BASE + SMITH_COST_STEP * smithUsed;
}

// ---- Generation ------------------------------------------------------------

/**
 * Build the offer list for a shop visit (or reroll). Artifacts already in
 * the player's collection are excluded from the artifact pool so the same
 * rare can't be "offered" repeatedly when they already own it.
 */
function buildOffers(state: RunState, rng: Rng): ShopOffer[] {
  const offers: ShopOffer[] = [];

  const cards = pickRandomCards(SHOP_CARDS, rng);
  for (const card of cards) {
    offers.push({ kind: "card", card, price: priceForCard(card, rng) });
  }

  for (let i = 0; i < SHOP_PACKS; i++) {
    const pack = generateCommonPack(rng, i);
    offers.push({ kind: "booster", pack, price: COMMON_PACK_PRICE });
  }

  const ownedIds = new Set(state.artifacts.map((a) => a.id));
  const artifacts = pickRandomArtifacts(SHOP_ARTIFACTS, rng, ownedIds);
  for (const artifact of artifacts) {
    offers.push({ kind: "artifact", artifact, price: priceForArtifact(artifact, rng) });
  }

  return offers;
}

/**
 * Build a fresh shop. Pulls from the run's seeded RNG so two playthroughs
 * with the same seed see the same shops. Mutates run state by advancing
 * `rngCursor` (returned alongside the shop).
 */
export function generateShop(state: RunState): { shop: Shop; next: RunState } {
  const { rng, next } = consumeRng(state);
  return {
    shop: {
      offers: buildOffers(state, rng),
      rerollCost: rerollCostFor(0),
      rerollsUsed: 0,
      removalCost: removalCostFor(state.removalsUsed),
      smithCost: smithCostFor(state.smithUsed),
    },
    next,
  };
}

function generateCommonPack(rng: Rng, slot: number): BoosterPack {
  // Common pack: PACK_CARD_COUNT distinct commons drawn from the full common
  // pool. We sample without replacement so a pack never shows the same card
  // twice. If the pool is smaller than PACK_CARD_COUNT (shouldn't happen in
  // practice), the cap below shrinks the pack rather than looping forever.
  const commons = eligibleCardsByRarity("common").slice();
  const cap = Math.min(PACK_CARD_COUNT, commons.length);
  const cards: Card[] = [];
  for (let i = 0; i < cap; i++) {
    const idx = Math.floor(rng() * commons.length);
    cards.push(commons[idx]);
    commons.splice(idx, 1);
  }
  return {
    id: `common-pack-${slot}`,
    name: "Common Pack",
    contents: cards,
  };
}

// ---- Reroll ----------------------------------------------------------------

/** Pay for a reroll: regenerate offers, bump per-shop reroll count. */
export function rerollShop(state: RunState, shop: Shop): { state: RunState; shop: Shop } | null {
  if (state.gold < shop.rerollCost) return null;
  const { rng, next } = consumeRng(state);
  const rerollsUsed = shop.rerollsUsed + 1;
  return {
    state: { ...next, gold: next.gold - shop.rerollCost },
    shop: {
      ...shop,
      offers: buildOffers(state, rng),
      rerollsUsed,
      rerollCost: rerollCostFor(rerollsUsed),
    },
  };
}

// ---- Buy -------------------------------------------------------------------

/**
 * Buy a single-card offer at `index`. Returns null if the offer is sold,
 * not a card, or the player can't afford it. The bought card lands in
 * `state.deck` immediately (it's available for the next match's draw).
 */
export function buyCardOffer(
  state: RunState,
  shop: Shop,
  index: number,
): { state: RunState; shop: Shop } | null {
  const offer = shop.offers[index];
  if (!offer || offer.kind !== "card" || offer.sold) return null;
  if (state.gold < offer.price) return null;
  const offers = shop.offers.slice();
  offers[index] = { ...offer, sold: true };
  return {
    state: { ...state, gold: state.gold - offer.price, deck: [...state.deck, offer.card] },
    shop: { ...shop, offers },
  };
}

/**
 * Open a booster pack: pay its price and return the contents. The Run
 * shell shows a 1-of-N picker against the contents and resolves with
 * `addPickedPackCard` once the player chooses.
 *
 * Two-step intentionally: we mark the pack `sold` here so the player can't
 * leave the picker, dodge the spend, and reopen.
 */
export function openBoosterOffer(
  state: RunState,
  shop: Shop,
  index: number,
): { state: RunState; shop: Shop; pack: BoosterPack } | null {
  const offer = shop.offers[index];
  if (!offer || offer.kind !== "booster" || offer.sold) return null;
  if (state.gold < offer.price) return null;
  const offers = shop.offers.slice();
  offers[index] = { ...offer, sold: true };
  return {
    state: { ...state, gold: state.gold - offer.price },
    shop: { ...shop, offers },
    pack: offer.pack,
  };
}

/** Apply the player's pick from a previously-opened booster pack. */
export function addPickedPackCard(state: RunState, card: Card): RunState {
  // Defensive lookup against the library so the run's deck always references
  // a known card (a Card stored verbatim is fine, but a stale id would not be).
  const known = CARD_LIBRARY[card.id];
  return { ...state, deck: [...state.deck, known ?? card] };
}

// ---- Artifact buy ----------------------------------------------------------

/**
 * Buy an artifact offer at `index`. Returns null if the offer is sold, not
 * an artifact, the player can't afford it, or the player already owns it.
 *
 * Slot cap (`ARTIFACT_SLOT_CAP`): if buying would exceed the cap, the call
 * is also rejected. The displacement-modal flow described in
 * `docs/design/artifacts.md` is M11 polish — for the prototype the buy
 * button simply disables once the player is at cap.
 */
export function buyArtifactOffer(
  state: RunState,
  shop: Shop,
  index: number,
): { state: RunState; shop: Shop } | null {
  const offer = shop.offers[index];
  if (!offer || offer.kind !== "artifact" || offer.sold) return null;
  if (state.gold < offer.price) return null;
  if (state.artifacts.length >= ARTIFACT_SLOT_CAP) return null;
  if (state.artifacts.some((a) => a.id === offer.artifact.id)) return null;
  const offers = shop.offers.slice();
  offers[index] = { ...offer, sold: true };
  return {
    state: {
      ...state,
      gold: state.gold - offer.price,
      artifacts: [...state.artifacts, offer.artifact],
    },
    shop: { ...shop, offers },
  };
}

// ---- Card removal ----------------------------------------------------------

/**
 * Remove the card at `deckIndex`. Charges the per-removal cost and bumps
 * `state.removalsUsed`, which feeds the next removal price. The shop's own
 * `removalCost` is also bumped so the UI shows the new price immediately.
 */
export function removeCard(
  state: RunState,
  shop: Shop,
  deckIndex: number,
): { state: RunState; shop: Shop } | null {
  if (deckIndex < 0 || deckIndex >= state.deck.length) return null;
  if (state.gold < shop.removalCost) return null;
  const cost = shop.removalCost;
  const removalsUsed = state.removalsUsed + 1;
  const deck = state.deck.slice();
  deck.splice(deckIndex, 1);
  return {
    state: { ...state, gold: state.gold - cost, deck, removalsUsed },
    shop: { ...shop, removalCost: removalCostFor(removalsUsed) },
  };
}

// ---- Card upgrade (Smith) --------------------------------------------------

/**
 * Upgrade the card at `deckIndex` in the player's run deck to its `+` variant.
 * Charges the per-Smith cost and bumps `state.smithUsed`, which feeds the next
 * upgrade price. The shop's own `smithCost` is also bumped so the UI shows the
 * new price immediately. Returns null when:
 *  - `deckIndex` is out of range,
 *  - the player can't afford the current `smithCost`,
 *  - the targeted card is already upgraded (its id already ends in `+`),
 *  - the card has no registered upgrade (defensive — every base card defines
 *    one, but if a future authoring bug breaks this, we fail gracefully).
 *
 * Only the deck slot at `deckIndex` is swapped — other slots referencing the
 * same base card are untouched, so "two copies, upgrade one" works correctly.
 */
export function upgradeDeckCard(
  state: RunState,
  shop: Shop,
  deckIndex: number,
): { state: RunState; shop: Shop } | null {
  if (deckIndex < 0 || deckIndex >= state.deck.length) return null;
  if (state.gold < shop.smithCost) return null;
  const base = state.deck[deckIndex];
  if (isUpgraded(base)) return null;
  const upgraded = getUpgradedCard(base);
  if (!upgraded) return null;
  const cost = shop.smithCost;
  const smithUsed = state.smithUsed + 1;
  const deck = state.deck.slice();
  deck[deckIndex] = upgraded;
  return {
    state: { ...state, gold: state.gold - cost, deck, smithUsed },
    shop: { ...shop, smithCost: smithCostFor(smithUsed) },
  };
}

// ---- Interest --------------------------------------------------------------

/** +1 per `INTEREST_PER` gold saved, capped at `INTEREST_CAP`. */
export function interestFor(gold: number): number {
  return Math.min(INTEREST_CAP, Math.floor(Math.max(0, gold) / INTEREST_PER));
}

/** Apply the interest tally as the player leaves the shop. */
export function applyInterest(state: RunState): { state: RunState; interest: number } {
  const interest = interestFor(state.gold);
  return { state: { ...state, gold: state.gold + interest }, interest };
}
