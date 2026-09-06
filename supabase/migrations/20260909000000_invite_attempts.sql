-- Attempt log for redeem-invite, which is reachable without a session. It lets
-- the function refuse more than a handful of tries per hour from one address.
create table invite_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index invite_attempts_ip_idx on invite_attempts(ip, created_at desc);
alter table invite_attempts enable row level security;
-- No policies: only the service role touches this table.
