import { pickSurprise, rankByPantry } from '@/ideas/rank';

const recipes = [
  { id: 'a', title: 'Tacos', last_cooked_at: null, recipe_ingredients: [{ canonical_name: 'tortilla' }, { canonical_name: 'ground beef' }, { canonical_name: 'onion' }] },
  { id: 'b', title: 'Lentil soup', last_cooked_at: null, recipe_ingredients: [{ canonical_name: 'red lentil' }, { canonical_name: 'onion' }] },
  { id: 'c', title: 'Toast', last_cooked_at: null, recipe_ingredients: [] },
];
const pantry = [
  { canonical_name: 'onion', status: 'plenty' as const },
  { canonical_name: 'ground beef', status: 'low' as const },
  { canonical_name: 'red lentil', status: 'out' as const },
];

describe('rankByPantry', () => {
  it('ranks by share on hand, counts Low, ignores Out, drops empty recipes', () => {
    const ranked = rankByPantry(recipes, pantry);
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b']);
    expect(ranked[0]).toMatchObject({ have: 2, total: 3, missing: ['tortilla'] });
    expect(ranked[1]).toMatchObject({ have: 1, total: 2, missing: ['red lentil'] });
  });
});

describe('pickSurprise', () => {
  const now = Date.parse('2026-09-04T12:00:00Z');
  const list = [
    { id: 'recent', last_cooked_at: '2026-09-01T00:00:00Z' },
    { id: 'old', last_cooked_at: '2026-06-01T00:00:00Z' },
    { id: 'never', last_cooked_at: null },
  ];
  it('prefers recipes not cooked recently', () => {
    expect(pickSurprise(list, null, 14, now, () => 0)?.id).toBe('old');
    expect(pickSurprise(list, null, 14, now, () => 0.99)?.id).toBe('never');
  });
  it('avoids repeating the current pick when it can', () => {
    expect(pickSurprise(list, 'old', 14, now, () => 0)?.id).toBe('never');
  });
  it('falls back to everything when all are recent', () => {
    const allRecent = [{ id: 'x', last_cooked_at: '2026-09-03T00:00:00Z' }];
    expect(pickSurprise(allRecent, null, 14, now, () => 0)?.id).toBe('x');
    expect(pickSurprise([], null, 14, now)).toBeNull();
  });
});
