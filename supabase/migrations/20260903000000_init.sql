-- EZ Meal initial schema.
-- Every household-owned table carries household_id and is protected by RLS that
-- compares it to the caller's household. A user belongs to exactly one household.

-- Supabase keeps extensions in their own schema, which is not on the search path
-- during migrations. Every call into pgcrypto is schema-qualified for that reason.
create extension if not exists pgcrypto with schema extensions;

create or replace function generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
$$;

create type store_section as enum (
  'produce', 'meat_seafood', 'dairy_eggs', 'bakery', 'frozen', 'pantry',
  'spices', 'canned_jarred', 'beverages', 'household', 'other'
);
create type recipe_source as enum ('manual', 'paste', 'url', 'photo', 'ai');
create type plan_entry_kind as enum ('recipe', 'eating_out', 'skip');
create type pantry_status as enum ('plenty', 'low', 'out');

-- ---------------------------------------------------------------------------
-- Households and membership
-- ---------------------------------------------------------------------------

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default generate_invite_code(),
  week_start_day smallint not null default 0 check (week_start_day between 0 and 6),
  planning_day smallint not null default 6 check (planning_day between 0 and 6),
  planning_time time not null default '10:00',
  dinner_reminder_time time not null default '15:00',
  units text not null default 'imperial' check (units in ('imperial', 'metric')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  expo_push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
-- One household per user. Relax this index if multi-household support is ever added.
create unique index household_members_user_id_idx on household_members(user_id);

-- The caller's household. SECURITY DEFINER so RLS policies can call it without
-- recursing into household_members' own policy.
create or replace function current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid() limit 1;
$$;
revoke all on function current_household_id() from public;
grant execute on function current_household_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create table recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  photo_path text,
  prep_minutes integer check (prep_minutes >= 0),
  cook_minutes integer check (cook_minutes >= 0),
  servings numeric(6,2) check (servings > 0),
  cuisine text,
  tags text[] not null default '{}',
  source_type recipe_source not null default 'manual',
  source_url text,
  nutrition jsonb,
  created_by uuid references auth.users(id) on delete set null,
  last_cooked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipes_household_idx on recipes(household_id);
create index recipes_tags_idx on recipes using gin(tags);

create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  position integer not null,
  quantity numeric(10,3),
  unit text,
  name text not null,
  preparation text,
  canonical_name text not null,
  store_section store_section not null default 'other',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipe_ingredients_recipe_idx on recipe_ingredients(recipe_id, position);

create table recipe_steps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  position integer not null,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recipe_steps_recipe_idx on recipe_steps(recipe_id, position);

create table recipe_ratings (
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Plan
-- ---------------------------------------------------------------------------

create table plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  position integer not null default 0,
  kind plan_entry_kind not null,
  recipe_id uuid references recipes(id) on delete cascade,
  label text,
  servings numeric(6,2) check (servings > 0),
  cooked_at timestamptz,
  cooked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plan_entry_recipe_required check (
    (kind = 'recipe' and recipe_id is not null) or (kind <> 'recipe')
  )
);
create index plan_entries_household_date_idx on plan_entries(household_id, date, position);

-- ---------------------------------------------------------------------------
-- Groceries and pantry
-- ---------------------------------------------------------------------------

create table grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  canonical_name text not null,
  quantity numeric(10,3),
  unit text,
  store_section store_section not null default 'other',
  checked boolean not null default false,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  is_manual boolean not null default false,
  source_entry_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index grocery_items_household_idx on grocery_items(household_id, store_section);

create table pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  canonical_name text not null,
  display_name text not null,
  status pantry_status not null default 'plenty',
  quantity numeric(10,3),
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, canonical_name)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'households', 'household_members', 'recipes', 'recipe_ingredients', 'recipe_steps',
    'recipe_ratings', 'plan_entries', 'grocery_items', 'pantry_items'
  ] loop
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table household_members enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_steps enable row level security;
alter table recipe_ratings enable row level security;
alter table plan_entries enable row level security;
alter table grocery_items enable row level security;
alter table pantry_items enable row level security;

create policy "members read their household" on households
  for select to authenticated using (id = current_household_id());
create policy "members update their household" on households
  for update to authenticated using (id = current_household_id()) with check (id = current_household_id());

create policy "members read household members" on household_members
  for select to authenticated using (household_id = current_household_id());
create policy "members update their own row" on household_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members leave household" on household_members
  for delete to authenticated using (user_id = auth.uid());

-- Household-scoped tables all get the same four policies.
do $$
declare t text;
begin
  foreach t in array array[
    'recipes', 'recipe_ingredients', 'recipe_steps', 'recipe_ratings',
    'plan_entries', 'grocery_items', 'pantry_items'
  ] loop
    execute format('create policy "household select" on %I for select to authenticated using (household_id = current_household_id())', t);
    execute format('create policy "household insert" on %I for insert to authenticated with check (household_id = current_household_id())', t);
    execute format('create policy "household update" on %I for update to authenticated using (household_id = current_household_id()) with check (household_id = current_household_id())', t);
    execute format('create policy "household delete" on %I for delete to authenticated using (household_id = current_household_id())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Household creation and joining.
-- Inserts into households and household_members go through these functions so a
-- user can never insert a membership row for a household they were not invited to.
-- ---------------------------------------------------------------------------

create or replace function create_household(p_name text, p_display_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'already a member of a household' using errcode = '23505';
  end if;
  insert into households (name) values (trim(p_name)) returning * into h;
  insert into household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), trim(p_display_name));
  return h;
end;
$$;

create or replace function join_household(p_invite_code text, p_display_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if exists (select 1 from household_members where user_id = auth.uid()) then
    raise exception 'already a member of a household' using errcode = '23505';
  end if;
  select * into h from households where invite_code = upper(trim(p_invite_code));
  if not found then
    raise exception 'invite code not found' using errcode = 'P0002';
  end if;
  insert into household_members (household_id, user_id, display_name)
    values (h.id, auth.uid(), trim(p_display_name));
  return h;
end;
$$;

create or replace function rotate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  update households
    set invite_code = generate_invite_code()
    where id = current_household_id()
    returning invite_code into new_code;
  if new_code is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;
  return new_code;
end;
$$;

revoke all on function create_household(text, text) from public;
revoke all on function join_household(text, text) from public;
revoke all on function rotate_invite_code() from public;
grant execute on function create_household(text, text) to authenticated;
grant execute on function join_household(text, text) to authenticated;
grant execute on function rotate_invite_code() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime and storage
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table plan_entries, grocery_items, pantry_items, recipes;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Objects are stored under <household_id>/<file>. Members may only touch their own folder.
create policy "household photos select" on storage.objects
  for select to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = current_household_id()::text);
create policy "household photos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = current_household_id()::text);
create policy "household photos update" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = current_household_id()::text);
create policy "household photos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = current_household_id()::text);
