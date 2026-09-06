import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { json } from './http.ts';

export type Caller = {
  supabase: SupabaseClient;
  userId: string;
  householdId: string;
};

// Verifies the caller's session with the Auth server and confirms household
// membership. Returns a Response (401/403/500) when the caller is not allowed.
// The client acts as the caller, so any query it runs is still bound by RLS.
export async function requireHouseholdMember(req: Request, fn: string, requestId: string): Promise<Caller | Response> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Sign in to use this feature.' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !anonKey) {
    console.error(JSON.stringify({ fn, requestId, error: 'SUPABASE_URL or anon key missing from function env' }));
    return json({ error: 'Server is misconfigured.' }, 500);
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return json({ error: 'Your session has expired. Sign in again.' }, 401);
  }

  const { data: householdId, error: hErr } = await supabase.rpc('current_household_id');
  if (hErr) {
    console.error(JSON.stringify({ fn, requestId, userId: user.id, error: hErr.message }));
    return json({ error: 'Could not check your household.' }, 500);
  }
  if (!householdId) {
    return json({ error: 'Join a household first.' }, 403);
  }

  return { supabase, userId: user.id, householdId: householdId as string };
}
