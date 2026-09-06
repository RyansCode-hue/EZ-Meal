import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { describeFunctionError } from '@/lib/functions';
import { useAuth } from '@/auth/AuthProvider';
import { useHousehold } from '@/household/useHousehold';
import type { RecipeDetail, RecipeDraft, RecipeSummary, StoreSection } from './types';

export const recipesKey = ['recipes'] as const;
export const recipeKey = (id: string) => ['recipe', id] as const;

const SUMMARY_COLUMNS =
  'id, title, photo_path, prep_minutes, cook_minutes, servings, cuisine, tags, last_cooked_at, created_at, recipe_ratings(user_id, rating, notes)';

export function useRecipes() {
  return useQuery({
    queryKey: recipesKey,
    queryFn: async (): Promise<RecipeSummary[]> => {
      const { data, error } = await supabase.from('recipes').select(SUMMARY_COLUMNS).order('title');
      if (error) throw error;
      return data as unknown as RecipeSummary[];
    },
  });
}

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: recipeKey(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<RecipeDetail> => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*, recipe_ingredients(*), recipe_steps(*), recipe_ratings(user_id, rating, notes)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      const detail = data as unknown as RecipeDetail;
      detail.recipe_ingredients.sort((a, b) => a.position - b.position);
      detail.recipe_steps.sort((a, b) => a.position - b.position);
      return detail;
    },
  });
}

export function useSaveRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (draft: RecipeDraft): Promise<string> => {
      const { ingredients, steps, warnings: _warnings, ...recipe } = draft;
      const { data, error } = await supabase.rpc('save_recipe', {
        p_recipe: recipe,
        p_ingredients: ingredients,
        p_steps: steps,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: recipesKey });
      qc.invalidateQueries({ queryKey: recipeKey(id) });
    },
  });
}

export function useSetRecipePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, photo_path }: { id: string; photo_path: string | null }) => {
      const { error } = await supabase.from('recipes').update({ photo_path }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: recipesKey });
      qc.invalidateQueries({ queryKey: recipeKey(id) });
    },
  });
}

export function useUpdateRecipeTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const { error, data } = await supabase.from('recipes').update({ tags }).eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('That recipe no longer exists.');
    },
    onMutate: async ({ id, tags }) => {
      await qc.cancelQueries({ queryKey: recipeKey(id) });
      const previous = qc.getQueryData<RecipeDetail>(recipeKey(id));
      if (previous) qc.setQueryData<RecipeDetail>(recipeKey(id), { ...previous, tags });
      return { previous };
    },
    onError: (_e, { id }, ctx) => {
      if (ctx?.previous) qc.setQueryData(recipeKey(id), ctx.previous);
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: recipeKey(id) });
      qc.invalidateQueries({ queryKey: recipesKey });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('recipes').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('Recipe was not deleted. It may already be gone.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recipesKey }),
  });
}

export function useRateRecipe() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { household } = useHousehold();
  return useMutation({
    mutationFn: async ({ recipeId, rating, notes }: { recipeId: string; rating: number | null; notes: string | null }) => {
      if (!session || !household) throw new Error('Not signed in.');
      const { error } = await supabase.from('recipe_ratings').upsert(
        {
          household_id: household.id,
          recipe_id: recipeId,
          user_id: session.user.id,
          rating,
          notes: notes?.trim() ? notes.trim() : null,
        },
        { onConflict: 'recipe_id,user_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_d, { recipeId }) => {
      qc.invalidateQueries({ queryKey: recipeKey(recipeId) });
      qc.invalidateQueries({ queryKey: recipesKey });
    },
  });
}

/** Sends pasted text to the parse-recipe-text Edge Function and returns a draft. */
export function useParseRecipeText() {
  return useMutation({
    mutationFn: async (text: string): Promise<RecipeDraft> => {
      const { data, error } = await supabase.functions.invoke<{ recipe: RecipeDraft }>('parse-recipe-text', {
        body: { text },
      });
      if (error) throw await describeFunctionError(error, 'The recipe reader');
      if (!data?.recipe) throw new Error('The parser returned no recipe.');
      return data.recipe;
    },
  });
}

export type ImageForParse = { media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string };
export type UploadedFile = { path: string; name: string; media_type: string };

/** Asks parse-recipe-file to read files already uploaded to the household's bucket. */
export function useParseRecipeFiles() {
  return useMutation({
    mutationFn: async (files: UploadedFile[]): Promise<RecipeDraft> => {
      const { data, error } = await supabase.functions.invoke<{ recipe: RecipeDraft }>('parse-recipe-file', { body: { paths: files } });
      if (error) throw await describeFunctionError(error, 'The recipe reader');
      if (!data?.recipe) throw new Error('The reader returned no recipe.');
      return data.recipe;
    },
  });
}

/** Sends a web address to import-recipe-url and returns a draft (with the page's photo when available). */
export function useImportRecipeUrl() {
  return useMutation({
    mutationFn: async (url: string): Promise<RecipeDraft> => {
      const { data, error } = await supabase.functions.invoke<{ recipe: RecipeDraft }>('import-recipe-url', { body: { url } });
      if (error) throw await describeFunctionError(error, 'The recipe reader');
      if (!data?.recipe) throw new Error('The importer returned no recipe.');
      return data.recipe;
    },
  });
}

/** Labels hand-typed ingredients with a grocery name and store section via the normalize-ingredients function. */
export function useNormalizeIngredients() {
  return useMutation({
    mutationFn: async (ingredients: Array<{ name: string; preparation: string | null }>): Promise<Array<{ canonical_name: string; store_section: StoreSection }>> => {
      const { data, error } = await supabase.functions.invoke<{ ingredients: Array<{ canonical_name: string; store_section: StoreSection }> }>('normalize-ingredients', {
        body: { ingredients },
      });
      if (error) throw await describeFunctionError(error, 'The recipe reader');
      if (!data?.ingredients || data.ingredients.length !== ingredients.length) throw new Error('The ingredient labeler returned an incomplete answer.');
      return data.ingredients;
    },
  });
}

