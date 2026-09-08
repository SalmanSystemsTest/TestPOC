-- Admin can add buyers by phone + name only. Buyers complete shop,
-- address, and city on first login. Admins may manage the allowlist.

alter table allowed_users
  alter column business_name drop not null;

alter table profiles
  add column if not exists address text;

drop policy if exists admin_allowed_select on allowed_users;
drop policy if exists admin_allowed_insert on allowed_users;
drop policy if exists admin_allowed_update on allowed_users;

create policy admin_allowed_select on allowed_users
  for select to authenticated using (is_admin());
create policy admin_allowed_insert on allowed_users
  for insert to authenticated with check (is_admin());
create policy admin_allowed_update on allowed_users
  for update to authenticated using (is_admin()) with check (is_admin());

create or replace function protect_profile_privileges()
returns trigger language plpgsql as $$
begin
  if not is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_privileges on profiles;
create trigger protect_profile_privileges
  before update on profiles
  for each row execute function protect_profile_privileges();

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports',
  'imports',
  false,
  10485760,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do nothing;

drop policy if exists admin_imports_insert on storage.objects;
drop policy if exists admin_imports_select on storage.objects;

create policy admin_imports_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports' and public.is_admin());

create policy admin_imports_select on storage.objects
  for select to authenticated
  using (bucket_id = 'imports' and public.is_admin());
