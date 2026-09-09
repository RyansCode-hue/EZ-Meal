import { KNOWN_UNITS, UNIT_CHOICES, normalizeUnit } from '@/groceries/units';

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
