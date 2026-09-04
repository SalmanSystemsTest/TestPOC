create extension if not exists pg_trgm;

-- ── Vehicle taxonomy ───────────────────────────────────────────
create table makes (
  id          serial primary key,
  slug        text unique not null,
  name        text not null,
  name_ur     text,
  sort_order  int default 0
);

create table models (
  id          serial primary key,
  make_id     int not null references makes(id) on delete cascade,
  slug        text not null,
  name        text not null,
  name_ur     text,
  sort_order  int default 0,
  unique (make_id, slug)
);

create table variants (
  id          serial primary key,
  model_id    int not null references models(id) on delete cascade,
  slug        text not null,
  name        text not null,
  name_ur     text,
  sort_order  int default 0,
  unique (model_id, slug)
);

create table categories (
  id          serial primary key,
  slug        text unique not null,
  name        text not null,
  name_ur     text,
  icon        text,
  sort_order  int default 0
);

-- ── Catalogue ──────────────────────────────────────────────────
create table parts (
  id             uuid primary key default gen_random_uuid(),
  sku            text unique not null,
  name           text not null,
  name_ur        text,
  brand          text,
  oem_number     text,
  category_id    int references categories(id),
  price_pkr      numeric(12,2) not null check (price_pkr >= 0),
  description    text,
  description_ur text,
  image_url      text,
  is_active      boolean not null default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- Free-text search. 'simple' config, NOT 'english' — English stemming
-- mangles OEM part numbers like 04465-YZZE1.
alter table parts add column search_vector tsvector
  generated always as (
    to_tsvector('simple',
      coalesce(name,'') || ' ' ||
      coalesce(brand,'') || ' ' ||
      coalesce(oem_number,'') || ' ' ||
      coalesce(sku,'') || ' ' ||
      coalesce(name_ur,'')
    )
  ) stored;

create index parts_search_idx   on parts using gin (search_vector);
create index parts_oem_trgm     on parts using gin (oem_number gin_trgm_ops);
create index parts_category_idx on parts (category_id) where is_active;

-- Many-to-many fitment. NULL = fits anything at that level.
--   (make=Toyota, model=NULL)            → all Toyotas
--   (make=Toyota, model=Corolla)         → all Corolla variants
--   (make=Toyota, model=Corolla, GLi)    → that variant only
create table part_fitments (
  id          bigserial primary key,
  part_id     uuid not null references parts(id) on delete cascade,
  make_id     int  not null references makes(id),
  model_id    int  references models(id),
  variant_id  int  references variants(id)
);

create index pf_part_idx   on part_fitments (part_id);
create index pf_lookup_idx on part_fitments (make_id, model_id, variant_id);

-- ── Profiles ───────────────────────────────────────────────────
-- One row per user. Created automatically by the trigger in
-- 003_auth_hook.sql, populated from allowed_users.
-- Either phone or email is set, depending on auth mode.
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  phone         text,
  email         text,
  business_name text,
  contact_name  text,
  city          text,
  role          text not null default 'buyer'  check (role in ('buyer','admin')),
  status        text not null default 'active' check (status in ('active','suspended')),
  language      text default 'en' check (language in ('en','ur')),
  created_at    timestamptz default now()
);

-- ── Buyer data ─────────────────────────────────────────────────
create table favourites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  part_id    uuid not null references parts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, part_id)
);

create table cart_items (
  user_id    uuid not null references auth.users(id) on delete cascade,
  part_id    uuid not null references parts(id) on delete cascade,
  qty        int not null default 1 check (qty > 0 and qty <= 9999),
  updated_at timestamptz default now(),
  primary key (user_id, part_id)
);

create sequence quote_ref_seq;

create table quote_requests (
  id          uuid primary key default gen_random_uuid(),
  reference   text unique not null
                default 'SSG-' || to_char(now(),'YY') || '-' ||
                        lpad(nextval('quote_ref_seq')::text, 5, '0'),
  user_id     uuid not null references auth.users(id),
  note        text,
  item_count  int not null default 0,
  total_pkr   numeric(12,2) not null default 0,
  created_at  timestamptz default now()
);

create index qr_user_idx on quote_requests (user_id, created_at desc);

-- Snapshot name and price at submission time. The catalogue changes;
-- a past request must not silently change with it.
create table quote_request_items (
  id                uuid primary key default gen_random_uuid(),
  quote_request_id  uuid not null references quote_requests(id) on delete cascade,
  part_id           uuid references parts(id),
  sku_snapshot      text not null,
  name_snapshot     text not null,
  brand_snapshot    text,
  oem_snapshot      text,
  price_snapshot    numeric(12,2) not null,
  qty               int not null check (qty > 0)
);

create index qri_request_idx on quote_request_items (quote_request_id);

-- Notification audit trail, written by the Edge Function in 004.
create table notification_log (
  id               bigserial primary key,
  quote_request_id uuid references quote_requests(id) on delete cascade,
  channel          text not null,   -- 'sheets' | 'whatsapp'
  target           text,
  succeeded        boolean not null,
  error            text,
  created_at       timestamptz default now()
);
