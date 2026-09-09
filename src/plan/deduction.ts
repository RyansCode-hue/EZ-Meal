import { normalizeUnit } from '@/groceries/units';
import type { PantryItem } from '@/pantry/types';

type Ingredient = { canonical_name: string; quantity: number | null; unit: string | null };

/**
 * What marking an entry cooked will take from a tracked item, matching the
 * database rule: both sides carry an amount in the same normalized unit.
 * Returns null when nothing will be subtracted.
 */
export function plannedDeduction(ing: Ingredient, item: PantryItem | undefined, factor: number): { take: number; left: number } | null {
  if (!item || ing.quantity == null || item.quantity == null) return null;
  if ((normalizeUnit(ing.unit) ?? '') !== (normalizeUnit(item.unit) ?? '')) return null;
  const take = Math.min(item.quantity, ing.quantity * factor);
  if (take <= 0) return null;
  return { take, left: item.quantity - take };
}

export function servingsFactor(entryServings: number | null, recipeServings: number | null): number {
  return entryServings != null && recipeServings != null && recipeServings > 0 ? entryServings / recipeServings : 1;
}
