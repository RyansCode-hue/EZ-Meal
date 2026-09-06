// Recipe domain types. The draft shape is also what the parse-recipe-* Edge
// Functions return; keep supabase/functions/_shared/recipeSchema.ts in step.

export const STORE_SECTIONS = [
  'produce',
  'meat_seafood',
  'dairy_eggs',
  'bakery',
  'frozen',
  'pantry',
  'spices',
  'canned_jarred',
  'beverages',
  'household',
  'other',
] as const;
export type StoreSection = (typeof STORE_SECTIONS)[number];

export const STORE_SECTION_LABELS: Record<StoreSection, string> = {
  produce: 'Produce',
  meat_seafood: 'Meat & seafood',
  dairy_eggs: 'Dairy & eggs',
  bakery: 'Bakery',
  frozen: 'Frozen',
  pantry: 'Pantry',
  spices: 'Spices',
  canned_jarred: 'Canned & jarred',
  beverages: 'Beverages',
  household: 'Household',
  other: 'Other',
};

export type RecipeSource = 'manual' | 'paste' | 'url' | 'photo' | 'ai';

export type IngredientDraft = {
  quantity: number | null;
  unit: string | null;
  name: string;
  preparation: string | null;
  canonical_name?: string | null;
  store_section?: StoreSection | null;
};

export type StepDraft = { text: string };

export type RecipeDraft = {
  id?: string;
  title: string;
  description: string | null;
  photo_path: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  cuisine: string | null;
  tags: string[];
  source_type: RecipeSource;
  source_url: string | null;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
  /** Things the parser was unsure about, shown to the user before saving. */
  warnings?: string[];
};

export type RecipeRating = {
  user_id: string;
  rating: number | null;
  notes: string | null;
};

export type RecipeSummary = {
  id: string;
  title: string;
  photo_path: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  cuisine: string | null;
  tags: string[];
  last_cooked_at: string | null;
  created_at: string;
  recipe_ratings: RecipeRating[];
};

export type RecipeIngredient = {
  id: string;
  position: number;
  quantity: number | null;
  unit: string | null;
  name: string;
  preparation: string | null;
  canonical_name: string;
  store_section: StoreSection;
};

export type RecipeStep = { id: string; position: number; text: string };

export type RecipeDetail = RecipeSummary & {
  description: string | null;
  source_type: RecipeSource;
  source_url: string | null;
  nutrition: Record<string, unknown> | null;
  recipe_ingredients: RecipeIngredient[];
  recipe_steps: RecipeStep[];
};

export function emptyDraft(source: RecipeSource = 'manual'): RecipeDraft {
  return {
    title: '',
    description: null,
    photo_path: null,
    prep_minutes: null,
    cook_minutes: null,
    servings: 4,
    cuisine: null,
    tags: [],
    source_type: source,
    source_url: null,
    ingredients: [{ quantity: null, unit: null, name: '', preparation: null }],
    steps: [{ text: '' }],
  };
}

export function draftFromDetail(r: RecipeDetail): RecipeDraft {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    photo_path: r.photo_path,
    prep_minutes: r.prep_minutes,
    cook_minutes: r.cook_minutes,
    servings: r.servings,
    cuisine: r.cuisine,
    tags: r.tags,
    source_type: r.source_type,
    source_url: r.source_url,
    ingredients: [...r.recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map(({ quantity, unit, name, preparation, canonical_name, store_section }) => ({
        quantity,
        unit,
        name,
        preparation,
        canonical_name,
        store_section,
      })),
    steps: [...r.recipe_steps].sort((a, b) => a.position - b.position).map(({ text }) => ({ text })),
  };
}

export function totalMinutes(r: { prep_minutes: number | null; cook_minutes: number | null }): number | null {
  if (r.prep_minutes == null && r.cook_minutes == null) return null;
  return (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0);
}

export function averageRating(ratings: RecipeRating[]): number | null {
  const vals = ratings.map((r) => r.rating).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
