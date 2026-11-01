-- Admin dashboard aggregates (catalogue, buyers, quote requests). Admin-only.

create or replace function get_admin_analytics()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result json;
begin
  if not is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select json_build_object(
    'catalogue', json_build_object(
      'activeParts', (select count(*)::int from parts where is_active),
      'inactiveParts', (select count(*)::int from parts where not is_active),
      'distinctMakes', (
        select count(distinct make_name)::int from parts
        where is_active and make_name is not null and btrim(make_name) <> ''
      ),
      'distinctBrands', (
        select count(distinct brand)::int from parts
        where is_active and brand is not null and btrim(brand) <> ''
      ),
      'topMakes', coalesce((
        select json_agg(row_to_json(s) order by s.count desc, s.label)
        from (
          select make_name as label, count(*)::int as count
          from parts
          where is_active and make_name is not null and btrim(make_name) <> ''
          group by make_name
          order by count(*) desc, make_name
          limit 12
        ) s
      ), '[]'::json),
      'topGroups', coalesce((
        select json_agg(row_to_json(s) order by s.count desc, s.label)
        from (
          select group_name as label, count(*)::int as count
          from parts
          where is_active and group_name is not null and btrim(group_name) <> ''
          group by group_name
          order by count(*) desc, group_name
          limit 12
        ) s
      ), '[]'::json),
      'topBrands', coalesce((
        select json_agg(row_to_json(s) order by s.count desc, s.label)
        from (
          select brand as label, count(*)::int as count
          from parts
          where is_active and brand is not null and btrim(brand) <> ''
          group by brand
          order by count(*) desc, brand
          limit 12
        ) s
      ), '[]'::json),
      'topOrigins', coalesce((
        select json_agg(row_to_json(s) order by s.count desc, s.label)
        from (
          select origin as label, count(*)::int as count
          from parts
          where is_active and origin is not null and btrim(origin) <> ''
          group by origin
          order by count(*) desc, origin
          limit 8
        ) s
      ), '[]'::json)
    ),
    'users', json_build_object(
      'activeBuyers', (
        select count(*)::int from profiles
        where role = 'buyer' and status = 'active'
      ),
      'allowlistedBuyers', (
        select count(*)::int from allowed_users where role = 'buyer'
      ),
      'byCity', coalesce((
        select json_agg(row_to_json(s) order by s.count desc, s.label)
        from (
          select coalesce(nullif(btrim(city), ''), '__unset__') as label, count(*)::int as count
          from profiles
          where role = 'buyer' and status = 'active'
          group by 1
          order by count(*) desc, label
          limit 15
        ) s
      ), '[]'::json),
      'registeredWithCity', (
        select count(*)::int from profiles
        where role = 'buyer' and status = 'active'
          and city is not null and btrim(city) <> ''
      )
    ),
    'engagement', json_build_object(
      'favourites', (select count(*)::int from favourites),
      'cartLines', (select count(*)::int from cart_items),
      'quoteRequestsTotal', (select count(*)::int from quote_requests),
      'quoteRequestsLast30Days', (
        select count(*)::int from quote_requests
        where created_at >= (now() - interval '30 days')
      ),
      'quoteIndicativeTotalPkr', coalesce((
        select sum(total_pkr)::numeric from quote_requests
      ), 0),
      'recentQuotes', coalesce((
        select json_agg(row_to_json(s) order by s.created_at desc)
        from (
          select
            qr.reference,
            qr.created_at,
            qr.item_count,
            qr.total_pkr,
            coalesce(nullif(btrim(p.city), ''), nullif(btrim(p.business_name), ''), '__unset__') as buyer_label
          from quote_requests qr
          left join profiles p on p.id = qr.user_id
          order by qr.created_at desc nulls last
          limit 10
        ) s
      ), '[]'::json)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function get_admin_analytics() from public;
grant execute on function get_admin_analytics() to authenticated;
