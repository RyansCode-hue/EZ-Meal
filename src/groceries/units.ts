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

/** Units offered for "each one holds". Weight first, then volume. */
export const SIZE_UNIT_CHOICES = ['oz', 'lb', 'g', 'kg', 'cup', 'quart', 'gallon', 'ml', 'l'] as const;

// Weight in grams, volume in milliliters. Mirrors unit_measure() in the database.
// "oz" is weight; "fl oz" normalizes to it, so fluid ounces convert as weight.
const MEASURES: Record<string, { dimension: 'weight' | 'volume'; factor: number }> = {
  oz: { dimension: 'weight', factor: 28.349523125 },
  lb: { dimension: 'weight', factor: 453.59237 },
  g: { dimension: 'weight', factor: 1 },
  kg: { dimension: 'weight', factor: 1000 },
  tsp: { dimension: 'volume', factor: 4.92892159375 },
  tbsp: { dimension: 'volume', factor: 14.78676478125 },
  cup: { dimension: 'volume', factor: 236.5882365 },
  pint: { dimension: 'volume', factor: 473.176473 },
  quart: { dimension: 'volume', factor: 946.352946 },
  gallon: { dimension: 'volume', factor: 3785.411784 },
  ml: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
};

/** True for weight and volume units; false for containers, counts, and blank. */
export function isMeasureUnit(unit: string | null | undefined): boolean {
  const u = normalizeUnit(unit);
  return u != null && u in MEASURES;
}

/** Converts between the same unit or units of one dimension. Null when they cannot convert. */
export function convertQuantity(quantity: number, from: string | null | undefined, to: string | null | undefined): number | null {
  const f = normalizeUnit(from) ?? '';
  const t = normalizeUnit(to) ?? '';
  if (f === t) return quantity;
  const a = MEASURES[f];
  const b = MEASURES[t];
  if (!a || !b || a.dimension !== b.dimension) return null;
  return (quantity * a.factor) / b.factor;
}
