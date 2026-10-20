import { KNOWN_UNITS, SIZE_UNIT_CHOICES, UNIT_CHOICES, convertQuantity, isMeasureUnit, normalizeUnit } from '@/groceries/units';

describe('normalizeUnit', () => {
  it('collapses plurals and long names to the short form', () => {
    expect(normalizeUnit('lbs')).toBe('lb');
    expect(normalizeUnit('Pounds')).toBe('lb');
    expect(normalizeUnit('ounces')).toBe('oz');
    expect(normalizeUnit('tablespoons')).toBe('tbsp');
    expect(normalizeUnit('pkg')).toBe('package');
  });
  it('keeps unknown units as typed, lowercased and trimmed', () => {
    expect(normalizeUnit(' Tub ')).toBe('tub');
  });
  it('turns blank into null', () => {
    expect(normalizeUnit('')).toBeNull();
    expect(normalizeUnit('  ')).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
  });
  it('recognizes every chip choice and alias as a unit', () => {
    for (const u of UNIT_CHOICES) expect(KNOWN_UNITS.has(u)).toBe(true);
    expect(KNOWN_UNITS.has('lbs')).toBe(true);
    expect(KNOWN_UNITS.has('apples')).toBe(false);
  });
});

describe('convertQuantity', () => {
  it('converts within a dimension', () => {
    expect(convertQuantity(1, 'lb', 'oz')).toBeCloseTo(16, 9);
    expect(convertQuantity(1, 'gallon', 'cups')).toBeCloseTo(16, 9);
    expect(convertQuantity(3, 'tsp', 'tbsp')).toBeCloseTo(1, 9);
  });
  it('returns the quantity for the same unit, including no unit', () => {
    expect(convertQuantity(2, 'box', 'boxes')).toBe(2);
    expect(convertQuantity(2, null, '')).toBe(2);
  });
  it('refuses weight to volume and containers', () => {
    expect(convertQuantity(1, 'cup', 'oz')).toBeNull();
    expect(convertQuantity(1, 'box', 'oz')).toBeNull();
  });
});

describe('isMeasureUnit', () => {
  it('is true for weights and volumes only', () => {
    expect(isMeasureUnit('lbs')).toBe(true);
    expect(isMeasureUnit('cup')).toBe(true);
    expect(isMeasureUnit('box')).toBe(false);
    expect(isMeasureUnit('')).toBe(false);
    for (const u of SIZE_UNIT_CHOICES) expect(isMeasureUnit(u)).toBe(true);
  });
});
