// Shop generation, reroll / removal scaling, buy / interest logic.
//
// Pure helpers — the Run shell holds the live `Shop` and feeds it through
// these functions. Tuning knobs live at the top so balance changes are local.

import { CARD_LIBRARY } from "../cards/library";
import { type Rng } from "../cards/match";
import { consumeRng, pickRandomCards, eligibleCardsByRarity } from "../progression/run";
import type { BoosterPack, Card, RunState, Shop, ShopOffer } from "../types";

// ---- Tuning knobs (see docs/design/economy.md) -----------------------------

/** Number of single-card offers per shop visit. */
export const SHOP_CARDS = 4;
/** Number of booster packs per shop visit. */
export const SHOP_PACKS = 2;
/** Cards revealed inside a common booster pack — player picks 1. */
export const PACK_CARD_COUNT = 3;

/** Reroll cost: starts at base, +step per reroll already used this shop. */
export const REROLL_COST_BASE = 5;
export const REROLL_COST_STEP = 1;

/** Removal cost: starts at base, +step per removal already used this run. */
export const REMOVAL_COST_BASE = 50;
export const REMOVAL_COST_STEP = 25;

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

/** Booster pack price — packs are cheap (~3–8 gold). */
function priceForPack(rng: Rng): number {
  return 4 + Math.floor(rng() * 4);
}

export function rerollCostFor(rerollsUsed: number): number {
  return REROLL_COST_BASE + REROLL_COST_STEP * rerollsUsed;
}

export function removalCostFor(removalsUsed: number): number {
  return REMOVAL_COST_BASE + REMOVAL_COST_STEP * removalsUsed;
}

// ---- Generation ------------------------------------------------------------

/**
 * Build a fresh shop. Pulls from the run's seeded RNG so two playthroughs
 * with the same seed see the same shops. Mutates run state by advancing
 * `rngCursor` (returned alongside the shop).
 */
export function generateShop(state: RunState): { shop: Shop; next: RunState } {
  const { rng, next } = consumeRng(state);
  const offers: ShopOffer[] = [];

  const cards = pickRandomCards(SHOP_CARDS, rng);
  for (const card of cards) {
    offers.push({ kind: "card", card, price: priceForCard(card, rng) });
  }

  for (let i = 0; i < SHOP_PACKS; i++) {
    const pack = generateCommonPack(rng, i);
    offers.push({ kind: "booster", pack, price: priceForPack(rng) });
  }

  return {
    shop: {
      offers,
      rerollCost: rerollCostFor(0),
      rerollsUsed: 0,
      removalCost: removalCostFor(state.removalsUsed),
    },
    next,
  };
}

function generateCommonPack(rng: Rng, slot: number): BoosterPack {
  // Common-flavored pack: 3 random commons. Other pack flavors land later.
  const commons = eligibleCardsByRarity("common");
  void commons; // pickRandomCards already weights toward commons.
  const cards = pickRandomCards(PACK_CARD_COUNT, rng);
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
  const offers: ShopOffer[] = [];
  const cards = pickRandomCards(SHOP_CARDS, rng);
  for (const card of cards) {
    offers.push({ kind: "card", card, price: priceForCard(card, rng) });
  }
  for (let i = 0; i < SHOP_PACKS; i++) {
    const pack = generateCommonPack(rng, i);
    offers.push({ kind: "booster", pack, price: priceForPack(rng) });
  }
  const rerollsUsed = shop.rerollsUsed + 1;
  return {
    state: { ...next, gold: next.gold - shop.rerollCost },
    shop: {
      ...shop,
      offers,
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
