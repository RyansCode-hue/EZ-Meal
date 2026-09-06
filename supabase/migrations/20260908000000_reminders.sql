-- Reminders. Planning and dinner reminders are scheduled on each phone from the
-- member's own preferences. Partner activity is a push from the server: a
-- trigger on plan changes asks the notify-partner function to tell the other
-- members. The function re-reads the change under the service role before
-- sending, so a forged call can at most repeat a real notification.

create extension if not exists pg_net with schema extensions;

alter table household_members
  add column remind_planning boolean not null default true,
  add column remind_dinner boolean not null default true,
  add column notify_partner boolean not null default true,
  add column push_platform text check (push_platform in ('android', 'ios'));

-- Who last touched a plan entry, so the partner (not the actor) gets notified.
alter table plan_entries add column updated_by uuid references auth.users(id) on delete set null;

create or replace function stamp_plan_entry_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by = auth.uid();
  return new;
end;
$$;
create trigger plan_entries_stamp_actor before insert or update on plan_entries
  for each row execute function stamp_plan_entry_actor();

-- Where the trigger posts. Kept in a table so local and hosted can differ.
create table app_settings (
  key text primary key,
  value text not null
);
alter table app_settings enable row level security;
-- No policies: only the postgres role (migrations, triggers) reads this.
insert into app_settings (key, value) values ('functions_url', 'https://lvirhpcptrayietwtoie.supabase.co/functions/v1');

-- One row per notification sent, used to throttle bursts (many edits in a row
-- become one message) and for debugging.
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kind text not null,
  recipient_user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index notification_log_household_idx on notification_log(household_id, created_at desc);
alter table notification_log enable row level security;
create policy "members read their notifications" on notification_log
  for select to authenticated using (household_id = current_household_id());

create or replace function notify_partner_of_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_row plan_entries;
begin
  v_row := coalesce(new, old);
  select value into v_url from app_settings where key = 'functions_url';
  if v_url is null then
    return null;
  end if;
  perform net.http_post(
    url := v_url || '/notify-partner',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', tg_op,
      'entry_id', v_row.id,
      'household_id', v_row.household_id,
      'actor_id', coalesce(new.updated_by, auth.uid()),
      'date', v_row.date,
      'kind', v_row.kind,
      'recipe_id', v_row.recipe_id,
      'label', v_row.label
    ),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

create trigger plan_entries_notify_partner after insert or update or delete on plan_entries
  for each row execute function notify_partner_of_plan_change();
