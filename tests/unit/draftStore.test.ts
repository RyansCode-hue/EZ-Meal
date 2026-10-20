import { getPreview, holdPreview, markPreviewSaved, stashDraft, takeDraft } from '@/recipes/draftStore';
import { emptyDraft } from '@/recipes/types';

describe('draftStore', () => {
  it('hands a stashed draft over exactly once', () => {
    const d = { ...emptyDraft(), title: 'Soup' };
    stashDraft(d);
    expect(takeDraft()).toBe(d);
    expect(takeDraft()).toBeNull();
  });
  it('keeps held previews readable until saved, then remembers the saved id', () => {
    const key = holdPreview({ ...emptyDraft(), title: 'Tacos' });
    expect(getPreview(key)?.draft.title).toBe('Tacos');
    expect(getPreview(key)?.draft.title).toBe('Tacos');
    expect(getPreview(key)?.savedId).toBeNull();
    markPreviewSaved(key, 'recipe-1');
    expect(getPreview(key)?.savedId).toBe('recipe-1');
  });
  it('gives each held preview its own key and returns null for unknown keys', () => {
    expect(holdPreview(emptyDraft())).not.toBe(holdPreview(emptyDraft()));
    expect(getPreview('missing')).toBeNull();
    expect(getPreview(undefined)).toBeNull();
  });
});
