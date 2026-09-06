/**
 * Runs the app's own data functions against a local Supabase stack.
 *   supabase start && npm run test:integration
 * Skipped unless EZMEAL_LOCAL=1 so `npm test` stays fast and offline.
 */
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { fetchHousehold } from '@/household/useHousehold';
import { toggleGroceryFn } from '@/groceries/toggle';
import { upsertPantryFn } from '@/pantry/statusMutation';
import { rankByPantry } from '@/ideas/rank';

const URL = 'http://127.0.0.1:54321';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const run = process.env.EZMEAL_LOCAL === '1' ? describe : describe.skip;

run('household data functions (local Supabase)', () => {
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const stamp = Date.now();
  const password = 'password123';
  let ryanId = '';
  let partnerId = '';
  let inviteCode = '';

  async function signInAs(email: string) {
    await supabase.auth.signOut({ scope: 'local' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user!.id;
  }

  beforeAll(async () => {
    const mk = async (tag: string) => {
      const { data, error } = await admin.auth.admin.createUser({ email: `${tag}-${stamp}@example.com`, password, email_confirm: true });
      if (error) throw error;
      return data.user.id;
    };
    ryanId = await mk('ryan');
    partnerId = await mk('partner');
    await signInAs(`ryan-${stamp}@example.com`);
    const { data: h, error } = await supabase.rpc('create_household', { p_name: 'Test House', p_display_name: 'Ryan' });
    if (error) throw error;
    inviteCode = h.invite_code;
  });

  afterAll(async () => {
    await supabase.auth.signOut({ scope: 'local' });
  });

  it('loads the household for a lone member', async () => {
    const state = await fetchHousehold(ryanId);
    expect(state.household?.name).toBe('Test House');
    expect(state.members.map((m) => m.display_name)).toEqual(['Ryan']);
  });

  it('still loads once a partner has joined (regression: multiple rows)', async () => {
    await signInAs(`partner-${stamp}@example.com`);
    const { error } = await supabase.rpc('join_household', { p_invite_code: inviteCode, p_display_name: 'Partner' });
    expect(error).toBeNull();
    const asPartner = await fetchHousehold(partnerId);
    expect(asPartner.members).toHaveLength(2);
    await signInAs(`ryan-${stamp}@example.com`);
    const asRyan = await fetchHousehold(ryanId);
    expect(asRyan.members.map((m) => m.display_name).sort()).toEqual(['Partner', 'Ryan']);
  });

  it('checks off a grocery item and refuses a missing one', async () => {
    const { data: hh } = await supabase.from('households').select('id').single();
    const { data: item } = await supabase.from('grocery_items').insert({ household_id: hh!.id, name: 'Apples', canonical_name: 'apple', is_manual: true, store_section: 'produce' }).select('id').single();
    await expect(toggleGroceryFn({ id: item!.id, checked: true, userId: ryanId })).resolves.toBeUndefined();
    const { data: after } = await supabase.from('grocery_items').select('checked, checked_by').eq('id', item!.id).single();
    expect(after).toEqual({ checked: true, checked_by: ryanId });
    await expect(toggleGroceryFn({ id: '00000000-0000-0000-0000-000000000000', checked: true, userId: ryanId })).rejects.toThrow(/no longer on the list/);
  });

  it('upserts pantry items and feeds the pantry ranking', async () => {
    await upsertPantryFn([{ canonical_name: 'onion', display_name: 'Onion', status: 'plenty', store_section: 'produce' }]);
    const { data: pantry } = await supabase.from('pantry_items').select('canonical_name, status');
    const ranked = rankByPantry([{ id: 'r', title: 'Soup', last_cooked_at: null, recipe_ingredients: [{ canonical_name: 'onion' }, { canonical_name: 'lentil' }] }], pantry!);
    expect(ranked[0]).toMatchObject({ have: 1, total: 2, missing: ['lentil'] });
  });
});
