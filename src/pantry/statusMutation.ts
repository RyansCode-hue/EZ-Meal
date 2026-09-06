import { supabase } from '@/lib/supabase';
import type { PantryUpsert } from './types';

export const PANTRY_UPSERT_KEY = ['pantry', 'upsert'] as const;

// Registered as a mutation default so a status tap made offline resumes after a restart.
export async function upsertPantryFn(items: PantryUpsert[]) {
  const { data, error } = await supabase.rpc('upsert_pantry_items', { p_items: items });
  if (error) throw error;
  return data;
}
