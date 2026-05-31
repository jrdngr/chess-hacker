import { describe, expect, it } from "vitest";

import { INTEREST_CAP } from "./shop";
import { STANDARD_RUN_CONFIG, WIN_BONUS_BOSS, WIN_BONUS_NORMAL } from "../progression/run";

/**
 * CH-036 guardrail: the shop is the only card source, so a player must be able
 * to add a meaningful number of cards across a run on realistic income. The
 * design target (docs/design/economy.md) is ~8-12 cards acquired per run.
 *
 * This is a deterministic floor check over the exported tuning constants — not
 * a full match simulation. It uses only *guaranteed* income (every match won,
 * no performance feats, no interest) and a deliberately generous reserve for
 * non-card spending, then asserts the remainder still clears the 8-card floor
 * at the worst-case common price. Feat gold and interest are pure upside on
 * top of this.
 */
describe("economy balance (CH-036)", () => {
  const { actCount, matchesPerAct } = STANDARD_RUN_CONFIG;
  const totalMatches = actCount * matchesPerAct; // 9
  const bossMatches = actCount; // one boss per act → 3
  const normalMatches = totalMatches - bossMatches; // 6
  const shops = totalMatches - 1; // no shop after the final match → 8

  // Guaranteed gold from winning every match, with zero performance feats.
  const guaranteedWinIncome = normalMatches * WIN_BONUS_NORMAL + bossMatches * WIN_BONUS_BOSS;

  // priceForCard: common = base 4 + (0..2) → worst case 6 gold per common.
  const WORST_COMMON_PRICE = 6;
  // Generous reserve for everything that isn't a card: ~1 artifact per act plus
  // a handful of rerolls / a removal. If cards still clear the floor after this,
  // the economy isn't card-starved.
  const NON_CARD_RESERVE = 70;

  const CARD_FLOOR = 8;

  it("guaranteed win income affords at least the ~8-card floor after non-card spending", () => {
    const cardBudget = guaranteedWinIncome - NON_CARD_RESERVE;
    const affordableCards = Math.floor(cardBudget / WORST_COMMON_PRICE);
    expect(affordableCards).toBeGreaterThanOrEqual(CARD_FLOOR);
  });

  it("interest is not large enough to force hoarding over buying cards", () => {
    // Max interest a hoarder could earn all run is a minority of win income,
    // so saving for interest never out-paces simply spending on cards.
    const maxTotalInterest = shops * INTEREST_CAP;
    expect(maxTotalInterest).toBeLessThan(guaranteedWinIncome / 2);
  });
});
