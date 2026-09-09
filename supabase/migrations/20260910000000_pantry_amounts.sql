-- Pantry amounts: an item's quantity and unit can now be cleared, and the
-- grocery note for a Low item says how much is on hand.

-- Each item: { canonical_name, display_name?, status?, quantity?, unit?, store_section? }.
-- Existing rows keep any key the payload omits; a key sent as null or "" clears
-- quantity and unit (name, status, and section never become blank).
create or replace function upsert_pantry_items(p_items jsonb)
returns setof pantry_items
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

  update pantry_items p
  set display_name = coalesce(nullif(trim(coalesce(i->>'display_name', '')), ''), p.display_name),
      status = coalesce(nullif(i->>'status', '')::pantry_status, p.status),
      quantity = case when i ? 'quantity' then nullif(i->>'quantity', '')::numeric else p.quantity end,
      unit = case when i ? 'unit' then nullif(trim(coalesce(i->>'unit', '')), '') else p.unit end,
      store_section = coalesce(nullif(i->>'store_section', '')::store_section, p.store_section)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where p.household_id = v_household
    and p.canonical_name = lower(trim(coalesce(i->>'canonical_name', '')));

  insert into pantry_items (household_id, canonical_name, display_name, status, quantity, unit, store_section)
  select
    v_household,
    lower(trim(i->>'canonical_name')),
    coalesce(nullif(trim(coalesce(i->>'display_name', '')), ''), initcap(trim(i->>'canonical_name'))),
    coalesce(nullif(i->>'status', ''), 'plenty')::pantry_status,
    nullif(i->>'quantity', '')::numeric,
    nullif(trim(coalesce(i->>'unit', '')), ''),
    coalesce(nullif(i->>'store_section', ''), 'other')::store_section
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where trim(coalesce(i->>'canonical_name', '')) <> ''
    and not exists (
      select 1 from pantry_items p where p.household_id = v_household and p.canonical_name = lower(trim(i->>'canonical_name'))
    );

  return query
  select * from pantry_items p
  where p.household_id = v_household
    and p.canonical_name in (select lower(trim(coalesce(i->>'canonical_name', ''))) from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i)
  order by p.store_section, p.display_name;
end;
$$;

revoke all on function upsert_pantry_items(jsonb) from public;
grant execute on function upsert_pantry_items(jsonb) to authenticated;

-- "2.500" -> "2.5", "3.000" -> "3". Null when there is no quantity.
create or replace function format_amount(p_quantity numeric, p_unit text)
returns text
language sql
immutable
as $$
  select nullif(concat_ws(' ',
    case when p_quantity is not null then rtrim(rtrim(p_quantity::text, '0'), '.') end,
    nullif(trim(coalesce(p_unit, '')), '')
  ), '');
$$;

revoke all on function format_amount(numeric, text) from public;
grant execute on function format_amount(numeric, text) to authenticated;

-- Same as before except the Low note reads "You have 2 lb" when an amount is tracked.
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

  delete from needed n
  using pantry_items p
  where p.household_id = v_household and p.canonical_name = n.canonical_name and p.status = 'plenty';

  delete from grocery_items g
  where g.household_id = v_household
    and not g.is_manual
    and not g.checked
    and not exists (
      select 1 from needed n
      where n.canonical_name = g.canonical_name and coalesce(n.unit, '') = coalesce(g.unit, '')
    );

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
    (
      select 'You have ' || coalesce(format_amount(p.quantity, p.unit), 'some')
      from pantry_items p
      where p.household_id = v_household and p.canonical_name = n.canonical_name and p.status = 'low'
      limit 1
    )
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

revoke all on function generate_grocery_list(date, date) from public;
grant execute on function generate_grocery_list(date, date) to authenticated;
