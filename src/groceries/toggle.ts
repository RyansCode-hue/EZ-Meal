import { supabase } from '@/lib/supabase';

export const TOGGLE_MUTATION_KEY = ['groceries', 'toggle'] as const;

export type ToggleVars = { id: string; checked: boolean; userId: string | null };

// Lives outside the hook so a paused (offline) mutation can resume after the
// app restarts: the query client re-attaches this function by mutation key.
export async function toggleGroceryFn({ id, checked, userId }: ToggleVars): Promise<void> {
  const { error, data } = await supabase
    .from('grocery_items')
    .update({ checked, checked_by: checked ? userId : null, checked_at: checked ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('That item is no longer on the list.');
}
