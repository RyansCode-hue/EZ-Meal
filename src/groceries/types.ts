import type { StoreSection } from '@/recipes/types';

export type GroceryItem = {
  id: string;
  name: string;
  canonical_name: string;
  quantity: number | null;
  unit: string | null;
  store_section: StoreSection;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  is_manual: boolean;
  source_entry_ids: string[];
  note: string | null;
};

/** Store walk order: produce first, frozen and household last. */
export const SECTION_ORDER: StoreSection[] = [
  'produce',
  'meat_seafood',
  'dairy_eggs',
  'bakery',
  'pantry',
  'canned_jarred',
  'spices',
  'beverages',
  'frozen',
  'household',
  'other',
];

export function displayName(item: GroceryItem): string {
  const n = item.name.trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}
