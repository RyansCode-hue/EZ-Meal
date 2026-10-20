import { convertQuantity } from '@/groceries/units';
import type { PantryItem } from '@/pantry/types';

type Ingredient = { canonical_name: string; quantity: number | null; unit: string | null };

/**
 * What marking an entry cooked will take from a tracked item, in the item's own
 * unit. Mirrors set_plan_entry_cooked(): convert into the item's unit, or else
 * into containers through the item's package size. Null when nothing is taken.
 */
export function plannedDeduction(ing: Ingredient, item: PantryItem | undefined, factor: number): { take: number; left: number } | null {
  if (!item || ing.quantity == null || item.quantity == null) return null;
  const need = ing.quantity * factor;
  let take = convertQuantity(need, ing.unit, item.unit);
  if (take == null && item.package_quantity != null && item.package_quantity > 0) {
    const inSize = convertQuantity(need, ing.unit, item.package_unit);
    take = inSize == null ? null : inSize / item.package_quantity;
  }
  if (take == null) return null;
  take = Math.min(item.quantity, take);
  if (take <= 0) return null;
  return { take, left: item.quantity - take };
}

export function servingsFactor(entryServings: number | null, recipeServings: number | null): number {
  return entryServings != null && recipeServings != null && recipeServings > 0 ? entryServings / recipeServings : 1;
}
