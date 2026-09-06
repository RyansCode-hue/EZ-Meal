import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/auth/AuthProvider';
import type { Household, HouseholdMember } from './types';

export const householdKey = (userId: string | undefined) => ['household', userId] as const;

type HouseholdState = {
  household: Household | null;
  members: HouseholdMember[];
};

async function fetchHousehold(): Promise<HouseholdState> {
  const { data: membership, error: mErr } = await supabase
    .from('household_members')
    .select('household_id')
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership) return { household: null, members: [] };

  const [{ data: household, error: hErr }, { data: members, error: memErr }] = await Promise.all([
    supabase.from('households').select('*').eq('id', membership.household_id).single(),
    supabase
      .from('household_members')
      .select('household_id, user_id, display_name, remind_planning, remind_dinner, notify_partner')
      .eq('household_id', membership.household_id)
      .order('created_at'),
  ]);
  if (hErr) throw hErr;
  if (memErr) throw memErr;
  return { household: household as Household, members: (members ?? []) as HouseholdMember[] };
}

export function useHousehold() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const query = useQuery({
    queryKey: householdKey(userId),
    queryFn: fetchHousehold,
    enabled: !!userId,
  });
  const me = query.data?.members.find((m) => m.user_id === userId) ?? null;
  return { ...query, household: query.data?.household ?? null, members: query.data?.members ?? [], me };
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; displayName: string }) => {
      const { data, error } = await supabase.rpc('create_household', {
        p_name: input.name,
        p_display_name: input.displayName,
      });
      if (error) throw error;
      return data as Household;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: householdKey(session?.user.id) }),
  });
}

export function useJoinHousehold() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: { inviteCode: string; displayName: string }) => {
      const { data, error } = await supabase.rpc('join_household', {
        p_invite_code: input.inviteCode,
        p_display_name: input.displayName,
      });
      if (error) throw error;
      return data as Household;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: householdKey(session?.user.id) }),
  });
}

export function useRotateInviteCode() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('rotate_invite_code');
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: householdKey(session?.user.id) }),
  });
}

export function useUpdateMyPreferences() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<HouseholdMember, 'remind_planning' | 'remind_dinner' | 'notify_partner' | 'display_name'>>) => {
      if (!session) throw new Error('Not signed in.');
      const { error, data } = await supabase.from('household_members').update(patch).eq('user_id', session.user.id).select('user_id');
      if (error) throw error;
      if (!data?.length) throw new Error('Your membership row was not found.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: householdKey(session?.user.id) }),
  });
}

export function useUpdateHouseholdSettings() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Household, 'planning_day' | 'planning_time' | 'dinner_reminder_time' | 'week_start_day' | 'name'>>) => {
      const { error, data } = await supabase.from('households').update(patch).eq('id', (await supabase.from('household_members').select('household_id').single()).data?.household_id ?? '').select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Household not found.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: householdKey(session?.user.id) }),
  });
}
