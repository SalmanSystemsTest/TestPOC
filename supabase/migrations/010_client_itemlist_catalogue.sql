-- Client catalogue (ItemList_App): denormalised vehicle and group fields on parts,
-- no buyer-facing price requirement, search/filter on Excel columns.

alter table parts
  add column if not exists master_pn text,
  add column if not exists child_pn text,
  add column if not exists default_uom text,
  add column if not exists make_name text,
  add column if not exists item_model text,
  add column if not exists cat_model text,
  add column if not exists model_g text,
  add column if not exists group_name text,
  add column if not exists sub_group_name text,
  add column if not exists origin text;

alter table parts alter column price_pkr drop not null;
alter table parts alter column price_pkr set default null;

-- Rebuild search_vector to match client columns (sku kept for admin/import only).
alter table parts drop column if exists search_vector;

alter table parts add column search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(name,'') || ' ' ||
      coalesce(name_ur,'') || ' ' ||
      coalesce(brand,'') || ' ' ||
      coalesce(oem_number,'') || ' ' ||
      coalesce(master_pn,'') || ' ' ||
      coalesce(child_pn,'') || ' ' ||
      coalesce(make_name,'') || ' ' ||
      coalesce(item_model,'') || ' ' ||
      coalesce(cat_model,'') || ' ' ||
      coalesce(model_g,'') || ' ' ||
      coalesce(group_name,'') || ' ' ||
      coalesce(sub_group_name,'') || ' ' ||
      coalesce(origin,'')
    )
  ) stored;

create index if not exists parts_search_idx on parts using gin (search_vector);
create index if not exists parts_make_idx on parts (make_name) where is_active;
create index if not exists parts_group_idx on parts (group_name, sub_group_name) where is_active;
create index if not exists parts_brand_idx on parts (brand) where is_active;

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
  order by p.name
  limit p_limit offset p_offset;
$$;

create or replace function get_catalogue_filter_options()
returns json language sql security invoker stable as $$
  select json_build_object(
    'makes', coalesce((
      select json_agg(x order by x)
      from (select distinct make_name as x from parts where is_active and make_name is not null and btrim(make_name) <> '') s
    ), '[]'::json),
    'groups', coalesce((
      select json_agg(x order by x)
      from (select distinct group_name as x from parts where is_active and group_name is not null and btrim(group_name) <> '') s
    ), '[]'::json),
    'subGroups', coalesce((
      select json_agg(x order by x)
      from (select distinct sub_group_name as x from parts where is_active and sub_group_name is not null and btrim(sub_group_name) <> '') s
    ), '[]'::json),
    'brands', coalesce((
      select json_agg(x order by x)
      from (select distinct brand as x from parts where is_active and brand is not null and btrim(brand) <> '') s
    ), '[]'::json),
    'catModels', coalesce((
      select json_agg(x order by x)
      from (select distinct cat_model as x from parts where is_active and cat_model is not null and btrim(cat_model) <> '') s
    ), '[]'::json),
    'itemModels', coalesce((
      select json_agg(x order by x)
      from (select distinct item_model as x from parts where is_active and item_model is not null and btrim(item_model) <> '') s
    ), '[]'::json)
  );
$$;

create or replace function submit_quote_request(p_note text default null)
returns quote_requests language plpgsql security invoker as $$
declare r quote_requests;
begin
  if not exists (select 1 from cart_items where user_id = auth.uid()) then
    raise exception 'CART_EMPTY';
  end if;

  insert into quote_requests (user_id, note) values (auth.uid(), p_note)
  returning * into r;

  insert into quote_request_items (
    quote_request_id, part_id, sku_snapshot, name_snapshot,
    brand_snapshot, oem_snapshot, price_snapshot, qty)
  select r.id, p.id, p.sku, p.name, p.brand, p.oem_number, coalesce(p.price_pkr, 0), c.qty
  from cart_items c join parts p on p.id = c.part_id
  where c.user_id = auth.uid();

  update quote_requests set
    item_count = (select sum(qty) from quote_request_items where quote_request_id = r.id),
    total_pkr  = 0
  where id = r.id returning * into r;

  delete from cart_items where user_id = auth.uid();
  return r;
end $$;

grant execute on function search_parts(
  text, int, int, int, int, int, int, text, text, text, text, text, text
) to authenticated;
grant execute on function get_catalogue_filter_options() to authenticated;
