import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { groceriesKey } from '@/groceries/hooks';
import type { ImageForParse } from '@/recipes/hooks';
import type { StoreSection } from '@/recipes/types';
import type { PantryItem, PantryUpsert } from './types';
import { PANTRY_UPSERT_KEY, upsertPantryFn } from './statusMutation';

export const pantryKey = ['pantry'] as const;

export function usePantry() {
  return useQuery({
    queryKey: pantryKey,
    queryFn: async (): Promise<PantryItem[]> => {
      const { data, error } = await supabase.from('pantry_items').select('*').order('store_section').order('display_name');
      if (error) throw error;
      return data as PantryItem[];
    },
  });
}

export function useUpsertPantryItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: PANTRY_UPSERT_KEY,
    networkMode: 'offlineFirst',
    retry: 3,
    mutationFn: async (items: PantryUpsert[]): Promise<PantryItem[]> => (await upsertPantryFn(items)) as PantryItem[],
    // Status taps should feel instant; the list refetches after the write lands.
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: pantryKey });
      const previous = qc.getQueryData<PantryItem[]>(pantryKey);
      qc.setQueryData<PantryItem[]>(pantryKey, (rows) =>
        rows?.map((r) => {
          const patch = items.find((i) => i.canonical_name === r.canonical_name);
          return patch?.status ? { ...r, status: patch.status } : r;
        }),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(pantryKey, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: pantryKey });
      qc.invalidateQueries({ queryKey: groceriesKey });
    },
  });
}

export function useDeletePantryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('pantry_items').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('That item was already removed.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: pantryKey }),
  });
}

export type ParsedPantryItem = { display_name: string; canonical_name: string; store_section: StoreSection; quantity: number | null; unit: string | null };

export function useParsePantryImages() {
  return useMutation({
    mutationFn: async (images: ImageForParse[]): Promise<ParsedPantryItem[]> => {
      const { data, error } = await supabase.functions.invoke<{ items: ParsedPantryItem[] }>('parse-pantry-image', { body: { images } });
      if (error) throw await describeFunctionError(error);
      if (!data?.items) throw new Error('The reader returned nothing.');
      return data.items;
    },
  });
}

async function describeFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string };
      if (body?.error) return new Error(body.error);
    } catch {
      // not JSON
    }
    return new Error(`The photo reader failed (HTTP ${error.context.status}).`);
  }
  return error instanceof Error ? error : new Error(String(error));
}
