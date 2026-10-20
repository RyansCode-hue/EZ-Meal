import { buildAroundPrompt, toApiHistory, type ChatEntry } from '@/ideas/chat';
import { emptyDraft } from '@/recipes/types';

const user = (id: string, text: string): ChatEntry => ({ id, role: 'user', text });
const bot = (id: string, reply: string, extra: Partial<Extract<ChatEntry, { role: 'assistant' }>> = {}): ChatEntry => ({
  id, role: 'assistant', reply, existing: [], newRecipes: [], remembered: [], rememberError: null, ...extra,
});

describe('toApiHistory', () => {
  it('lists what each assistant turn showed so follow-ups can refer to it', () => {
    const draft = { ...emptyDraft('ai'), title: 'Lemon chicken', ingredients: [{ quantity: 1, unit: 'lb', name: 'chicken thighs', preparation: null }] };
    const turns = toApiHistory([
      user('1', 'Something with chicken'),
      bot('2', 'Two ideas.', { existing: [{ recipe_id: 'r1', title: 'Chicken soup', why: 'Cozy' }], newRecipes: [{ key: 'k', draft }] }),
      user('3', 'Make the second one without lemon'),
    ]);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(turns[1].content).toContain('book recipe "Chicken soup"');
    expect(turns[1].content).toContain('new recipe "Lemon chicken" (chicken thighs)');
  });
  it('keeps only recent turns and always starts with the user', () => {
    const entries: ChatEntry[] = [];
    for (let i = 0; i < 10; i++) entries.push(user(`u${i}`, `q${i}`), bot(`b${i}`, `a${i}`));
    entries.push(user('last', 'final'));
    const turns = toApiHistory(entries, 4);
    expect(turns[0].role).toBe('user');
    expect(turns[turns.length - 1]).toEqual({ role: 'user', content: 'final' });
    expect(turns.length).toBeLessThanOrEqual(4);
  });
});

describe('buildAroundPrompt', () => {
  it('asks for a new recipe featuring the ingredient', () => {
    expect(buildAroundPrompt(' Ground Beef ')).toBe('Build me a new recipe around ground beef.');
  });
});
