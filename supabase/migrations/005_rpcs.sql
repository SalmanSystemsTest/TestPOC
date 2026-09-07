-- Catalogue search and quote submission RPCs.
-- Both are `security invoker`, so the RLS policies in 002 still apply and
-- a suspended profile gets an empty catalogue rather than a bypass.

-- Server-side catalogue filtering. Every filter is optional; a null means
-- "do not constrain on this".
--
-- Vehicle filtering respects fitment nullability, which is the whole reason
-- this is an RPC rather than a PostgREST query. A fitment row with a null
-- model_id means "fits every model of this make", so selecting
-- Toyota > Corolla > GLi must return parts pinned to that variant, plus
-- parts pinned to all Corollas, plus parts pinned to all Toyotas.
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
    and (p_query is null or p.search_vector @@ plainto_tsquery('simple', p_query))
    and (p_make is null or (
      f.make_id = p_make
      and (f.model_id is null   or p_model is null   or f.model_id = p_model)
      and (f.variant_id is null or p_variant is null or f.variant_id = p_variant)
    ))
  order by p.name
  limit p_limit offset p_offset;
$$;

-- Turns the caller's cart into a quote request in one statement, so a
-- failure part-way cannot leave a request with missing line items.
-- Name and price are snapshotted: the catalogue moves on, a past request
-- must not silently move with it.
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
  select r.id, p.id, p.sku, p.name, p.brand, p.oem_number, p.price_pkr, c.qty
  from cart_items c join parts p on p.id = c.part_id
  where c.user_id = auth.uid();

  update quote_requests set
    item_count = (select sum(qty) from quote_request_items where quote_request_id = r.id),
    total_pkr  = (select sum(price_snapshot * qty) from quote_request_items where quote_request_id = r.id)
  where id = r.id returning * into r;

  delete from cart_items where user_id = auth.uid();
  return r;
end $$;

grant execute on function search_parts(text, int, int, int, int, int, int) to authenticated;
grant execute on function submit_quote_request(text) to authenticated;
