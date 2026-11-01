-- Allow invite-only self-registration: check allowlist without exposing the table.

create or replace function check_signup_eligibility(p_identifier text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  raw          text := trim(coalesce(p_identifier, ''));
  norm_email   text := lower(raw);
  norm_phone   text;
  on_list      boolean := false;
  registered   boolean := false;
begin
  if raw = '' then
    return json_build_object('status', 'not_on_list');
  end if;

  norm_phone := nullif(regexp_replace(raw, '[^0-9]', '', 'g'), '');
  if norm_phone is not null and norm_phone like '0%' then
    norm_phone := '92' || substring(norm_phone from 2);
  elsif norm_phone is not null and norm_phone !~ '^92' then
    norm_phone := '92' || norm_phone;
  end if;

  select exists (
    select 1 from allowed_users a
    where (norm_email <> '' and a.email is not null and lower(a.email) = norm_email)
       or (norm_phone is not null and a.phone is not null and a.phone = norm_phone)
  ) into on_list;

  if not on_list then
    return json_build_object('status', 'not_on_list');
  end if;

  select exists (
    select 1 from profiles p
    where (norm_email <> '' and p.email is not null and lower(p.email) = norm_email)
       or (norm_phone is not null and p.phone is not null and p.phone = norm_phone)
  ) into registered;

  if registered then
    return json_build_object('status', 'already_registered');
  end if;

  return json_build_object('status', 'eligible');
end;
$$;

revoke all on function check_signup_eligibility(text) from public;
grant execute on function check_signup_eligibility(text) to anon, authenticated;
