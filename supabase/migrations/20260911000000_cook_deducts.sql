-- Marking a recipe cooked subtracts its scaled ingredient amounts from pantry
-- items that track an amount in the same unit. What was taken is recorded per
-- entry so un-cooking puts back exactly that, even after a clamp at zero.
-- Items are never removed: an amount that reaches zero stays as Out.

create table cook_deductions (
  plan_entry_id uuid not null references plan_entries(id) on delete cascade,
  pantry_item_id uuid not null references pantry_items(id) on delete cascade,
  quantity numeric(10,3) not null,
  primary key (plan_entry_id, pantry_item_id)
);

alter table cook_deductions enable row level security;
create policy "household members read deductions" on cook_deductions for select
  using (exists (select 1 from plan_entries pe where pe.id = plan_entry_id and pe.household_id = current_household_id()));
create policy "household members write deductions" on cook_deductions for all
  using (exists (select 1 from plan_entries pe where pe.id = plan_entry_id and pe.household_id = current_household_id()))
  with check (exists (select 1 from plan_entries pe where pe.id = plan_entry_id and pe.household_id = current_household_id()));
grant select, insert, update, delete on cook_deductions to authenticated;

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

  -- Cooking: take the scaled amount from matching items, floor at zero.
  if p_cooked and not v_was_cooked and v_row.recipe_id is not null then
    insert into cook_deductions (plan_entry_id, pantry_item_id, quantity)
    select v_row.id, p.id, least(p.quantity, sum(ri.quantity * factor.f))
    from recipe_ingredients ri
    join recipes r on r.id = ri.recipe_id
    cross join lateral (select case when v_row.servings is not null and r.servings is not null and r.servings > 0 then v_row.servings / r.servings else 1 end as f) factor
    join pantry_items p on p.household_id = v_household and p.canonical_name = ri.canonical_name
    where ri.recipe_id = v_row.recipe_id
      and ri.quantity is not null
      and p.quantity is not null
      and coalesce(normalize_unit(ri.unit), '') = coalesce(normalize_unit(p.unit), '')
    group by p.id, p.quantity
    having least(p.quantity, sum(ri.quantity * factor.f)) > 0;

    update pantry_items p
    set quantity = p.quantity - d.quantity,
        status = case when p.quantity - d.quantity <= 0 then 'out'::pantry_status else p.status end
    from cook_deductions d
    where d.plan_entry_id = v_row.id and d.pantry_item_id = p.id;
  end if;

  -- Un-cooking: put back what was taken.
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
