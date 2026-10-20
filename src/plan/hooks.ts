import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ISODate } from '@/lib/dates';
import { recipeKey, recipesKey } from '@/recipes/hooks';
import { pantryKey } from '@/pantry/hooks';
import { groceriesKey } from '@/groceries/hooks';
import type { PlanEntry, PlanEntryKind } from './types';

export const planKey = (start: ISODate, end: ISODate) => ['plan', start, end] as const;

const ENTRY_COLUMNS =
  'id, date, position, kind, recipe_id, label, servings, cooked_at, cooked_by, recipe:recipes(id, title, photo_path, servings, prep_minutes, cook_minutes)';

export function invalidatePlan(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ['plan'] });
}

export function usePlanEntries(start: ISODate, end: ISODate) {
  return useQuery({
    queryKey: planKey(start, end),
    queryFn: async (): Promise<PlanEntry[]> => {
      const { data, error } = await supabase
        .from('plan_entries')
        .select(ENTRY_COLUMNS)
        .gte('date', start)
        .lte('date', end)
        .order('date')
        .order('position')
        .order('created_at');
      if (error) throw error;
      return data as unknown as PlanEntry[];
    },
  });
}

export function useAddPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: ISODate; kind: PlanEntryKind; recipeId?: string; label?: string; servings?: number | null }) => {
      const { data, error } = await supabase.rpc('add_plan_entry', {
        p_date: input.date,
        p_kind: input.kind,
        p_recipe_id: input.recipeId ?? null,
        p_label: input.label ?? null,
        p_servings: input.servings ?? null,
      });
      if (error) throw error;
      return data as PlanEntry;
    },
    onSuccess: () => invalidatePlan(qc),
  });
}

export function useRemovePlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('plan_entries').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('That entry was already removed.');
    },
    onSuccess: () => invalidatePlan(qc),
  });
}

export function useRenamePlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error, count } = await supabase.from('plan_entries').update({ label }, { count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('That entry no longer exists.');
    },
    onSuccess: () => invalidatePlan(qc),
  });
}

export function useMovePlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: ISODate }) => {
      const { error } = await supabase.rpc('move_plan_entry', { p_id: id, p_date: date });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlan(qc),
  });
}

export function useReorderPlanDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, ids }: { date: ISODate; ids: string[] }) => {
      const { error } = await supabase.rpc('reorder_plan_day', { p_date: date, p_ids: ids });
      if (error) throw error;
    },
    onSuccess: () => invalidatePlan(qc),
  });
}

export function useSetCooked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, cooked }: { id: string; cooked: boolean; recipeId?: string | null }) => {
      const { error } = await supabase.rpc('set_plan_entry_cooked', { p_id: id, p_cooked: cooked });
      if (error) throw error;
    },
    // Cooking moves pantry amounts, which changes what the grocery list needs.
    onSuccess: (_d, { recipeId }) => {
      invalidatePlan(qc);
      qc.invalidateQueries({ queryKey: recipesKey });
      qc.invalidateQueries({ queryKey: pantryKey });
      qc.invalidateQueries({ queryKey: groceriesKey });
      if (recipeId) qc.invalidateQueries({ queryKey: recipeKey(recipeId) });
    },
  });
}

export function useSetEntryServings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, servings }: { id: string; servings: number }) => {
      const { error } = await supabase.from('plan_entries').update({ servings }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidatePlan(qc),
  });
}
