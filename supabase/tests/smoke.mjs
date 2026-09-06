// Smoke test for households, invite flow, and RLS isolation.
// Run against a local stack: `supabase start` then `npm run test:db`.
// Creates throwaway users; never point it at production.
import { createClient } from '@supabase/supabase-js';
const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// Defaults are the public demo keys every local Supabase stack ships with.
const ANON = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const stamp = Date.now();
const EMAIL_DOMAIN = process.env.SMOKE_EMAIL_DOMAIN ?? 'example.com';
// Sign-ups are closed in config.toml, so test users are created with the admin API.
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
let failures = 0;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`); if (!ok) failures++; }

async function user(tag) {
  const email = `${tag}-${stamp}@${EMAIL_DOMAIN}`;
  const { error: createErr } = await admin.auth.admin.createUser({ email, password: 'password123', email_confirm: true });
  if (createErr) throw createErr;
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: 'password123' });
  if (error) throw error;
  if (!data.session) throw new Error('no session after sign-in');
  return c;
}

// Public sign-up must be refused: the app is invitation only.
{
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signUp({ email: `walkin-${stamp}@${EMAIL_DOMAIN}`, password: 'password123' });
  check('public sign-up is disabled', error?.code === 'signup_disabled', error?.message ?? 'sign-up succeeded');
}

const ryan = await user('ryan');
const partner = await user('partner');
const stranger = await user('stranger');

// No household yet
{
  const { data, error } = await ryan.from('household_members').select('household_id').maybeSingle();
  check('fresh user has no membership', !error && data === null, error?.message);
}

// Create
const { data: hh, error: cErr } = await ryan.rpc('create_household', { p_name: 'Test House', p_display_name: 'Ryan' });
check('create_household returns household', !cErr && hh?.invite_code?.length === 8, cErr?.message ?? JSON.stringify(hh));

// Cannot create a second one
{
  const { error } = await ryan.rpc('create_household', { p_name: 'Again', p_display_name: 'Ryan' });
  check('second create_household rejected', error?.code === '23505', error?.message);
}

// Join with bad code
{
  const { error } = await partner.rpc('join_household', { p_invite_code: 'NOPE0000', p_display_name: 'P' });
  check('join with unknown code rejected', error?.code === 'P0002', error?.message);
}

// Join with real code, lowercase and padded to test normalization
{
  const { data, error } = await partner.rpc('join_household', { p_invite_code: `  ${hh.invite_code.toLowerCase()} `, p_display_name: 'Partner' });
  check('join_household with valid code', !error && data?.id === hh.id, error?.message);
}

// Both see two members
{
  const { data, error } = await partner.from('household_members').select('display_name').order('display_name');
  check('partner sees both members', !error && data?.length === 2, error?.message ?? JSON.stringify(data));
}

// Stranger sees nothing
{
  const { data: h } = await stranger.from('households').select('id');
  const { data: m } = await stranger.from('household_members').select('user_id');
  check('stranger sees no households or members', h?.length === 0 && m?.length === 0);
}

// Ryan inserts a recipe; partner sees it; stranger does not; stranger cannot insert into it
const { data: recipe, error: rErr } = await ryan.from('recipes').insert({ household_id: hh.id, title: 'Tacos', servings: 4 }).select().single();
check('member inserts recipe', !rErr && recipe?.title === 'Tacos', rErr?.message);
{
  const { data } = await partner.from('recipes').select('title');
  check('partner reads recipe', data?.length === 1 && data[0].title === 'Tacos');
}
{
  const { data } = await stranger.from('recipes').select('title');
  check('stranger reads no recipes', data?.length === 0);
}
{
  const { error } = await stranger.from('recipes').insert({ household_id: hh.id, title: 'Sneaky' });
  check('stranger cannot insert into other household', !!error, error?.message);
}
{
  const { data, error } = await stranger.from('recipes').update({ title: 'Hacked' }).eq('id', recipe.id).select();
  check('stranger update affects zero rows', !error && data?.length === 0, error?.message);
}

// updated_at trigger
{
  const before = recipe.updated_at;
  await new Promise((r) => setTimeout(r, 20));
  const { data } = await ryan.from('recipes').update({ title: 'Street tacos' }).eq('id', recipe.id).select().single();
  check('updated_at advances on update', new Date(data.updated_at) > new Date(before));
}

// Rotate invite code
{
  const { data: code, error } = await partner.rpc('rotate_invite_code');
  const { data: fresh } = await ryan.from('households').select('invite_code').single();
  check('rotate_invite_code changes code for whole household', !error && code !== hh.invite_code && fresh.invite_code === code, error?.message);
}
{
  const { error } = await stranger.rpc('rotate_invite_code');
  check('stranger cannot rotate', error?.code === '42501', error?.message);
}

// Storage: member can upload into own household folder, stranger cannot
{
  const blob = new Blob(['x'], { type: 'image/png' });
  const { error } = await ryan.storage.from('recipe-photos').upload(`${hh.id}/test.png`, blob, { contentType: 'image/png' });
  check('member uploads to household folder', !error, error?.message);
  const { error: sErr } = await stranger.storage.from('recipe-photos').upload(`${hh.id}/evil.png`, blob, { contentType: 'image/png' });
  check('stranger cannot upload to household folder', !!sErr, sErr?.message);
  const { data: list } = await stranger.storage.from('recipe-photos').list(hh.id);
  check('stranger lists nothing in household folder', (list ?? []).length === 0);
}

// save_recipe: atomic insert/replace of a recipe with children
let savedId = null;
{
  const { data, error } = await ryan.rpc('save_recipe', {
    p_recipe: { title: '  Chili  ', servings: 6, prep_minutes: 15, tags: ['Quick', ' weeknight ', ''], source_type: 'paste' },
    p_ingredients: [
      { quantity: 2, unit: 'lb', name: 'ground beef', canonical_name: 'ground beef', store_section: 'meat_seafood' },
      { quantity: 1, unit: null, name: 'Onion', preparation: 'diced' },
      { name: '   ' },
    ],
    p_steps: [{ text: 'Brown the beef.' }, { text: '' }, { text: 'Simmer.' }],
  });
  savedId = data;
  check('save_recipe inserts and returns id', !error && typeof data === 'string', error?.message);
  const { data: r } = await ryan.from('recipes').select('title, tags, source_type, recipe_ingredients(position, name, canonical_name, store_section), recipe_steps(position, text)').eq('id', savedId).single();
  check('save_recipe trims title and normalizes tags', r?.title === 'Chili' && JSON.stringify(r?.tags) === '["quick","weeknight"]', JSON.stringify(r));
  const ings = (r?.recipe_ingredients ?? []).sort((a, b) => a.position - b.position);
  check('blank ingredient dropped, defaults applied', ings.length === 2 && ings[1].canonical_name === 'onion' && ings[1].store_section === 'other' && ings[0].store_section === 'meat_seafood', JSON.stringify(ings));
  check('blank step dropped, order kept', (r?.recipe_steps ?? []).length === 2 && r.recipe_steps.find((s) => s.position === 1)?.text === 'Simmer.', JSON.stringify(r?.recipe_steps));
}
{
  const { data, error } = await partner.rpc('save_recipe', {
    p_recipe: { id: savedId, title: 'Chili (edited)', servings: 8 },
    p_ingredients: [{ quantity: 3, unit: 'lb', name: 'ground beef' }],
    p_steps: [{ text: 'One step.' }],
  });
  const { data: r } = await ryan.from('recipes').select('title, recipe_ingredients(id), recipe_steps(id)').eq('id', savedId).single();
  check('partner updates recipe, children replaced', !error && data === savedId && r?.title === 'Chili (edited)' && r.recipe_ingredients.length === 1 && r.recipe_steps.length === 1, error?.message ?? JSON.stringify(r));
}
{
  const { error } = await stranger.rpc('save_recipe', { p_recipe: { id: savedId, title: 'Hijacked' }, p_ingredients: [], p_steps: [] });
  const { data: r } = await ryan.from('recipes').select('title').eq('id', savedId).single();
  check('stranger cannot overwrite another household recipe', !!error && r?.title === 'Chili (edited)', error?.message);
}
{
  const { error } = await ryan.rpc('save_recipe', { p_recipe: { title: '   ' }, p_ingredients: [], p_steps: [] });
  check('save_recipe rejects blank title', error?.code === '22023', error?.message);
}
{
  const { error } = await partner.from('recipe_ratings').upsert({ household_id: hh.id, recipe_id: savedId, user_id: (await partner.auth.getUser()).data.user.id, rating: 4, notes: 'More cumin' }, { onConflict: 'recipe_id,user_id' });
  const { data: r } = await ryan.from('recipes').select('recipe_ratings(user_id, rating, notes)').eq('id', savedId).single();
  check('rating upsert visible to partner via embed', !error && r?.recipe_ratings?.length === 1 && r.recipe_ratings[0].rating === 4, error?.message ?? JSON.stringify(r));
}

// Planner RPCs
{
  const { data: a, error: e1 } = await ryan.rpc('add_plan_entry', { p_date: '2026-09-07', p_kind: 'recipe', p_recipe_id: savedId, p_servings: 4 });
  const { data: b, error: e2 } = await partner.rpc('add_plan_entry', { p_date: '2026-09-07', p_kind: 'eating_out' });
  const { data: c, error: e3 } = await ryan.rpc('add_plan_entry', { p_date: '2026-09-07', p_kind: 'skip' });
  check('add_plan_entry assigns positions in order', !e1 && !e2 && !e3 && a.position === 0 && b.position === 1 && c.position === 2, [e1, e2, e3].map((e) => e?.message).join(' '));
  const { error: e4 } = await ryan.rpc('add_plan_entry', { p_date: '2026-09-07', p_kind: 'recipe' });
  check('recipe entry without recipe rejected', e4?.code === '22023', e4?.message);
  const { error: e5 } = await stranger.rpc('add_plan_entry', { p_date: '2026-09-07', p_kind: 'recipe', p_recipe_id: savedId });
  check('stranger cannot plan another household recipe', !!e5, e5?.message);

  const { error: e6 } = await partner.rpc('reorder_plan_day', { p_date: '2026-09-07', p_ids: [c.id, a.id, b.id] });
  const { data: day } = await ryan.from('plan_entries').select('id, position').eq('date', '2026-09-07').order('position');
  check('reorder_plan_day applies new order', !e6 && day.map((d) => d.id).join() === [c.id, a.id, b.id].join(), e6?.message ?? JSON.stringify(day));

  const { data: moved, error: e7 } = await ryan.rpc('move_plan_entry', { p_id: b.id, p_date: '2026-09-08' });
  check('move_plan_entry changes date and starts at 0', !e7 && moved.date === '2026-09-08' && moved.position === 0, e7?.message);
  const { error: e8 } = await stranger.rpc('move_plan_entry', { p_id: a.id, p_date: '2026-09-09' });
  check('stranger cannot move an entry', e8?.code === 'P0002', e8?.message);

  const { data: cooked, error: e9 } = await partner.rpc('set_plan_entry_cooked', { p_id: a.id, p_cooked: true });
  const { data: rec } = await ryan.from('recipes').select('last_cooked_at').eq('id', savedId).single();
  check('set_plan_entry_cooked stamps entry and recipe', !e9 && cooked.cooked_at && rec.last_cooked_at === cooked.cooked_at, e9?.message ?? JSON.stringify({ cooked, rec }));
  const { error: e10 } = await ryan.rpc('set_plan_entry_cooked', { p_id: a.id, p_cooked: false });
  const { data: rec2 } = await ryan.from('recipes').select('last_cooked_at').eq('id', savedId).single();
  check('un-cooking clears recipe last_cooked_at when no other cooked entries', !e10 && rec2.last_cooked_at === null, e10?.message ?? JSON.stringify(rec2));

  const { data: withRecipe } = await partner.from('plan_entries').select('id, kind, recipe:recipes(title)').eq('id', a.id).single();
  check('plan entry embeds recipe', withRecipe?.recipe?.title === 'Chili (edited)', JSON.stringify(withRecipe));
}

// Grocery generation
{
  const mk = async (title, servings, ings) => {
    const { data, error } = await ryan.rpc('save_recipe', { p_recipe: { title, servings }, p_ingredients: ings, p_steps: [{ text: 'Cook.' }] });
    if (error) throw error;
    return data;
  };
  const chiliId = await mk('Test chili', 4, [
    { quantity: 2, unit: 'lb', name: 'ground beef', canonical_name: 'ground beef', store_section: 'meat_seafood' },
    { quantity: 1, unit: null, name: 'yellow onion', canonical_name: 'onion', store_section: 'produce' },
    { quantity: 2, unit: 'tbsp', name: 'olive oil', canonical_name: 'olive oil', store_section: 'pantry' },
    { quantity: null, unit: null, name: 'salt', canonical_name: 'salt', store_section: 'spices' },
  ]);
  const soupId = await mk('Test soup', 2, [
    { quantity: 1, unit: null, name: 'onion', canonical_name: 'onion', store_section: 'produce' },
    { quantity: 1, unit: 'tablespoon', name: 'olive oil', canonical_name: 'olive oil', store_section: 'pantry' },
  ]);
  const { data: e1 } = await ryan.rpc('add_plan_entry', { p_date: '2026-09-10', p_kind: 'recipe', p_recipe_id: chiliId, p_servings: 8 });
  const { data: e2 } = await ryan.rpc('add_plan_entry', { p_date: '2026-09-11', p_kind: 'recipe', p_recipe_id: soupId, p_servings: 2 });
  await ryan.rpc('add_plan_entry', { p_date: '2026-09-20', p_kind: 'recipe', p_recipe_id: soupId, p_servings: 2 }); // outside range

  const byName = (rows) => Object.fromEntries(rows.filter((r) => !r.is_manual).map((r) => [r.canonical_name + '|' + (r.unit ?? ''), r]));
  const { data: g1, error: gErr } = await partner.rpc('generate_grocery_list', { p_start: '2026-09-09', p_end: '2026-09-13' });
  const m1 = byName(g1 ?? []);
  check('generate merges, scales, and normalizes units', !gErr && Number(m1['ground beef|lb']?.quantity) === 4 && Number(m1['onion|']?.quantity) === 3 && Number(m1['olive oil|tbsp']?.quantity) === 5 && m1['salt|']?.quantity === null, gErr?.message ?? JSON.stringify(Object.keys(m1)));
  check('generate records range on household', (await ryan.from('households').select('grocery_start, grocery_end').single()).data?.grocery_start === '2026-09-09');

  await ryan.from('grocery_items').update({ checked: true }).eq('id', m1['onion|'].id);
  await ryan.from('grocery_items').insert({ household_id: hh.id, name: 'Paper towels', canonical_name: 'paper towels', is_manual: true, store_section: 'household' });
  await ryan.from('plan_entries').delete().eq('id', e2.id);
  const { data: g2 } = await ryan.rpc('generate_grocery_list', { p_start: '2026-09-09', p_end: '2026-09-13' });
  const m2 = byName(g2 ?? []);
  check('regenerate keeps checked item, updates quantities, keeps manual item', m2['onion|']?.checked === true && Number(m2['onion|'].quantity) === 2 && Number(m2['olive oil|tbsp']?.quantity) === 4 && g2.some((r) => r.is_manual && r.name === 'Paper towels'), JSON.stringify(g2?.map((r) => [r.name, r.quantity, r.checked])));

  await ryan.rpc('set_plan_entry_cooked', { p_id: e1.id, p_cooked: true });
  const { data: g3 } = await ryan.rpc('generate_grocery_list', { p_start: '2026-09-09', p_end: '2026-09-13' });
  const m3 = byName(g3 ?? []);
  check('cooked entry drops unchecked items, checked item survives', !m3['ground beef|lb'] && !m3['olive oil|tbsp'] && m3['onion|']?.checked === true, JSON.stringify(Object.keys(m3)));

  await ryan.rpc('set_plan_entry_cooked', { p_id: e1.id, p_cooked: false });
  await ryan.from('pantry_items').insert([
    { household_id: hh.id, canonical_name: 'ground beef', display_name: 'Ground beef', status: 'plenty' },
    { household_id: hh.id, canonical_name: 'olive oil', display_name: 'Olive oil', status: 'low' },
  ]);
  const { data: g4 } = await ryan.rpc('generate_grocery_list', { p_start: '2026-09-09', p_end: '2026-09-13' });
  const m4 = byName(g4 ?? []);
  check('pantry plenty skips item, pantry low adds note', !m4['ground beef|lb'] && m4['olive oil|tbsp']?.note === 'You have some', JSON.stringify(g4?.map((r) => [r.name, r.note])));

  const { data: cleared, error: cErr } = await partner.rpc('clear_checked_groceries');
  const { data: g5 } = await ryan.from('grocery_items').select('canonical_name, checked');
  check('clear_checked_groceries removes checked only', !cErr && cleared === 1 && !g5.some((r) => r.checked) && g5.length >= 2, cErr?.message ?? JSON.stringify(g5));
  const { data: gs } = await stranger.rpc('generate_grocery_list', { p_start: '2026-09-09', p_end: '2026-09-13' });
  check('stranger generate is rejected or empty', !gs || gs.length === 0);
}

// Pantry upsert
{
  const { data: up, error } = await ryan.rpc('upsert_pantry_items', { p_items: [
    { canonical_name: 'Garlic', display_name: 'Garlic', status: 'low', quantity: 1, unit: 'head', store_section: 'produce' },
    { canonical_name: 'olive oil', status: 'plenty' },   // exists from earlier (low) -> plenty, keeps display name
    { canonical_name: '  ' },
  ] });
  const { data: rows } = await partner.from('pantry_items').select('canonical_name, display_name, status, store_section, quantity').in('canonical_name', ['garlic', 'olive oil']).order('canonical_name');
  check('upsert_pantry_items inserts, updates, skips blanks', !error && up.length === 2 && rows.find((r) => r.canonical_name === 'garlic')?.store_section === 'produce' && rows.find((r) => r.canonical_name === 'olive oil')?.status === 'plenty' && rows.find((r) => r.canonical_name === 'olive oil')?.display_name === 'Olive oil', error?.message ?? JSON.stringify(rows));
  const { data: up2 } = await ryan.rpc('upsert_pantry_items', { p_items: [{ canonical_name: 'garlic', status: 'out' }] });
  check('upsert keeps section and quantity when omitted', up2?.[0]?.store_section === 'produce' && Number(up2?.[0]?.quantity) === 1 && up2?.[0]?.status === 'out', JSON.stringify(up2));
  const { error: sErr } = await stranger.rpc('upsert_pantry_items', { p_items: [{ canonical_name: 'x' }] });
  check('stranger cannot upsert pantry', sErr?.code === '42501', sErr?.message);
}

// Reminders: actor stamping, member preferences, settings table locked down
{
  const { data: e } = await ryan.rpc('add_plan_entry', { p_date: '2026-10-01', p_kind: 'skip' });
  const me = (await ryan.auth.getUser()).data.user.id;
  check('plan entry stamps updated_by with the actor', e?.updated_by === me, JSON.stringify(e));
  const { data: moved } = await partner.rpc('move_plan_entry', { p_id: e.id, p_date: '2026-10-02' });
  const partnerId = (await partner.auth.getUser()).data.user.id;
  check('update restamps updated_by', moved?.updated_by === partnerId, JSON.stringify(moved));
  const { error: prefErr } = await ryan.from('household_members').update({ remind_dinner: false, push_platform: 'android', expo_push_token: 'ExponentPushToken[test]' }).eq('user_id', me);
  const { data: pref } = await partner.from('household_members').select('remind_dinner, push_platform').eq('user_id', me).single();
  check('member updates own reminder prefs and token', !prefErr && pref?.remind_dinner === false && pref?.push_platform === 'android', prefErr?.message ?? JSON.stringify(pref));
  const { error: otherErr, data: otherRows } = await ryan.from('household_members').update({ remind_dinner: false }).eq('user_id', partnerId).select();
  check('member cannot edit partner prefs', (otherRows ?? []).length === 0, otherErr?.message ?? 'updated ' + (otherRows ?? []).length);
  const { data: cfg } = await ryan.from('app_settings').select('*');
  check('app_settings hidden from members', (cfg ?? []).length === 0);
  const { data: log } = await ryan.from('notification_log').select('id');
  check('notification_log readable (empty locally)', Array.isArray(log));
}

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
