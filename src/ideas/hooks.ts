import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { usePantry } from '@/pantry/hooks';
import { recipeKey, recipesKey } from '@/recipes/hooks';
import type { RecipeDraft } from '@/recipes/types';

type RecipeForMatch = { id: string; title: string; servings: number | null; prep_minutes: number | null; cook_minutes: number | null; last_cooked_at: string | null; recipe_ingredients: Array<{ canonical_name: string }> };

export const recipesForMatchKey = ['recipes', 'for-match'] as const;

export type PantryMatch = { id: string; title: string; have: number; total: number; missing: string[]; lastCookedAt: string | null };

/** Recipes ranked by how many ingredients the pantry has (Plenty or Low count as on hand). */
export function usePantryMatches() {
  const pantry = usePantry();
  const recipes = useQuery({
    queryKey: recipesForMatchKey,
    queryFn: async (): Promise<RecipeForMatch[]> => {
      const { data, error } = await supabase.from('recipes').select('id, title, servings, prep_minutes, cook_minutes, last_cooked_at, recipe_ingredients(canonical_name)');
      if (error) throw error;
      return data as unknown as RecipeForMatch[];
    },
  });
  const matches = useMemo<PantryMatch[]>(() => {
    const onHand = new Set((pantry.data ?? []).filter((p) => p.status !== 'out').map((p) => p.canonical_name));
    return (recipes.data ?? [])
      .filter((r) => r.recipe_ingredients.length > 0)
      .map((r) => {
        const names = [...new Set(r.recipe_ingredients.map((i) => i.canonical_name))];
        const missing = names.filter((n) => !onHand.has(n));
        return { id: r.id, title: r.title, have: names.length - missing.length, total: names.length, missing, lastCookedAt: r.last_cooked_at };
      })
      .sort((a, b) => b.have / b.total - a.have / a.total || b.have - a.have || a.title.localeCompare(b.title));
  }, [pantry.data, recipes.data]);
  return { matches, isPending: pantry.isPending || recipes.isPending, isError: pantry.isError || recipes.isError, error: pantry.error ?? recipes.error, pantryCount: pantry.data?.length ?? 0 };
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type Suggestion = { reply: string; existing: Array<{ recipe_id: string; why: string }>; new_recipes: RecipeDraft[] };

export function useSuggestMeals() {
  return useMutation({
    mutationFn: async (messages: ChatTurn[]): Promise<Suggestion> => {
      const { data, error } = await supabase.functions.invoke<Suggestion>('suggest-meals', { body: { messages } });
      if (error) throw await describeFunctionError(error);
      if (!data?.reply) throw new Error('The assistant returned nothing.');
      return data;
    },
  });
}

export type Nutrition = {
  per_serving: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number | null; sodium_mg: number | null };
  assumptions: string[];
  estimated_at: string;
};

export function useEstimateNutrition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recipeId: string): Promise<Nutrition> => {
      const { data, error } = await supabase.functions.invoke<{ nutrition: Nutrition }>('estimate-nutrition', { body: { recipe_id: recipeId } });
      if (error) throw await describeFunctionError(error);
      if (!data?.nutrition) throw new Error('No estimate came back.');
      return data.nutrition;
    },
    onSuccess: (_n, recipeId) => {
      qc.invalidateQueries({ queryKey: recipeKey(recipeId) });
      qc.invalidateQueries({ queryKey: recipesKey });
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
    return new Error(`The assistant failed (HTTP ${error.context.status}).`);
  }
  return error instanceof Error ? error : new Error(String(error));
}
