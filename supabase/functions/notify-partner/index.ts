import { createClient } from 'npm:@supabase/supabase-js@2';
import { json } from '../_shared/http.ts';

// Called by the plan_entries trigger. Verifies the change against the database
// under the service role, then pushes one message to every other household
// member who has a push token and wants partner activity. Bursts of edits in
// the same household within two minutes collapse into the first message.

const FN = 'notify-partner';
const THROTTLE_MS = 2 * 60 * 1000;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

type Payload = { type: 'INSERT' | 'UPDATE' | 'DELETE'; entry_id: string; household_id: string; actor_id: string | null; date: string; kind: string; recipe_id: string | null; label: string | null };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const requestId = crypto.randomUUID();

  let p: Payload;
  try {
    p = (await req.json()) as Payload;
    if (!p.household_id || !p.entry_id || !['INSERT', 'UPDATE', 'DELETE'].includes(p.type)) throw new Error('shape');
  } catch {
    return json({ error: 'Bad payload.' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    console.error(JSON.stringify({ fn: FN, requestId, error: 'service credentials missing' }));
    return json({ error: 'Server is misconfigured.' }, 500);
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Confirm the household exists and, for inserts/updates, that the entry is real.
  if (p.type !== 'DELETE') {
    const { data: entry } = await admin.from('plan_entries').select('id, household_id, updated_by').eq('id', p.entry_id).maybeSingle();
    if (!entry || entry.household_id !== p.household_id) return json({ skipped: 'entry not found' }, 200);
    p.actor_id = entry.updated_by ?? p.actor_id;
  }

  const [{ data: members }, { data: recent }] = await Promise.all([
    admin.from('household_members').select('user_id, display_name, expo_push_token, notify_partner').eq('household_id', p.household_id),
    admin.from('notification_log').select('created_at').eq('household_id', p.household_id).eq('kind', 'partner_activity').gte('created_at', new Date(Date.now() - THROTTLE_MS).toISOString()).limit(1),
  ]);
  if (recent?.length) return json({ skipped: 'throttled' }, 200);

  const actor = (members ?? []).find((m) => m.user_id === p.actor_id);
  const recipients = (members ?? []).filter((m) => m.user_id !== p.actor_id && m.notify_partner && m.expo_push_token);
  if (recipients.length === 0) return json({ skipped: 'no recipients' }, 200);

  let what = 'the plan';
  if (p.recipe_id) {
    const { data: r } = await admin.from('recipes').select('title').eq('id', p.recipe_id).maybeSingle();
    if (r?.title) what = r.title;
  } else if (p.kind === 'eating_out') what = 'eating out';
  else if (p.kind === 'skip') what = 'a skip night';
  const day = new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const verb = p.type === 'INSERT' ? 'added' : p.type === 'DELETE' ? 'removed' : 'changed';
  const body = `${actor?.display_name ?? 'Your partner'} ${verb} ${what} ${p.type === 'DELETE' ? 'from' : 'on'} ${day}.`;

  const messages = recipients.map((m) => ({ to: m.expo_push_token, title: 'EZ Meal', body, sound: 'default', data: { kind: 'partner_activity', date: p.date }, channelId: 'household' }));
  try {
    const res = await fetch(EXPO_PUSH, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages) });
    const result = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(JSON.stringify({ fn: FN, requestId, householdId: p.household_id, error: `expo push ${res.status}`, result }));
      return json({ error: 'Push service rejected the request.' }, 502);
    }
    // Tokens that Expo reports as no longer valid are cleared so we stop trying.
    const tickets = (result?.data ?? []) as Array<{ status: string; details?: { error?: string } }>;
    await Promise.all(
      tickets.map(async (t, i) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          await admin.from('household_members').update({ expo_push_token: null }).eq('user_id', recipients[i].user_id);
          console.warn(JSON.stringify({ fn: FN, requestId, householdId: p.household_id, warn: 'cleared stale token', user: recipients[i].user_id }));
        }
      }),
    );
    await admin.from('notification_log').insert(recipients.map((m) => ({ household_id: p.household_id, kind: 'partner_activity', recipient_user_id: m.user_id, body })));
    console.log(JSON.stringify({ fn: FN, requestId, householdId: p.household_id, sent: recipients.length }));
    return json({ sent: recipients.length }, 200);
  } catch (e) {
    console.error(JSON.stringify({ fn: FN, requestId, householdId: p.household_id, error: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'Could not reach the push service.' }, 502);
  }
});
