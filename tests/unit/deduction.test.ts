import { plannedDeduction, servingsFactor } from '@/plan/deduction';
import type { PantryItem } from '@/pantry/types';

const item = (quantity: number | null, unit: string | null, package_quantity: number | null = null, package_unit: string | null = null): PantryItem => ({
  id: '1', canonical_name: 'x', display_name: 'X', status: 'plenty', quantity, unit, package_quantity, package_unit, store_section: 'other', updated_at: '',
});

describe('plannedDeduction', () => {
  it('scales by servings and matches unit spellings', () => {
    expect(plannedDeduction({ canonical_name: 'x', quantity: 1, unit: 'pounds' }, item(5, 'lb'), 2)).toEqual({ take: 2, left: 3 });
  });
  it('floors at zero', () => {
    expect(plannedDeduction({ canonical_name: 'x', quantity: 3, unit: 'tbsp' }, item(4, 'tablespoons'), 2)).toEqual({ take: 4, left: 0 });
  });
  it('converts within weight and within volume', () => {
    expect(plannedDeduction({ canonical_name: 'x', quantity: 8, unit: 'oz' }, item(2, 'lb'), 1)).toEqual({ take: 0.5, left: 1.5 });
    expect(plannedDeduction({ canonical_name: 'x', quantity: 2, unit: 'cups' }, item(1, 'gallon'), 1)?.take).toBeCloseTo(0.125, 9);
  });
  it('takes part of a container through its size', () => {
    expect(plannedDeduction({ canonical_name: 'x', quantity: 8, unit: 'oz' }, item(2, 'box', 16, 'oz'), 1)).toEqual({ take: 0.5, left: 1.5 });
    expect(plannedDeduction({ canonical_name: 'x', quantity: 1, unit: 'lb' }, item(3, null, 8, 'oz'), 1)).toEqual({ take: 2, left: 1 });
    expect(plannedDeduction({ canonical_name: 'x', quantity: 1, unit: 'can' }, item(3, 'can', 15, 'oz'), 1)).toEqual({ take: 1, left: 2 });
    expect(plannedDeduction({ canonical_name: 'x', quantity: 1, unit: 'cup' }, item(2, 'bag', 2, 'lb'), 1)).toBeNull();
  });
  it('skips untracked items, missing amounts, and mismatched units', () => {
    expect(plannedDeduction({ canonical_name: 'x', quantity: 1, unit: 'lb' }, undefined, 1)).toBeNull();
    expect(plannedDeduction({ canonical_name: 'x', quantity: null, unit: 'lb' }, item(5, 'lb'), 1)).toBeNull();
    expect(plannedDeduction({ canonical_name: 'x', quantity: 1, unit: 'lb' }, item(null, 'lb'), 1)).toBeNull();
    expect(plannedDeduction({ canonical_name: 'x', quantity: 1, unit: 'tsp' }, item(2, 'oz'), 1)).toBeNull();
  });
});

describe('servingsFactor', () => {
  it('divides entry servings by recipe servings, defaulting to 1', () => {
    expect(servingsFactor(8, 4)).toBe(2);
    expect(servingsFactor(null, 4)).toBe(1);
    expect(servingsFactor(4, 0)).toBe(1);
  });
});
