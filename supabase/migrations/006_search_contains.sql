-- Partial (contains) catalogue search. Token matching on search_vector
-- missed OEM fragments and incomplete brand names. Matching is
-- case-insensitive substring across name, Urdu name, brand, OEM, and SKU.

create or replace function search_parts(
  p_query text default null,
  p_make int default null,
  p_model int default null,
  p_variant int default null,
  p_category int default null,
  p_limit int default 20,
  p_offset int default 0
) returns setof parts language sql security invoker stable as $$
  select distinct p.* from parts p
  left join part_fitments f on f.part_id = p.id
  where p.is_active
    and (p_category is null or p.category_id = p_category)
    and (
      p_query is null
      or position(lower(p_query) in lower(p.name)) > 0
      or position(lower(p_query) in lower(coalesce(p.name_ur, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.brand, ''))) > 0
      or position(lower(p_query) in lower(coalesce(p.oem_number, ''))) > 0
      or position(lower(p_query) in lower(p.sku)) > 0
    )
    and (p_make is null or (
      f.make_id = p_make
      and (f.model_id is null   or p_model is null   or f.model_id = p_model)
      and (f.variant_id is null or p_variant is null or f.variant_id = p_variant)
    ))
  order by p.name
  limit p_limit offset p_offset;
$$;
