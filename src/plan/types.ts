import type { ISODate } from '@/lib/dates';

export type PlanEntryKind = 'recipe' | 'eating_out' | 'skip';

export type PlanEntryRecipe = {
  id: string;
  title: string;
  photo_path: string | null;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
};

export type PlanEntry = {
  id: string;
  date: ISODate;
  position: number;
  kind: PlanEntryKind;
  recipe_id: string | null;
  label: string | null;
  servings: number | null;
  cooked_at: string | null;
  cooked_by: string | null;
  recipe: PlanEntryRecipe | null;
};

export function entryTitle(e: PlanEntry): string {
  if (e.kind === 'recipe') return e.recipe?.title ?? 'Recipe';
  if (e.kind === 'eating_out') return e.label || 'Eating out';
  return e.label || 'Skip';
}
