-- Hierarchical catalogue browse: cascading filter options and multi-select search.

create or replace function get_hierarchical_catalogue_options(
  p_makes text[] default null,
  p_groups text[] default null,
  p_sub_groups text[] default null
) returns json language sql security invoker stable as $$
  select json_build_object(
    'makes', coalesce((
      select json_agg(x order by x)
      from (
        select distinct make_name as x
        from parts
        where is_active and make_name is not null and btrim(make_name) <> ''
      ) s
    ), '[]'::json),
    'groups', coalesce((
      select json_agg(x order by x)
      from (
        select distinct group_name as x
        from parts
        where is_active
          and group_name is not null and btrim(group_name) <> ''
          and p_makes is not null and cardinality(p_makes) > 0
          and make_name = any(p_makes)
      ) s
    ), '[]'::json),
    'subGroups', coalesce((
      select json_agg(x order by x)
      from (
        select distinct sub_group_name as x
        from parts
        where is_active
          and sub_group_name is not null and btrim(sub_group_name) <> ''
          and p_makes is not null and cardinality(p_makes) > 0
          and make_name = any(p_makes)
          and p_groups is not null and cardinality(p_groups) > 0
          and group_name = any(p_groups)
      ) s
    ), '[]'::json),
    'brands', coalesce((
      select json_agg(x order by x)
      from (
        select distinct brand as x
        from parts
        where is_active
          and brand is not null and btrim(brand) <> ''
          and p_makes is not null and cardinality(p_makes) > 0
          and make_name = any(p_makes)
          and p_groups is not null and cardinality(p_groups) > 0
          and group_name = any(p_groups)
          and p_sub_groups is not null and cardinality(p_sub_groups) > 0
          and sub_group_name = any(p_sub_groups)
      ) s
    ), '[]'::json)
  );
$$;

create or replace function search_parts_catalogue(
  p_query text default null,
  p_make_names text[] default null,
  p_group_names text[] default null,
  p_sub_group_names text[] default null,
  p_brands text[] default null,
  p_limit int default 20,
  p_offset int default 0
) returns setof parts language sql security invoker stable as $$
  select p.* from parts p
  where p.is_active
    and (
      p_make_names is null or cardinality(p_make_names) = 0
      or p.make_name = any(p_make_names)
    )
    and (
      p_group_names is null or cardinality(p_group_names) = 0
      or p.group_name = any(p_group_names)
    )
    and (
      p_sub_group_names is null or cardinality(p_sub_group_names) = 0
      or p.sub_group_name = any(p_sub_group_names)
    )
    and (
      p_brands is null or cardinality(p_brands) = 0
      or p.brand = any(p_brands)
    )
    and (
      p_query is null or btrim(p_query) = ''
      or position(lower(p_query) in lower(p.name)) > 0
      or position(lower(p_query) in lower(coalesce(p.name_ur, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.brand, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.oem_number, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.master_pn, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.child_pn, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.make_name, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.item_model, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.cat_model, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.sub_group_name, ''))) > 0
    )
  order by p.name
  limit p_limit offset p_offset;
$$;

grant execute on function get_hierarchical_catalogue_options(text[], text[], text[]) to authenticated;
grant execute on function search_parts_catalogue(text, text[], text[], text[], text[], int, int) to authenticated;
