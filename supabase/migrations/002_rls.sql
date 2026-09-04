-- Helper: is the caller a logged-in, non-suspended buyer?
create or replace function is_active_user()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'active'
  );
$$;

create or replace function is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and status = 'active' and role = 'admin'
  );
$$;

alter table makes               enable row level security;
alter table models              enable row level security;
alter table variants            enable row level security;
alter table categories          enable row level security;
alter table parts               enable row level security;
alter table part_fitments       enable row level security;
alter table profiles            enable row level security;
alter table favourites          enable row level security;
alter table cart_items          enable row level security;
alter table quote_requests      enable row level security;
alter table quote_request_items enable row level security;
alter table notification_log    enable row level security;
-- allowed_users already has RLS enabled in 003, with no policies.

-- Catalogue: readable by active users only.
-- This is the revocation gate. Suspending a profile empties the app for
-- that user on their next query, regardless of a still-valid token.
create policy cat_read on makes         for select to authenticated using (is_active_user());
create policy cat_read on models        for select to authenticated using (is_active_user());
create policy cat_read on variants      for select to authenticated using (is_active_user());
create policy cat_read on categories    for select to authenticated using (is_active_user());
create policy cat_read on part_fitments for select to authenticated using (is_active_user());
create policy cat_read on parts         for select to authenticated using (is_active_user() and is_active);

-- Admin write access to the catalogue
create policy cat_write on parts         for all to authenticated using (is_admin()) with check (is_admin());
create policy cat_write on part_fitments for all to authenticated using (is_admin()) with check (is_admin());
create policy cat_write on makes         for all to authenticated using (is_admin()) with check (is_admin());
create policy cat_write on models        for all to authenticated using (is_admin()) with check (is_admin());
create policy cat_write on variants      for all to authenticated using (is_admin()) with check (is_admin());

-- Profiles: read and limited update of own row only
create policy own_read   on profiles for select to authenticated using (id = auth.uid());
create policy own_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Favourites and cart: full control of own rows
create policy own_favs on favourites for all to authenticated
  using (user_id = auth.uid() and is_active_user())
  with check (user_id = auth.uid() and is_active_user());

create policy own_cart on cart_items for all to authenticated
  using (user_id = auth.uid() and is_active_user())
  with check (user_id = auth.uid() and is_active_user());

-- Requests: insert and read own. No update, no delete — an audit trail.
create policy own_req_insert on quote_requests for insert to authenticated
  with check (user_id = auth.uid() and is_active_user());
create policy own_req_read on quote_requests for select to authenticated
  using (user_id = auth.uid());

create policy own_item_insert on quote_request_items for insert to authenticated
  with check (exists (
    select 1 from quote_requests r
    where r.id = quote_request_id and r.user_id = auth.uid()
  ));
create policy own_item_read on quote_request_items for select to authenticated
  using (exists (
    select 1 from quote_requests r
    where r.id = quote_request_id and r.user_id = auth.uid()
  ));

-- notification_log: no client access. Service role only.
