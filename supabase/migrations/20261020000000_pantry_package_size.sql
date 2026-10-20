-- Container sizes: an item counted in boxes, cans, bottles, or plain count can
-- record how much each one holds. Cooking converts recipe amounts into the
-- pantry's unit (lb <-> oz, cup <-> gallon) or into containers via that size.

alter table pantry_items
  add column package_quantity numeric(10,3) check (package_quantity is null or package_quantity > 0),
  add column package_unit text;

-- Plural forms for the volume units the app offers as chips.
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
    when 'gallons' then 'gallon' when 'quarts' then 'quart' when 'pints' then 'pint'
    when 'cloves' then 'clove' when 'cans' then 'can' when 'slices' then 'slice' when 'pieces' then 'piece'
    when 'pinches' then 'pinch' when 'dashes' then 'dash' when 'bunches' then 'bunch' when 'heads' then 'head'
    when 'stalks' then 'stalk' when 'sticks' then 'stick' when 'packages' then 'package' when 'pkg' then 'package'
    when 'bags' then 'bag' when 'boxes' then 'box' when 'jars' then 'jar' when 'bottles' then 'bottle'
    else u
  end;
end;
$$;

-- Weight in grams, volume in milliliters. "oz" is weight; normalize_unit folds
-- "fl oz" into it, so fluid ounces convert as weight. Mirrors src/groceries/units.ts.
create or replace function unit_measure(p_unit text)
returns table (dimension text, factor numeric)
language sql
immutable
as $$
  select t.d, t.f
  from (values
    ('oz', 'weight', 28.349523125), ('lb', 'weight', 453.59237), ('g', 'weight', 1.0), ('kg', 'weight', 1000.0),
    ('tsp', 'volume', 4.92892159375), ('tbsp', 'volume', 14.78676478125), ('cup', 'volume', 236.5882365),
    ('pint', 'volume', 473.176473), ('quart', 'volume', 946.352946), ('gallon', 'volume', 3785.411784),
    ('ml', 'volume', 1.0), ('l', 'volume', 1000.0)
  ) t(u, d, f)
  where t.u = normalize_unit(p_unit);
$$;

-- Null when the units are not the same and not in the same dimension.
create or replace function convert_quantity(p_quantity numeric, p_from text, p_to text)
returns numeric
language sql
immutable
as $$
  select case
    when p_quantity is null then null
    when coalesce(normalize_unit(p_from), '') = coalesce(normalize_unit(p_to), '') then p_quantity
    else (select p_quantity * a.factor / b.factor from unit_measure(p_from) a, unit_measure(p_to) b where a.dimension = b.dimension)
  end;
$$;

revoke all on function unit_measure(text) from public;
revoke all on function convert_quantity(numeric, text, text) from public;
grant execute on function unit_measure(text) to authenticated;
grant execute on function convert_quantity(numeric, text, text) to authenticated;

-- Same key semantics as before: an omitted key keeps the stored value, a key sent
-- as null or "" clears quantity, unit, package_quantity, and package_unit.
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
      package_quantity = case when i ? 'package_quantity' then nullif(i->>'package_quantity', '')::numeric else p.package_quantity end,
      package_unit = case when i ? 'package_unit' then nullif(trim(coalesce(i->>'package_unit', '')), '') else p.package_unit end,
      store_section = coalesce(nullif(i->>'store_section', '')::store_section, p.store_section)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where p.household_id = v_household
    and p.canonical_name = lower(trim(coalesce(i->>'canonical_name', '')));

  insert into pantry_items (household_id, canonical_name, display_name, status, quantity, unit, package_quantity, package_unit, store_section)
  select
    v_household,
    lower(trim(i->>'canonical_name')),
    coalesce(nullif(trim(coalesce(i->>'display_name', '')), ''), initcap(trim(i->>'canonical_name'))),
    coalesce(nullif(i->>'status', ''), 'plenty')::pantry_status,
    nullif(i->>'quantity', '')::numeric,
    nullif(trim(coalesce(i->>'unit', '')), ''),
    nullif(i->>'package_quantity', '')::numeric,
    nullif(trim(coalesce(i->>'package_unit', '')), ''),
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

-- Cooking now takes recipe amounts in any convertible unit: first into the
-- pantry item's own unit, otherwise into containers via package size.
create or replace function set_plan_entry_cooked(p_id uuid, p_cooked boolean)
returns plan_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household uuid := current_household_id();
  v_was_cooked boolean;
  v_row plan_entries;
begin
  select cooked_at is not null into v_was_cooked from plan_entries where id = p_id and household_id = v_household;

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

  if p_cooked and not v_was_cooked and v_row.recipe_id is not null then
    insert into cook_deductions (plan_entry_id, pantry_item_id, quantity)
    select v_row.id, x.id, least(x.quantity, sum(x.take))
    from (
      select p.id, p.quantity,
        coalesce(
          convert_quantity(ri.quantity * factor.f, ri.unit, p.unit),
          case when p.package_quantity > 0
            then convert_quantity(ri.quantity * factor.f, ri.unit, p.package_unit) / p.package_quantity
          end
        ) as take
      from recipe_ingredients ri
      join recipes r on r.id = ri.recipe_id
      cross join lateral (select case when v_row.servings is not null and r.servings is not null and r.servings > 0 then v_row.servings / r.servings else 1 end as f) factor
      join pantry_items p on p.household_id = v_household and p.canonical_name = ri.canonical_name
      where ri.recipe_id = v_row.recipe_id
        and ri.quantity is not null
        and p.quantity is not null
    ) x
    where x.take is not null
    group by x.id, x.quantity
    having least(x.quantity, sum(x.take)) > 0;

    update pantry_items p
    set quantity = p.quantity - d.quantity,
        status = case when p.quantity - d.quantity <= 0 then 'out'::pantry_status else p.status end
    from cook_deductions d
    where d.plan_entry_id = v_row.id and d.pantry_item_id = p.id;
  end if;

  if not p_cooked and v_was_cooked then
    update pantry_items p
    set quantity = p.quantity + d.quantity,
        status = case when p.status = 'out' and p.quantity + d.quantity > 0 then 'low'::pantry_status else p.status end
    from cook_deductions d
    where d.plan_entry_id = v_row.id and d.pantry_item_id = p.id;
    delete from cook_deductions where plan_entry_id = v_row.id;
  end if;

  return v_row;
end;
$$;

revoke all on function set_plan_entry_cooked(uuid, boolean) from public;
grant execute on function set_plan_entry_cooked(uuid, boolean) to authenticated;
