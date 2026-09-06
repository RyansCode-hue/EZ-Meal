import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@^4.0.0';
import { json, preflight } from '../_shared/http.ts';

// Creates an account and joins it to the household in one step, gated on a
// valid invite code. Public sign-up stays closed at the Supabase level; this is
// the only door, and it opens only with a code the household handed out.

const FN = 'redeem-invite';
const MAX_ATTEMPTS_PER_HOUR = 10;

const Input = z.object({
  invite_code: z.string().trim().min(6).max(12),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  display_name: z.string().trim().min(1).max(40),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const requestId = crypto.randomUUID();

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    console.error(JSON.stringify({ fn: FN, requestId, error: 'service credentials missing' }));
    return json({ error: 'Server is misconfigured.' }, 500);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown').split(',')[0].trim();

  // Throttle before doing anything else.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from('invite_attempts').select('id', { count: 'exact', head: true }).eq('ip', ip).eq('succeeded', false).gte('created_at', since);
  if ((count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
    console.warn(JSON.stringify({ fn: FN, requestId, warn: 'throttled', ip }));
    return json({ error: 'Too many attempts. Wait an hour and try again.' }, 429);
  }
  const recordAttempt = (succeeded: boolean) => admin.from('invite_attempts').insert({ ip, succeeded });

  let input: z.infer<typeof Input>;
  try {
    input = Input.parse(await req.json());
  } catch {
    await recordAttempt(false);
    return json({ error: 'Check the fields: a valid email, a password of at least 8 characters, your name, and the invite code.' }, 400);
  }

  const { data: household } = await admin.from('households').select('id, name').eq('invite_code', input.invite_code.toUpperCase()).maybeSingle();
  if (!household) {
    await recordAttempt(false);
    return json({ error: 'That invite code was not found. Check it with the person who sent it.' }, 404);
  }

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.display_name },
  });
  if (cErr || !created.user) {
    await recordAttempt(false);
    const already = /already|exists|registered/i.test(cErr?.message ?? '');
    if (already) return json({ error: 'That email already has an account. Sign in, then join with the invite code.' }, 409);
    console.error(JSON.stringify({ fn: FN, requestId, error: cErr?.message ?? 'no user returned' }));
    return json({ error: 'Could not create the account. Try again.' }, 500);
  }

  const { error: mErr } = await admin.from('household_members').insert({ household_id: household.id, user_id: created.user.id, display_name: input.display_name });
  if (mErr) {
    // Do not leave an orphan account the person cannot use.
    await admin.auth.admin.deleteUser(created.user.id);
    await recordAttempt(false);
    console.error(JSON.stringify({ fn: FN, requestId, error: `membership: ${mErr.message}` }));
    return json({ error: 'The account was not created because joining the household failed. Try again.' }, 500);
  }

  await recordAttempt(true);
  console.log(JSON.stringify({ fn: FN, requestId, householdId: household.id, userId: created.user.id }));
  return json({ ok: true, household: household.name });
});
