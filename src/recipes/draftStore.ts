import { useSyncExternalStore } from 'react';
import type { RecipeDraft } from './types';

// In-memory drafts that are too large for route params. Nothing here survives
// a page reload; screens that read it show a message when an entry is gone.

// One-shot handoff from the import screens to the edit screen.
let pending: RecipeDraft | null = null;

export function stashDraft(draft: RecipeDraft) {
  pending = draft;
}

export function takeDraft(): RecipeDraft | null {
  const d = pending;
  pending = null;
  return d;
}

// Assistant ideas held for the preview screen. An entry remembers the saved
// recipe's id so a second tap opens it instead of saving a duplicate.
export type HeldPreview = { draft: RecipeDraft; savedId: string | null };

const previews = new Map<string, HeldPreview>();
const listeners = new Set<() => void>();
let version = 0;
let counter = 0;

function emit() {
  version += 1;
  for (const l of listeners) l();
}

export function holdPreview(draft: RecipeDraft): string {
  counter += 1;
  const key = `${Date.now().toString(36)}-${counter}`;
  previews.set(key, { draft, savedId: null });
  emit();
  return key;
}

export function getPreview(key: string | null | undefined): HeldPreview | null {
  return key ? previews.get(key) ?? null : null;
}

export function markPreviewSaved(key: string, savedId: string) {
  const held = previews.get(key);
  if (!held) return;
  previews.set(key, { ...held, savedId });
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Re-renders the caller when a held preview is added or saved. */
export function usePreviewStore(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
