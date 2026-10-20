import { formatQuantity, parseQuantity } from '@/recipes/quantity';
import { isMeasureUnit, normalizeUnit } from '@/groceries/units';

export type AmountRead = { ok: true; quantity: number | null; unit: string | null } | { ok: false; error: string };

const NUMBER_HINT = 'Use a number like 2, 1.5, or 1/2.';

/**
 * Turns the amount editor's two text fields into a quantity and unit.
 * A blank amount means "no amount"; a unit on its own is kept so "oz" can be
 * filled in before the number is known.
 */
export function readAmount(amountText: string, unitText: string): AmountRead {
  const unit = normalizeUnit(unitText);
  if (!amountText.trim()) return { ok: true, quantity: null, unit };
  const quantity = parseQuantity(amountText);
  if (quantity == null || quantity < 0) return { ok: false, error: NUMBER_HINT };
  return { ok: true, quantity, unit };
}

/** A container size applies when the item is counted rather than weighed or measured. */
export function sizeApplies(amountText: string, unitText: string): boolean {
  return (!!amountText.trim() || !!unitText.trim()) && !isMeasureUnit(unitText);
}

/** Reads "each one holds": both blank is no size; otherwise a positive number and a weight or volume unit. */
export function readSize(amountText: string, unitText: string): AmountRead {
  const hasAmount = !!amountText.trim();
  const hasUnit = !!unitText.trim();
  if (!hasAmount && !hasUnit) return { ok: true, quantity: null, unit: null };
  if (!hasAmount) return { ok: false, error: 'Enter how much each one holds.' };
  const quantity = parseQuantity(amountText);
  if (quantity == null || quantity <= 0) return { ok: false, error: NUMBER_HINT };
  if (!hasUnit) return { ok: false, error: 'Pick a unit like oz, lb, or cup.' };
  if (!isMeasureUnit(unitText)) return { ok: false, error: 'Use a weight or volume, like oz, lb, or cup.' };
  return { ok: true, quantity, unit: normalizeUnit(unitText) };
}

/** "2 lb", "½ cup", "oz", or "" when there is nothing to show. */
export function formatAmount(quantity: number | null | undefined, unit: string | null | undefined): string {
  return [formatQuantity(quantity), unit].filter(Boolean).join(' ');
}

/** "2 box · 16 oz each", "16 oz each", or the plain amount. */
export function formatPantryAmount(item: { quantity: number | null; unit: string | null; package_quantity?: number | null; package_unit?: string | null }): string {
  const base = formatAmount(item.quantity, item.unit);
  const size = item.package_quantity != null ? `${formatAmount(item.package_quantity, item.package_unit)} each` : '';
  return [base, size].filter(Boolean).join(' · ');
}
