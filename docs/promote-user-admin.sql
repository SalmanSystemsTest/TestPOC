-- Run in Supabase → SQL Editor (once per user).
-- Then sign out in the app and sign in again so profile role refreshes.

update allowed_users
set role = 'admin'
where lower(email) = lower('buyer@ssgtest.com');

update profiles
set role = 'admin'
where lower(email) = lower('buyer@ssgtest.com');

select email, role from profiles where lower(email) = lower('buyer@ssgtest.com');
