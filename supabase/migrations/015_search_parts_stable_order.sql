-- Stable pagination: tie-break on primary key so offset/limit never repeat rows.

create or replace function search_parts(
  p_query text default null,
  p_make int default null,
  p_model int default null,
  p_variant int default null,
  p_category int default null,
  p_limit int default 20,
  p_offset int default 0,
  p_make_name text default null,
  p_group_name text default null,
  p_sub_group_name text default null,
  p_brand text default null,
  p_cat_model text default null,
  p_item_model text default null
) returns setof parts language sql security invoker stable as $$
  select p.* from parts p
  where p.is_active
    and (p_category is null or p.category_id = p_category)
    and (p_make_name is null or p.make_name = p_make_name)
    and (p_group_name is null or p.group_name = p_group_name)
    and (p_sub_group_name is null or p.sub_group_name = p_sub_group_name)
    and (p_brand is null or p.brand = p_brand)
    and (p_cat_model is null or p.cat_model = p_cat_model)
    and (p_item_model is null or p.item_model = p_item_model)
    and (
      p_query is null
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
    and (
      p_make is null
      or exists (
        select 1 from part_fitments f
        where f.part_id = p.id
          and f.make_id = p_make
          and (f.model_id is null or p_model is null or f.model_id = p_model)
          and (f.variant_id is null or p_variant is null or f.variant_id = p_variant)
      )
    )
  order by p.name, p.id
  limit p_limit offset p_offset;
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
  order by p.name, p.id
  limit p_limit offset p_offset;
$$;
