import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type HouseholdNote = { id: string; text: string; source: 'manual' | 'chat'; created_at: string };

export const notesKey = ['household-notes'] as const;
export const MAX_NOTE_CHARS = 200;

/** What the meal assistant knows about the household. Shared by both members. */
export function useHouseholdNotes() {
  return useQuery({
    queryKey: notesKey,
    queryFn: async (): Promise<HouseholdNote[]> => {
      const { data, error } = await supabase.from('household_notes').select('id, text, source, created_at').order('created_at');
      if (error) throw error;
      return data as HouseholdNote[];
    },
  });
}

export function useAddNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, text }: { householdId: string; text: string }) => {
      const { error } = await supabase.from('household_notes').insert({ household_id: householdId, text: text.trim(), source: 'manual' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('household_notes').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (!count) throw new Error('That note was already removed.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey }),
  });
}
