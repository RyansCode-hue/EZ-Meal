import { formatIngredient, formatMinutes, formatQuantity, parseQuantity } from '@/recipes/quantity';

describe('formatQuantity', () => {
  it('shows kitchen fractions', () => {
    expect(formatQuantity(0.5)).toBe('½');
    expect(formatQuantity(1.5)).toBe('1½');
    expect(formatQuantity(0.25)).toBe('¼');
    expect(formatQuantity(1 / 3)).toBe('⅓');
    expect(formatQuantity(2)).toBe('2');
  });
  it('falls back to decimals for odd amounts', () => {
    expect(formatQuantity(0.45)).toBe('0.45');
    expect(formatQuantity(2.6)).toBe('2.6');
    expect(formatQuantity(2.345)).toBe('2⅓');
  });
  it('handles empty', () => {
    expect(formatQuantity(null)).toBe('');
    expect(formatQuantity(0)).toBe('0');
  });
});

describe('parseQuantity', () => {
  it('reads whole numbers, decimals, and fractions', () => {
    expect(parseQuantity('2')).toBe(2);
    expect(parseQuantity('1.5')).toBe(1.5);
    expect(parseQuantity('1/2')).toBe(0.5);
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('½')).toBe(0.5);
    expect(parseQuantity('1½')).toBe(1.5);
  });
  it('rejects junk', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('a lot')).toBeNull();
    expect(parseQuantity('1/0')).toBeNull();
  });
});

describe('formatIngredient', () => {
  it('scales and formats', () => {
    expect(formatIngredient({ quantity: 2, unit: 'tbsp', name: 'olive oil', preparation: null }, 2)).toEqual({ amount: '4 tbsp', name: 'olive oil', preparation: null });
    expect(formatIngredient({ quantity: null, unit: null, name: 'salt', preparation: 'to taste' }, 3).amount).toBe('');
  });
});

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(85)).toBe('1 hr 25 min');
    expect(formatMinutes(null)).toBe('');
  });
});
