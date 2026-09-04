-- ─────────────────────────────────────────────────────────────
-- 003_auth_hook.sql
--
-- Gates account creation against an allowlist SSG controls.
-- Handles BOTH identifiers so dev (email) and production (phone) work
-- from the same table with no schema change at cutover.
--
-- NOTE: this supersedes the allowed_users definition in 001_schema.sql.
-- Replace that table with this one before pushing.
-- ─────────────────────────────────────────────────────────────

drop table if exists allowed_users cascade;

create table allowed_users (
  id            bigserial primary key,
  phone         text unique,          -- digits only, e.g. 923001234567
  email         text unique,          -- lowercase
  business_name text not null,
  contact_name  text,
  city          text,
  role          text not null default 'buyer' check (role in ('buyer','admin')),
  added_by      text,
  created_at    timestamptz default now(),
  -- At least one identifier is required.
  constraint has_identifier check (phone is not null or email is not null)
);

alter table allowed_users enable row level security;
-- Deliberately NO policies. Only the hook (security definer) and the
-- service role can read this table.

-- ── The gate ─────────────────────────────────────────────────
create or replace function hook_restrict_signup(event jsonb)
returns jsonb language plpgsql security definer
set search_path = public as $$
declare
  in_email text;
  in_phone text;
  ok       boolean := false;
begin
  in_email := lower(nullif(trim(event -> 'user' ->> 'email'), ''));
  in_phone := nullif(regexp_replace(
                coalesce(event -> 'user' ->> 'phone', ''), '[^0-9]', '', 'g'
              ), '');

  if in_phone is not null then
    select true into ok from allowed_users where phone = in_phone limit 1;
  end if;

  if not ok and in_email is not null then
    select true into ok from allowed_users where email = in_email limit 1;
  end if;

  if not coalesce(ok, false) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'NOT_REGISTERED'
    ));
  end if;

  return '{}'::jsonb;
end $$;

grant execute on function hook_restrict_signup(jsonb) to supabase_auth_admin;
revoke execute on function hook_restrict_signup(jsonb) from authenticated, anon, public;
grant select on allowed_users to supabase_auth_admin;

-- ── Profile creation on first sign-in ────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  in_email text;
  in_phone text;
  a        allowed_users;
begin
  in_email := lower(nullif(trim(new.email), ''));
  in_phone := nullif(regexp_replace(coalesce(new.phone,''), '[^0-9]', '', 'g'), '');

  select * into a from allowed_users
  where (in_phone is not null and phone = in_phone)
     or (in_email is not null and email = in_email)
  limit 1;

  insert into profiles (id, phone, email, business_name, contact_name, city, role)
  values (
    new.id,
    coalesce(in_phone, a.phone),
    coalesce(in_email, a.email),
    a.business_name,
    a.contact_name,
    a.city,
    coalesce(a.role, 'buyer')
  );

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Also add an email column to profiles in 001_schema.sql ───
--   email text,
