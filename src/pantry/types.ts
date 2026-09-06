import type { StoreSection } from '@/recipes/types';

export type PantryStatus = 'plenty' | 'low' | 'out';

export type PantryItem = {
  id: string;
  canonical_name: string;
  display_name: string;
  status: PantryStatus;
  quantity: number | null;
  unit: string | null;
  store_section: StoreSection;
  updated_at: string;
};

export type PantryUpsert = {
  canonical_name: string;
  display_name?: string;
  status?: PantryStatus;
  quantity?: number | null;
  unit?: string | null;
  store_section?: StoreSection;
};

export const STATUS_LABEL: Record<PantryStatus, string> = { plenty: 'Plenty', low: 'Low', out: 'Out' };
