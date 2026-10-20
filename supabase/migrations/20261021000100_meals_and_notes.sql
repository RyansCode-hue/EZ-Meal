-- Named meals on the plan, and household notes the meal assistant keeps.

create or replace function add_plan_entry(
  p_date date,
  p_kind plan_entry_kind,
  p_recipe_id uuid default null,
  p_label text default null,
  p_servings numeric default null
)
returns plan_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household uuid := current_household_id();
  v_label text := nullif(trim(coalesce(p_label, '')), '');
  v_row plan_entries;
begin
  if v_household is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;
  if p_kind = 'recipe' and p_recipe_id is null then
    raise exception 'recipe entries need a recipe' using errcode = '22023';
  end if;
  if p_kind = 'recipe' and not exists (select 1 from recipes where id = p_recipe_id and household_id = v_household) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;
  if p_kind = 'meal' and v_label is null then
    raise exception 'name the meal' using errcode = '22023';
  end if;
  if length(v_label) > 80 then
    raise exception 'keep the name under 80 characters' using errcode = '22023';
  end if;

  insert into plan_entries (household_id, date, position, kind, recipe_id, label, servings)
  values (
    v_household,
    p_date,
    coalesce((select max(position) + 1 from plan_entries where household_id = v_household and date = p_date), 0),
    p_kind,
    case when p_kind = 'recipe' then p_recipe_id else null end,
    v_label,
    p_servings
  )
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function add_plan_entry(date, plan_entry_kind, uuid, text, numeric) from public;
grant execute on function add_plan_entry(date, plan_entry_kind, uuid, text, numeric) to authenticated;

-- Lasting facts about the household's tastes ("Does not like spicy food"),
-- added by hand or saved by the assistant from what someone said in chat.
-- Every Ideas chat reads them.
create table household_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  text text not null check (length(trim(text)) between 1 and 200),
  source text not null default 'manual' check (source in ('manual', 'chat')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index household_notes_household on household_notes (household_id, created_at);

alter table household_notes enable row level security;
create policy "members manage household notes" on household_notes for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

grant select, insert, update, delete on household_notes to authenticated;
grant all on household_notes to service_role;

alter publication supabase_realtime add table household_notes;
