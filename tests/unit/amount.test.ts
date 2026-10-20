import { formatAmount, formatPantryAmount, readAmount, readSize, sizeApplies } from '@/pantry/amount';

describe('readAmount', () => {
  it('parses whole numbers, decimals, and fractions with a normalized unit', () => {
    expect(readAmount('2', 'lbs')).toEqual({ ok: true, quantity: 2, unit: 'lb' });
    expect(readAmount('1.5', 'oz')).toEqual({ ok: true, quantity: 1.5, unit: 'oz' });
    expect(readAmount('1/2', 'cup')).toEqual({ ok: true, quantity: 0.5, unit: 'cup' });
  });
  it('treats a blank amount as no quantity but keeps the unit', () => {
    expect(readAmount('', '')).toEqual({ ok: true, quantity: null, unit: null });
    expect(readAmount('  ', 'oz')).toEqual({ ok: true, quantity: null, unit: 'oz' });
  });
  it('rejects text and negative numbers', () => {
    expect(readAmount('two', 'lb').ok).toBe(false);
    expect(readAmount('-1', 'lb').ok).toBe(false);
  });
});

describe('formatAmount', () => {
  it('joins quantity and unit, dropping whatever is missing', () => {
    expect(formatAmount(2, 'lb')).toBe('2 lb');
    expect(formatAmount(0.5, 'cup')).toBe('½ cup');
    expect(formatAmount(null, 'oz')).toBe('oz');
    expect(formatAmount(3, null)).toBe('3');
    expect(formatAmount(null, null)).toBe('');
  });
});

describe('sizeApplies', () => {
  it('applies to containers and plain counts, not weights or volumes', () => {
    expect(sizeApplies('2', 'box')).toBe(true);
    expect(sizeApplies('3', '')).toBe(true);
    expect(sizeApplies('', 'bottle')).toBe(true);
    expect(sizeApplies('2', 'lb')).toBe(false);
    expect(sizeApplies('1', 'gallon')).toBe(false);
    expect(sizeApplies('', '')).toBe(false);
  });
});

describe('readSize', () => {
  it('reads a size in a weight or volume unit', () => {
    expect(readSize('16', 'ounces')).toEqual({ ok: true, quantity: 16, unit: 'oz' });
    expect(readSize('1 1/2', 'l')).toEqual({ ok: true, quantity: 1.5, unit: 'l' });
  });
  it('treats both fields blank as no size', () => {
    expect(readSize('', '')).toEqual({ ok: true, quantity: null, unit: null });
  });
  it('asks for whichever half is missing, and rejects containers and zero', () => {
    expect(readSize('16', '')).toEqual({ ok: false, error: 'Pick a unit like oz, lb, or cup.' });
    expect(readSize('', 'oz')).toEqual({ ok: false, error: 'Enter how much each one holds.' });
    expect(readSize('2', 'box').ok).toBe(false);
    expect(readSize('0', 'oz').ok).toBe(false);
  });
});

describe('formatPantryAmount', () => {
  it('adds the container size after the count', () => {
    expect(formatPantryAmount({ quantity: 2, unit: 'box', package_quantity: 16, package_unit: 'oz' })).toBe('2 box · 16 oz each');
    expect(formatPantryAmount({ quantity: null, unit: null, package_quantity: 12, package_unit: 'oz' })).toBe('12 oz each');
    expect(formatPantryAmount({ quantity: 1.5, unit: 'lb', package_quantity: null, package_unit: null })).toBe('1½ lb');
  });
});
