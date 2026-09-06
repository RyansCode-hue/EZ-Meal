import { z } from 'npm:zod@^4.0.0';

// Mirror of STORE_SECTIONS in src/recipes/types.ts and the store_section enum in
// the database. Change all three together.
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

export const ParsedIngredient = z.object({
  quantity: z.number().nullable().describe('Numeric amount as written, e.g. 1.5 for "1 1/2". Null when none is given.'),
  unit: z
    .string()
    .nullable()
    .describe('Short unit as written, normalized: cup, tbsp, tsp, oz, lb, g, ml, clove, can, slice, etc. Null for countable items with no unit.'),
  name: z.string().describe('The ingredient as the cook would read it, without quantity or unit, e.g. "yellow onion".'),
  preparation: z.string().nullable().describe('Prep instruction attached to the ingredient, e.g. "diced", "melted". Null if none.'),
  canonical_name: z
    .string()
    .describe('Base grocery item, singular, lowercase, no brand, quantity, or prep: "onion", "chicken thigh", "olive oil", "all-purpose flour".'),
  store_section: z.enum(STORE_SECTIONS).describe('Where this item is found in a typical US grocery store.'),
});

export const ParsedRecipe = z.object({
  is_recipe: z.boolean().describe('False when the text does not contain a recipe.'),
  problem: z.string().nullable().describe('When is_recipe is false, one sentence saying why. Otherwise null.'),
  title: z.string(),
  description: z.string().nullable().describe('One or two sentences from the source, or null.'),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  servings: z.number().nullable().describe('Servings or yield as a number. Null if not stated and not inferable.'),
  cuisine: z.string().nullable().describe('e.g. Mexican, Italian, Thai. Null if unclear.'),
  tags: z.array(z.string()).describe('Up to 5 short lowercase tags: quick, vegetarian, crockpot, weeknight, dessert, soup, etc.'),
  ingredients: z.array(ParsedIngredient),
  steps: z.array(z.string()).describe('One instruction per step, in order, in the author\'s wording.'),
  warnings: z
    .array(z.string())
    .describe('Anything the cook should double-check: guessed servings, ambiguous quantities, missing steps. Empty if none.'),
});

export type ParsedRecipeT = z.infer<typeof ParsedRecipe>;

// The schema sent to the API, written by hand in the subset structured outputs
// accepts (type, properties, required, additionalProperties, enum, anyOf-null,
// description, items). The zod schema above validates the reply; keep both in step.
const nullable = (t: string, description?: string) => ({ anyOf: [{ type: t }, { type: 'null' }], ...(description ? { description } : {}) });

export const RECIPE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_recipe', 'problem', 'title', 'description', 'prep_minutes', 'cook_minutes', 'servings', 'cuisine', 'tags', 'ingredients', 'steps', 'warnings'],
  properties: {
    is_recipe: { type: 'boolean', description: 'False when the text does not contain a recipe.' },
    problem: nullable('string', 'When is_recipe is false, one sentence saying why. Otherwise null.'),
    title: { type: 'string' },
    description: nullable('string', 'One or two sentences from the source, or null.'),
    prep_minutes: nullable('integer'),
    cook_minutes: nullable('integer'),
    servings: nullable('number', 'Servings or yield as a number. Null if not stated and not inferable.'),
    cuisine: nullable('string', 'e.g. Mexican, Italian, Thai. Null if unclear.'),
    tags: { type: 'array', items: { type: 'string' }, description: 'Up to 5 short lowercase tags: quick, vegetarian, crockpot, weeknight, dessert, soup, etc.' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['quantity', 'unit', 'name', 'preparation', 'canonical_name', 'store_section'],
        properties: {
          quantity: nullable('number', 'Numeric amount as written, e.g. 1.5 for "1 1/2". Null when none is given.'),
          unit: nullable('string', 'Short unit as written, normalized: cup, tbsp, tsp, oz, lb, g, ml, clove, can, slice, etc. Null for countable items with no unit.'),
          name: { type: 'string', description: 'The ingredient as the cook would read it, without quantity or unit, e.g. "yellow onion".' },
          preparation: nullable('string', 'Prep instruction attached to the ingredient, e.g. "diced", "melted". Null if none.'),
          canonical_name: { type: 'string', description: 'Base grocery item, singular, lowercase, no brand, quantity, or prep: "onion", "chicken thigh", "olive oil", "all-purpose flour".' },
          store_section: { type: 'string', enum: [...STORE_SECTIONS], description: 'Where this item is found in a typical US grocery store.' },
        },
      },
    },
    steps: { type: 'array', items: { type: 'string' }, description: "One instruction per step, in order, in the author's wording." },
    warnings: { type: 'array', items: { type: 'string' }, description: 'Anything the cook should double-check: guessed servings, ambiguous quantities, missing steps. Empty if none.' },
  },
} as const;

export const RECIPE_SYSTEM_PROMPT = `You turn recipe text into structured data for a family's recipe book.

Rules:
- Keep the author's quantities, ingredient wording, and step wording. Do not invent ingredients or steps.
- Each ingredient line becomes one ingredient. Split quantity, unit, name, and preparation. "2 cloves garlic, minced" is quantity 2, unit "clove", name "garlic", preparation "minced".
- Convert written fractions and ranges to a single number (1/2 -> 0.5, "2-3" -> 2.5).
- Normalize units to short forms: cup, tbsp, tsp, oz, lb, g, kg, ml, l, clove, can, slice, piece, pinch, dash. Keep metric if the source is metric.
- canonical_name is the base grocery item in singular lowercase with no brand, size, quantity, or prep. It is what would appear on a shopping list. Use the same canonical_name for the same item everywhere.
- Choose store_section from the allowed values. Fresh herbs are produce; dried herbs and spices are spices; butter, milk, cheese, eggs are dairy_eggs; oils, flour, sugar, rice, pasta, and dry goods are pantry.
- Headings inside the ingredient list (like "For the sauce") are not ingredients. Fold them into the ingredient name only when needed to disambiguate.
- If servings are not stated but can be inferred, give a number and add a warning saying it was inferred. If nothing can be inferred, leave servings null.
- If the text is not a recipe (a shopping list, an article with no ingredients, gibberish), set is_recipe to false and explain in problem.`;

export type RecipeDraft = {
  title: string;
  description: string | null;
  photo_path: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  cuisine: string | null;
  tags: string[];
  source_type: 'manual' | 'paste' | 'url' | 'photo' | 'ai';
  source_url: string | null;
  ingredients: Array<{
    quantity: number | null;
    unit: string | null;
    name: string;
    preparation: string | null;
    canonical_name: string;
    store_section: (typeof STORE_SECTIONS)[number];
  }>;
  steps: Array<{ text: string }>;
  warnings: string[];
};

export function toDraft(parsed: ParsedRecipeT, source: RecipeDraft['source_type'], sourceUrl: string | null = null): RecipeDraft {
  return {
    title: parsed.title.trim(),
    description: parsed.description?.trim() || null,
    photo_path: null,
    prep_minutes: parsed.prep_minutes,
    cook_minutes: parsed.cook_minutes,
    servings: parsed.servings,
    cuisine: parsed.cuisine?.trim() || null,
    tags: parsed.tags.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8),
    source_type: source,
    source_url: sourceUrl,
    ingredients: parsed.ingredients.map((i) => ({
      quantity: i.quantity,
      unit: i.unit?.trim() || null,
      name: i.name.trim(),
      preparation: i.preparation?.trim() || null,
      canonical_name: i.canonical_name.trim().toLowerCase(),
      store_section: i.store_section,
    })),
    steps: parsed.steps.map((s) => ({ text: s.trim() })).filter((s) => s.text),
    warnings: parsed.warnings,
  };
}
