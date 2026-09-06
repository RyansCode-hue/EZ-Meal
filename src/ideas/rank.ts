export type RankableRecipe = { id: string; title: string; last_cooked_at: string | null; recipe_ingredients: Array<{ canonical_name: string }> };
export type PantryLike = { canonical_name: string; status: 'plenty' | 'low' | 'out' };
export type PantryMatch = { id: string; title: string; have: number; total: number; missing: string[]; lastCookedAt: string | null };

/** Recipes ranked by the share of ingredients on hand. Plenty and Low count; Out does not. */
export function rankByPantry(recipes: RankableRecipe[], pantry: PantryLike[]): PantryMatch[] {
  const onHand = new Set(pantry.filter((p) => p.status !== 'out').map((p) => p.canonical_name));
  return recipes
    .filter((r) => r.recipe_ingredients.length > 0)
    .map((r) => {
      const names = [...new Set(r.recipe_ingredients.map((i) => i.canonical_name))];
      const missing = names.filter((n) => !onHand.has(n));
      return { id: r.id, title: r.title, have: names.length - missing.length, total: names.length, missing, lastCookedAt: r.last_cooked_at };
    })
    .sort((a, b) => b.have / b.total - a.have / a.total || b.have - a.have || a.title.localeCompare(b.title));
}

/** A random recipe, preferring ones not cooked in the last `recentDays`, never repeating `avoidId` when there is a choice. */
export function pickSurprise<T extends { id: string; last_cooked_at: string | null }>(recipes: T[], avoidId: string | null, recentDays: number, now = Date.now(), random = Math.random): T | null {
  if (!recipes.length) return null;
  const cutoff = now - recentDays * 24 * 60 * 60 * 1000;
  const fresh = recipes.filter((r) => !r.last_cooked_at || new Date(r.last_cooked_at).getTime() < cutoff);
  let pool = (fresh.length ? fresh : recipes).filter((r) => r.id !== avoidId);
  if (!pool.length) pool = recipes;
  return pool[Math.floor(random() * pool.length)];
}
