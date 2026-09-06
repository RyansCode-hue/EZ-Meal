import { parseQuantity } from '@/recipes/quantity';

const UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'g', 'kg', 'ml', 'l', 'can', 'cans', 'bag', 'bags', 'box', 'boxes',
  'bunch', 'bunches', 'head', 'heads', 'jar', 'jars', 'bottle', 'bottles', 'pkg', 'package', 'packages', 'dozen', 'gallon', 'quart', 'pint',
]);

/** "2 lb apples" -> { quantity: 2, unit: 'lb', name: 'apples' }. Anything unparseable is the whole name. */
export function parseItemText(text: string): { quantity: number | null; unit: string | null; name: string } {
  const t = text.trim();
  const m = t.match(/^((?:\d+(?:[./]\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞])(?:\s+\d\/\d)?)\s+(.+)$/);
  if (!m) return { quantity: null, unit: null, name: t };
  const quantity = parseQuantity(m[1]);
  if (quantity == null) return { quantity: null, unit: null, name: t };
  const rest = m[2].trim();
  const [first, ...others] = rest.split(/\s+/);
  if (others.length && UNITS.has(first.toLowerCase())) {
    return { quantity, unit: first.toLowerCase(), name: others.join(' ') };
  }
  return { quantity, unit: null, name: rest };
}
