-- Atomic recipe save. Inserts or updates the recipe row and replaces its
-- ingredients and steps in one transaction, so a failure part-way through never
-- leaves a recipe with half its ingredients. Runs as the caller (security
-- invoker): RLS on every table still applies.

create or replace function save_recipe(p_recipe jsonb, p_ingredients jsonb, p_steps jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_household uuid := current_household_id();
  v_id uuid;
  v_title text := trim(coalesce(p_recipe->>'title', ''));
begin
  if v_household is null then
    raise exception 'not a member of a household' using errcode = '42501';
  end if;
  if v_title = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;

  v_id := coalesce(nullif(p_recipe->>'id', '')::uuid, gen_random_uuid());

  insert into recipes (
    id, household_id, title, description, photo_path, prep_minutes, cook_minutes,
    servings, cuisine, tags, source_type, source_url, nutrition, created_by
  ) values (
    v_id,
    v_household,
    v_title,
    nullif(trim(coalesce(p_recipe->>'description', '')), ''),
    nullif(p_recipe->>'photo_path', ''),
    nullif(p_recipe->>'prep_minutes', '')::integer,
    nullif(p_recipe->>'cook_minutes', '')::integer,
    nullif(p_recipe->>'servings', '')::numeric,
    nullif(trim(coalesce(p_recipe->>'cuisine', '')), ''),
    coalesce(
      (select array_agg(lower(trim(t))) from jsonb_array_elements_text(coalesce(p_recipe->'tags', '[]'::jsonb)) t where trim(t) <> ''),
      '{}'::text[]
    ),
    coalesce(nullif(p_recipe->>'source_type', ''), 'manual')::recipe_source,
    nullif(p_recipe->>'source_url', ''),
    nullif(p_recipe->'nutrition', 'null'::jsonb),
    auth.uid()
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    photo_path = excluded.photo_path,
    prep_minutes = excluded.prep_minutes,
    cook_minutes = excluded.cook_minutes,
    servings = excluded.servings,
    cuisine = excluded.cuisine,
    tags = excluded.tags,
    source_type = excluded.source_type,
    source_url = excluded.source_url,
    nutrition = excluded.nutrition;

  -- The conflict path is governed by the RLS update policy; if the id belongs to
  -- another household the update is refused and this check fails closed.
  if not exists (select 1 from recipes where id = v_id and household_id = v_household) then
    raise exception 'recipe not found' using errcode = 'P0002';
  end if;

  delete from recipe_ingredients where recipe_id = v_id;
  insert into recipe_ingredients (
    household_id, recipe_id, position, quantity, unit, name, preparation, canonical_name, store_section
  )
  select
    v_household,
    v_id,
    row_number() over (order by ord) - 1,
    nullif(i->>'quantity', '')::numeric,
    nullif(trim(coalesce(i->>'unit', '')), ''),
    trim(i->>'name'),
    nullif(trim(coalesce(i->>'preparation', '')), ''),
    coalesce(nullif(trim(coalesce(i->>'canonical_name', '')), ''), lower(trim(i->>'name'))),
    coalesce(nullif(i->>'store_section', ''), 'other')::store_section
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) with ordinality as t(i, ord)
  where trim(coalesce(i->>'name', '')) <> '';

  delete from recipe_steps where recipe_id = v_id;
  insert into recipe_steps (household_id, recipe_id, position, text)
  select v_household, v_id, row_number() over (order by ord) - 1, trim(s->>'text')
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) with ordinality as t(s, ord)
  where trim(coalesce(s->>'text', '')) <> '';

  return v_id;
end;
$$;

revoke all on function save_recipe(jsonb, jsonb, jsonb) from public;
grant execute on function save_recipe(jsonb, jsonb, jsonb) to authenticated;
