// Rarity-weighted distinct-pick loop, shared by the card-reward and artifact
// pools (CH-029). Both pools bias toward commons with a long tail of uncommons
// and a small rare chance, and both pick distinct entries by `id`.

/** Roll below this → draw from the rare pool (if non-empty). */
export const RARE_THRESHOLD = 0.05;
/** Roll below this (and ≥ RARE_THRESHOLD) → draw from the uncommon pool. */
export const UNCOMMON_THRESHOLD = 0.3;

/**
 * Pick `count` distinct entries weighted by rarity: ~5% rare, ~25% uncommon,
 * ~70% common. Distinctness is tracked by `id`. When the rolled rarity is
 * exhausted, falls back to whatever distinct entries remain across all pools.
 * Never returns more than the total pool size.
 *
 * The pools are passed pre-filtered (callers apply their own exclusions before
 * splitting by rarity), so the RNG call sequence is identical to the previous
 * inline copies.
 */
export function pickRandomByRarity<T extends { id: string }>(
  pools: { commons: T[]; uncommons: T[]; rares: T[] },
  count: number,
  rng: () => number,
): T[] {
  const { commons, uncommons, rares } = pools;
  const out: T[] = [];
  const used = new Set<string>();
  // Defensive: guard against asking for more entries than the pool can provide.
  const cap = Math.min(count, commons.length + uncommons.length + rares.length);
  while (out.length < cap) {
    const r = rng();
    let pool: T[];
    if (r < RARE_THRESHOLD && rares.length > 0) pool = rares;
    else if (r < UNCOMMON_THRESHOLD && uncommons.length > 0) pool = uncommons;
    else pool = commons;
    const candidates = pool.filter((c) => !used.has(c.id));
    if (candidates.length === 0) {
      // Pool exhausted at this rarity — fall back to whatever's left.
      const all = [...commons, ...uncommons, ...rares].filter((c) => !used.has(c.id));
      if (all.length === 0) break;
      const pick = all[Math.floor(rng() * all.length)];
      out.push(pick);
      used.add(pick.id);
      continue;
    }
    const pick = candidates[Math.floor(rng() * candidates.length)];
    out.push(pick);
    used.add(pick.id);
  }
  return out;
}
