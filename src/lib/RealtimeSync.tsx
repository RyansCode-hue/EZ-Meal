import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// One channel per household. Any change to a synced table on either phone
// invalidates the matching queries, so both screens refetch within a second.
// RLS still filters what each subscriber receives.
const TABLE_KEYS: Record<string, string[][]> = {
  plan_entries: [['plan']],
  recipes: [['recipes'], ['recipe']],
  grocery_items: [['groceries']],
  pantry_items: [['pantry']],
};

export function RealtimeSync({ householdId }: { householdId: string }) {
  const qc = useQueryClient();

  useEffect(() => {
    let channel = supabase.channel(`household-${householdId}`);
    for (const [table, keys] of Object.entries(TABLE_KEYS)) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        () => {
          for (const key of keys) qc.invalidateQueries({ queryKey: key });
        },
      );
    }
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Realtime channel problem', status, err?.message);
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, qc]);

  return null;
}
