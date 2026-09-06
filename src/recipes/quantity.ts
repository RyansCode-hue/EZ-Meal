// Quantity display and parsing. Imperial cooks think in fractions, so 0.5 cup
// renders as ½ cup and "1 1/2" typed into a form parses back to 1.5.

const FRACTIONS: Array<[number, string]> = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
];

export function formatQuantity(q: number | null | undefined): string {
  if (q == null || Number.isNaN(q)) return '';
  if (q === 0) return '0';
  const whole = Math.floor(q);
  const frac = q - whole;
  if (frac < 0.02) return String(whole);
  for (const [value, glyph] of FRACTIONS) {
    if (Math.abs(frac - value) < 0.02) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  // Not a kitchen fraction: show at most two decimals, trimmed.
  return String(Math.round((q + Number.EPSILON) * 100) / 100);
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '⅛': 1 / 8,
  '¼': 1 / 4,
  '⅓': 1 / 3,
  '⅜': 3 / 8,
  '½': 1 / 2,
  '⅝': 5 / 8,
  '⅔': 2 / 3,
  '¾': 3 / 4,
  '⅞': 7 / 8,
};

/** Parses "2", "1.5", "1/2", "1 1/2", "1½", "½". Returns null for blank or unparseable input. */
export function parseQuantity(input: string): number | null {
  let s = input.trim();
  if (!s) return null;
  let total = 0;
  const last = s[s.length - 1];
  if (last in UNICODE_FRACTIONS) {
    total += UNICODE_FRACTIONS[last];
    s = s.slice(0, -1).trim();
    if (!s) return total;
  }
  const parts = s.split(/\s+/);
  for (const part of parts) {
    if (/^\d+\/\d+$/.test(part)) {
      const [n, d] = part.split('/').map(Number);
      if (d === 0) return null;
      total += n / d;
    } else if (/^\d*\.?\d+$/.test(part)) {
      total += Number(part);
    } else {
      return null;
    }
  }
  return total;
}

export function scaleQuantity(q: number | null, factor: number): number | null {
  if (q == null) return null;
  return q * factor;
}

export function formatIngredient(
  ing: { quantity: number | null; unit: string | null; name: string; preparation: string | null },
  factor = 1,
): { amount: string; name: string; preparation: string | null } {
  const qty = formatQuantity(scaleQuantity(ing.quantity, factor));
  const amount = [qty, ing.unit].filter(Boolean).join(' ');
  return { amount, name: ing.name, preparation: ing.preparation };
}

export function formatMinutes(min: number | null): string {
  if (min == null) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
