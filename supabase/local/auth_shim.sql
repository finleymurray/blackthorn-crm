-- ===========================================================================
-- LOCAL DEVELOPMENT ONLY.
-- Supabase ships an `auth` schema, the `auth.uid()` function and the
-- anon / authenticated / service_role roles. A plain Postgres database does
-- not, so `npm run db:migrate` applies this file first when it detects that
-- `auth.uid()` is missing. It is never applied to a real Supabase project.
-- ===========================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  encrypted_password text,
  created_at timestamptz default now()
);

create or replace function auth.uid()
returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;

create or replace function auth.role()
returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant anon, authenticated, service_role to current_user;
