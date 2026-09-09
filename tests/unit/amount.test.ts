import { formatAmount, readAmount } from '@/pantry/amount';

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
