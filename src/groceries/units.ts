// Unit vocabulary for hand-typed items and the pantry amount editor. The alias
// table mirrors normalize_unit() in the database so "lbs" typed in the app and
// "pounds" in a recipe land on the same unit.

/** Short list offered as chips. Imperial first, then the containers staples come in. */
export const UNIT_CHOICES = ['lb', 'oz', 'cup', 'tbsp', 'tsp', 'gallon', 'quart', 'pint', 'can', 'bag', 'box', 'jar', 'bottle', 'package', 'dozen'] as const;

const ALIASES: Record<string, string> = {
  cups: 'cup', c: 'cup',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
  ounce: 'oz', ounces: 'oz', 'fl oz': 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg',
  milliliter: 'ml', milliliters: 'ml', liter: 'l', liters: 'l',
  gallons: 'gallon', quarts: 'quart', pints: 'pint',
  cloves: 'clove', cans: 'can', slices: 'slice', pieces: 'piece',
  pinches: 'pinch', dashes: 'dash', bunches: 'bunch', heads: 'head',
  stalks: 'stalk', sticks: 'stick', packages: 'package', pkg: 'package',
  bags: 'bag', boxes: 'box', jars: 'jar', bottles: 'bottle',
};

const BASE_UNITS = ['g', 'kg', 'ml', 'l', 'clove', 'slice', 'piece', 'pinch', 'dash', 'bunch', 'head', 'stalk', 'stick'];

/** Every spelling the item parser treats as a unit rather than part of the name. */
export const KNOWN_UNITS: ReadonlySet<string> = new Set([...UNIT_CHOICES, ...BASE_UNITS, ...Object.keys(ALIASES)]);

/** Lowercases, trims, and collapses plurals and long names. Blank becomes null. */
export function normalizeUnit(unit: string | null | undefined): string | null {
  const u = (unit ?? '').trim().toLowerCase();
  if (!u) return null;
  return ALIASES[u] ?? u;
}
