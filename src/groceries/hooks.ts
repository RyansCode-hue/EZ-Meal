import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ISODate } from '@/lib/dates';
import { useAuth } from '@/auth/AuthProvider';
import { householdKey, useHousehold } from '@/household/useHousehold';
import type { StoreSection } from '@/recipes/types';
import type { GroceryItem } from './types';
import { TOGGLE_MUTATION_KEY, toggleGroceryFn, type ToggleVars } from './toggle';

export const groceriesKey = ['groceries'] as const;

export function useGroceries() {
  return useQuery({
    queryKey: groceriesKey,
    queryFn: async (): Promise<GroceryItem[]> => {
      const { data, error } = await supabase.from('grocery_items').select('*').order('store_section').order('checked').order('name');
      if (error) throw error;
      return data as GroceryItem[];
    },
  });
}

export function useGenerateGroceries() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async ({ start, end }: { start: ISODate; end: ISODate }) => {
      const { data, error } = await supabase.rpc('generate_grocery_list', { p_start: start, p_end: end });
      if (error) throw error;
      return data as GroceryItem[];
    },
    onSuccess: (items) => {
      qc.setQueryData(groceriesKey, items);
      qc.invalidateQueries({ queryKey: householdKey(session?.user.id) });
    },
  });
}

// Checking off an item must feel instant in a store aisle and must work with no
// signal: the cache updates first, the write waits for a connection, and the
// change is rolled back only if the server rejects it.
export function useToggleGrocery() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  return useMutation({
    mutationKey: TOGGLE_MUTATION_KEY,
    networkMode: 'offlineFirst',
    retry: 3,
    mutationFn: toggleGroceryFn,
    onMutate: async ({ id, checked }: ToggleVars) => {
      await qc.cancelQueries({ queryKey: groceriesKey });
      const previous = qc.getQueryData<GroceryItem[]>(groceriesKey);
      qc.setQueryData<GroceryItem[]>(groceriesKey, (items) => items?.map((i) => (i.id === id ? { ...i, checked, checked_by: checked ? userId : null } : i)));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(groceriesKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: groceriesKey }),
  });
}

export function useAddManualItem() {
  const qc = useQueryClient();
  const { household } = useHousehold();
  return useMutation({
    mutationFn: async ({ name, quantity, unit, section }: { name: string; quantity: number | null; unit: string | null; section: StoreSection }) => {
      if (!household) throw new Error('Not in a household.');
      const { error } = await supabase.from('grocery_items').insert({
        household_id: household.id,
        name: name.trim(),
        canonical_name: name.trim().toLowerCase(),
        quantity,
        unit,
        store_section: section,
        is_manual: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groceriesKey }),
  });
}

export function useDeleteGroceryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('grocery_items').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('That item was already removed.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groceriesKey }),
  });
}

export function useClearChecked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('clear_checked_groceries');
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: groceriesKey }),
  });
}
