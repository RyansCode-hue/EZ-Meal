import type { RecipeDraft } from './types';

// Hands a parsed draft from the import screens to the edit screen. Route params
// are strings, and a recipe is too large to serialize into one comfortably.
let pending: RecipeDraft | null = null;

export function stashDraft(draft: RecipeDraft) {
  pending = draft;
}

export function takeDraft(): RecipeDraft | null {
  const d = pending;
  pending = null;
  return d;
}
