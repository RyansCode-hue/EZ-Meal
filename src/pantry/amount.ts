import { formatQuantity, parseQuantity } from '@/recipes/quantity';
import { normalizeUnit } from '@/groceries/units';

export type AmountRead = { ok: true; quantity: number | null; unit: string | null } | { ok: false; error: string };

/**
 * Turns the amount editor's two text fields into a quantity and unit.
 * A blank amount means "no amount"; a unit on its own is kept so "oz" can be
 * filled in before the number is known.
 */
export function readAmount(amountText: string, unitText: string): AmountRead {
  const unit = normalizeUnit(unitText);
  if (!amountText.trim()) return { ok: true, quantity: null, unit };
  const quantity = parseQuantity(amountText);
  if (quantity == null || quantity < 0) return { ok: false, error: 'Use a number like 2, 1.5, or 1/2.' };
  return { ok: true, quantity, unit };
}

/** "2 lb", "½ cup", "oz", or "" when there is nothing to show. */
export function formatAmount(quantity: number | null | undefined, unit: string | null | undefined): string {
  return [formatQuantity(quantity), unit].filter(Boolean).join(' ');
}
