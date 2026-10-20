import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { describeFunctionError } from '@/lib/functions';
import { usePantry } from '@/pantry/hooks';
import { recipeKey, recipesKey } from '@/recipes/hooks';
import type { RecipeDraft } from '@/recipes/types';
import { rankByPantry } from './rank';
import { notesKey } from './notes';

type RecipeForMatch = { id: string; title: string; servings: number | null; prep_minutes: number | null; cook_minutes: number | null; last_cooked_at: string | null; recipe_ingredients: Array<{ canonical_name: string }> };

export const recipesForMatchKey = ['recipes', 'for-match'] as const;

export type { PantryMatch } from './rank';

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
  const matches = useMemo(() => rankByPantry(recipes.data ?? [], pantry.data ?? []), [pantry.data, recipes.data]);
  return { matches, isPending: pantry.isPending || recipes.isPending, isError: pantry.isError || recipes.isError, error: pantry.error ?? recipes.error, pantryCount: pantry.data?.length ?? 0 };
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type Suggestion = {
  reply: string;
  existing: Array<{ recipe_id: string; why: string }>;
  new_recipes: RecipeDraft[];
  /** Notes the assistant saved from this turn. */
  remembered: Array<{ id: string; text: string }>;
  remember_error: string | null;
};

export function useSuggestMeals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messages: ChatTurn[]): Promise<Suggestion> => {
      const { data, error } = await supabase.functions.invoke<Suggestion>('suggest-meals', { body: { messages } });
      if (error) throw await describeFunctionError(error, 'The assistant');
      if (!data?.reply) throw new Error('The assistant returned nothing.');
      return { ...data, remembered: data.remembered ?? [], remember_error: data.remember_error ?? null };
    },
    onSuccess: (data) => {
      if (data.remembered.length) qc.invalidateQueries({ queryKey: notesKey });
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
      if (error) throw await describeFunctionError(error, 'The assistant');
      if (!data?.nutrition) throw new Error('No estimate came back.');
      return data.nutrition;
    },
    onSuccess: (_n, recipeId) => {
      qc.invalidateQueries({ queryKey: recipeKey(recipeId) });
      qc.invalidateQueries({ queryKey: recipesKey });
    },
  });
}

