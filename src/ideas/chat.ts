import type { RecipeDraft } from '@/recipes/types';
import type { ChatTurn } from './hooks';

export type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | {
      id: string;
      role: 'assistant';
      reply: string;
      existing: Array<{ recipe_id: string; title: string; why: string }>;
      newRecipes: Array<{ key: string; draft: RecipeDraft }>;
      remembered: Array<{ id: string; text: string }>;
      rememberError: string | null;
    };

export const MAX_TURNS = 24;
export const MAX_CHARS = 6000;
export const MAX_INPUT = 2000;

/** Proteins offered as one-tap "build a recipe around" starters. */
export const BUILD_AROUND = ['Chicken', 'Ground beef', 'Steak', 'Pork', 'Salmon', 'Shrimp', 'Turkey', 'Tofu'] as const;
export const QUICK_ASKS = ['Something quick tonight', 'Use up what is in the pantry', 'Something light and healthy'] as const;

export function buildAroundPrompt(ingredient: string): string {
  return `Build me a new recipe around ${ingredient.trim().toLowerCase()}.`;
}

// An assistant turn sent back to the model also lists what it showed, so a
// follow-up like "make the second one without dairy" has something to point at.
function assistantContent(e: Extract<ChatEntry, { role: 'assistant' }>): string {
  const shown = [
    ...e.existing.map((x) => `book recipe "${x.title}"`),
    ...e.newRecipes.map(({ draft }) => `new recipe "${draft.title}" (${draft.ingredients.map((i) => i.name).slice(0, 12).join(', ')})`),
  ];
  const text = shown.length ? `${e.reply}\n[Shown: ${shown.join('; ')}]` : e.reply;
  return text.slice(0, MAX_CHARS);
}

/** The last turns of the chat in API form, always starting with the user. */
export function toApiHistory(entries: ChatEntry[], maxTurns = MAX_TURNS): ChatTurn[] {
  const turns: ChatTurn[] = entries.map((e) => (e.role === 'user' ? { role: 'user', content: e.text.slice(0, MAX_CHARS) } : { role: 'assistant', content: assistantContent(e) }));
  const recent = turns.slice(-maxTurns);
  while (recent.length && recent[0].role !== 'user') recent.shift();
  return recent;
}
