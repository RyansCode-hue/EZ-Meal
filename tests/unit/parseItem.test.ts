import { parseItemText } from '@/groceries/parseItem';

describe('parseItemText', () => {
  it('splits amount, unit, and name', () => {
    expect(parseItemText('2 lb apples')).toEqual({ quantity: 2, unit: 'lb', name: 'apples' });
    expect(parseItemText('1/2 gallon milk')).toEqual({ quantity: 0.5, unit: 'gallon', name: 'milk' });
  });
  it('normalizes the unit spelling', () => {
    expect(parseItemText('5 lbs rice')).toEqual({ quantity: 5, unit: 'lb', name: 'rice' });
    expect(parseItemText('2 Pounds flour')).toEqual({ quantity: 2, unit: 'lb', name: 'flour' });
  });
  it('keeps a leading number without a unit', () => {
    expect(parseItemText('3 onions')).toEqual({ quantity: 3, unit: null, name: 'onions' });
  });
  it('treats unknown words as part of the name', () => {
    expect(parseItemText('paper towels')).toEqual({ quantity: null, unit: null, name: 'paper towels' });
    expect(parseItemText('2 big bags of chips')).toEqual({ quantity: 2, unit: null, name: 'big bags of chips' });
  });
});
