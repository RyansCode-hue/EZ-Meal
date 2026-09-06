-- Pantry: items carry a store section for grouping, and a bulk upsert lets the
-- receipt reader and the mark-cooked sheet apply many changes in one call.

alter table pantry_items add column store_section store_section not null default 'other';

-- Each item: { canonical_name, display_name?, status?, quantity?, unit?, store_section? }.
-- Existing rows keep any field the payload omits. Returns the affected rows.
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

  -- Existing items: only the fields present in the payload change.
  update pantry_items p
  set display_name = coalesce(nullif(trim(coalesce(i->>'display_name', '')), ''), p.display_name),
      status = coalesce(nullif(i->>'status', '')::pantry_status, p.status),
      quantity = coalesce(nullif(i->>'quantity', '')::numeric, p.quantity),
      unit = coalesce(nullif(trim(coalesce(i->>'unit', '')), ''), p.unit),
      store_section = coalesce(nullif(i->>'store_section', '')::store_section, p.store_section)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where p.household_id = v_household
    and p.canonical_name = lower(trim(coalesce(i->>'canonical_name', '')));

  -- New items.
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
