-- Planner operations. Positions within a day are assigned server-side so two
-- phones adding at the same moment cannot collide. All functions run as the
-- caller (security invoker) so RLS still applies.

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

  insert into plan_entries (household_id, date, position, kind, recipe_id, label, servings)
  values (
    v_household,
    p_date,
    coalesce((select max(position) + 1 from plan_entries where household_id = v_household and date = p_date), 0),
    p_kind,
    case when p_kind = 'recipe' then p_recipe_id else null end,
    nullif(trim(coalesce(p_label, '')), ''),
    p_servings
  )
  returning * into v_row;
  return v_row;
end;
$$;

-- Sets the order of one day's entries. Ids not on that day are ignored.
create or replace function reorder_plan_day(p_date date, p_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update plan_entries p
  set position = i.ord - 1
  from unnest(p_ids) with ordinality as i(id, ord)
  where p.id = i.id
    and p.household_id = current_household_id()
    and p.date = p_date;
$$;

-- Moves an entry to the end of another day.
create or replace function move_plan_entry(p_id uuid, p_date date)
returns plan_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household uuid := current_household_id();
  v_row plan_entries;
begin
  update plan_entries
  set date = p_date,
      position = coalesce((select max(position) + 1 from plan_entries where household_id = v_household and date = p_date and id <> p_id), 0)
  where id = p_id and household_id = v_household
  returning * into v_row;
  if v_row.id is null then
    raise exception 'plan entry not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Marks an entry cooked or not, and keeps recipes.last_cooked_at equal to the
-- latest cooked entry for that recipe.
create or replace function set_plan_entry_cooked(p_id uuid, p_cooked boolean)
returns plan_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household uuid := current_household_id();
  v_row plan_entries;
begin
  update plan_entries
  set cooked_at = case when p_cooked then now() else null end,
      cooked_by = case when p_cooked then auth.uid() else null end
  where id = p_id and household_id = v_household
  returning * into v_row;
  if v_row.id is null then
    raise exception 'plan entry not found' using errcode = 'P0002';
  end if;

  if v_row.recipe_id is not null then
    update recipes
    set last_cooked_at = (
      select max(cooked_at) from plan_entries
      where recipe_id = v_row.recipe_id and household_id = v_household and cooked_at is not null
    )
    where id = v_row.recipe_id and household_id = v_household;
  end if;
  return v_row;
end;
$$;

revoke all on function add_plan_entry(date, plan_entry_kind, uuid, text, numeric) from public;
revoke all on function reorder_plan_day(date, uuid[]) from public;
revoke all on function move_plan_entry(uuid, date) from public;
revoke all on function set_plan_entry_cooked(uuid, boolean) from public;
grant execute on function add_plan_entry(date, plan_entry_kind, uuid, text, numeric) to authenticated;
grant execute on function reorder_plan_day(date, uuid[]) to authenticated;
grant execute on function move_plan_entry(uuid, date) to authenticated;
grant execute on function set_plan_entry_cooked(uuid, boolean) to authenticated;
