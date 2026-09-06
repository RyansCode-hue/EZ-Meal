-- Grocery list generation. The list is derived from uncooked recipe entries in
-- a date range, merged by grocery item and unit, then reconciled with what is
-- already on the list so checked-off and hand-added items survive regeneration.

alter table grocery_items add column note text;
alter table households
  add column grocery_start date,
  add column grocery_end date,
  add column grocery_generated_at timestamptz;

-- Generated items are unique per item+unit; manual items are free-form.
create unique index grocery_items_generated_key
  on grocery_items (household_id, canonical_name, coalesce(unit, ''))
  where not is_manual;

-- Collapses plural and long unit names so "2 tablespoons" and "1 tbsp" merge.
create or replace function normalize_unit(p text)
returns text
language plpgsql
immutable
as $$
declare
  u text := lower(trim(coalesce(p, '')));
begin
  if u = '' then return null; end if;
  return case u
    when 'cups' then 'cup' when 'c' then 'cup'
    when 'tablespoon' then 'tbsp' when 'tablespoons' then 'tbsp' when 'tbsps' then 'tbsp' when 'tbs' then 'tbsp'
    when 'teaspoon' then 'tsp' when 'teaspoons' then 'tsp' when 'tsps' then 'tsp'
    when 'ounce' then 'oz' when 'ounces' then 'oz' when 'fl oz' then 'oz'
    when 'pound' then 'lb' when 'pounds' then 'lb' when 'lbs' then 'lb'
    when 'gram' then 'g' when 'grams' then 'g' when 'kilogram' then 'kg' when 'kilograms' then 'kg'
    when 'milliliter' then 'ml' when 'milliliters' then 'ml' when 'liter' then 'l' when 'liters' then 'l'
    when 'cloves' then 'clove' when 'cans' then 'can' when 'slices' then 'slice' when 'pieces' then 'piece'
    when 'pinches' then 'pinch' when 'dashes' then 'dash' when 'bunches' then 'bunch' when 'heads' then 'head'
    when 'stalks' then 'stalk' when 'sticks' then 'stick' when 'packages' then 'package' when 'pkg' then 'package'
    when 'bags' then 'bag' when 'boxes' then 'box' when 'jars' then 'jar' when 'bottles' then 'bottle'
    else u
  end;
end;
$$;

create or replace function generate_grocery_list(p_start date, p_end date)
returns setof grocery_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household uuid := current_household_id();
begin
  if v_household is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;
  if p_end < p_start then
    raise exception 'the range ends before it starts' using errcode = '22023';
  end if;

  -- What the planned, not-yet-cooked recipes need, scaled to each entry's servings.
  create temp table needed on commit drop as
  select
    ri.canonical_name,
    normalize_unit(ri.unit) as unit,
    case when bool_and(ri.quantity is not null)
      then sum(ri.quantity * case when pe.servings is not null and r.servings is not null and r.servings > 0 then pe.servings / r.servings else 1 end)
      else null
    end as quantity,
    mode() within group (order by ri.store_section) as store_section,
    array_agg(distinct pe.id) as source_entry_ids
  from plan_entries pe
  join recipes r on r.id = pe.recipe_id
  join recipe_ingredients ri on ri.recipe_id = r.id
  where pe.household_id = v_household
    and pe.kind = 'recipe'
    and pe.cooked_at is null
    and pe.date between p_start and p_end
  group by ri.canonical_name, normalize_unit(ri.unit);

  -- Pantry items marked Plenty are not needed at all.
  delete from needed n
  using pantry_items p
  where p.household_id = v_household and p.canonical_name = n.canonical_name and p.status = 'plenty';

  -- Generated items no longer needed go, unless already checked off (they were bought).
  delete from grocery_items g
  where g.household_id = v_household
    and not g.is_manual
    and not g.checked
    and not exists (
      select 1 from needed n
      where n.canonical_name = g.canonical_name and coalesce(n.unit, '') = coalesce(g.unit, '')
    );

  -- Insert or refresh needed items. Checked state is deliberately not touched.
  insert into grocery_items (household_id, name, canonical_name, quantity, unit, store_section, is_manual, source_entry_ids, note)
  select
    v_household,
    n.canonical_name,
    n.canonical_name,
    n.quantity,
    n.unit,
    n.store_section,
    false,
    n.source_entry_ids,
    case when exists (
      select 1 from pantry_items p
      where p.household_id = v_household and p.canonical_name = n.canonical_name and p.status = 'low'
    ) then 'You have some' else null end
  from needed n
  on conflict (household_id, canonical_name, coalesce(unit, '')) where not is_manual
  do update set
    name = excluded.name,
    quantity = excluded.quantity,
    store_section = excluded.store_section,
    source_entry_ids = excluded.source_entry_ids,
    note = excluded.note;

  update households
  set grocery_start = p_start, grocery_end = p_end, grocery_generated_at = now()
  where id = v_household;

  return query
    select * from grocery_items
    where household_id = v_household
    order by store_section, checked, name;
end;
$$;

create or replace function clear_checked_groceries()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from grocery_items where household_id = current_household_id() and checked;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function normalize_unit(text) from public;
revoke all on function generate_grocery_list(date, date) from public;
revoke all on function clear_checked_groceries() from public;
grant execute on function normalize_unit(text) to authenticated;
grant execute on function generate_grocery_list(date, date) to authenticated;
grant execute on function clear_checked_groceries() to authenticated;
