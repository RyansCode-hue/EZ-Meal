-- Explicit table privileges. Hosted projects do not necessarily grant anon or
-- authenticated anything on public tables, and the app never reads data as anon,
-- so privileges are stated here rather than inherited from project defaults.
-- Row Level Security (see the init migration) still scopes every row to the
-- caller's household; these grants only open the door to the tables at all.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- Fail closed for unauthenticated callers.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
