# SSG Auto Parts — Build Brief

Save as `docs/BRIEF.md`. Attach with `@BRIEF.md` in every Cursor Composer session. Work through **Section 14: Build order** one stage at a time. Do not ask Cursor to build the whole app in one shot.

---

## 1. What we are building

A B2B wholesale auto parts catalogue app for **SSG Auto Parts**, a single Pakistani parts distributor ("Trusted since 1971"). Workshop owners and traders browse SSG's catalogue, filter by vehicle, build a request basket, and submit a quote request. SSG's sales team receives the request and closes the sale offline by phone.

**Users:** individual buyers (traders, workshop owners) in Pakistan. Access is invite-only — SSG pre-registers an identifier before anyone can get in.

**Languages:** English and Urdu, both required at launch. Urdu is RTL.

---

## 2. Non-goals — do not build these

Cursor will try to add these because its training data is full of e-commerce apps. It must not.

- **No payment or checkout.** No gateway, no card entry, no charged total. The basket ends in a quote request.
- **No orders, shipping, or fulfilment tracking.** A submitted request has no lifecycle in the app.
- **No seller or vendor accounts.** SSG is the only seller. Brands (Denso, Brembo, Bosch) are a text attribute on a part, not an entity with a login.
- **No stock quantities.** Never display "24 pcs available" or an in-stock badge. If a part is in the catalogue it is orderable.
- **No customer-specific or tiered pricing.** One price per part, identical for every logged-in buyer.
- **No organisations, teams, or multi-user accounts.** One identifier, one profile. `business_name` is a plain text field on the profile.
- **No self sign-up.** No registration form, no "create account" screen. See Section 7.
- **No in-app quote responses.** SSG never replies through the app.
- **No recently-viewed history.** This was in the HTML prototype and has been cut.

---

## 3. Files already in the repo — do not regenerate

These are written and reviewed. Read them for context, but do not rewrite or replace them without being asked.

| File | Purpose |
|---|---|
| `lib/config.ts` | Reads and validates env vars. The only place `process.env` is touched. |
| `lib/supabase.ts` | The single Supabase client, configured for React Native session persistence. |
| `lib/auth.ts` | Auth adapter hiding the dev/phone mode split behind one interface. |
| `supabase/migrations/003_auth_hook.sql` | `allowed_users` table, signup gate, profile-creation trigger. |
| `AGENTS.md` | Repo rules. Applies to every session. |

`lib/supabase.ts` has a commented instruction to add the `Database` generic. Do that **only after** stage 2 has generated `types/database.ts`.

---

## 4. Tech stack

| Layer | Choice |
|---|---|
| App | React Native via **Expo** (managed), TypeScript strict |
| Navigation | **Expo Router** (file-based) |
| Backend | **Supabase** — Postgres, Auth, Storage, Edge Functions |
| Auth | Adapter: email+password in dev, phone OTP in production (Section 7) |
| State | React Query (`@tanstack/react-query`) for server data; React Context for language and theme |
| i18n | `i18next` + `react-i18next` + `expo-localization` |
| Fonts | `expo-font` — Noto Nastaliq Urdu |
| Pilot hosting | Expo web export → Vercel |
| Store builds | EAS Build (iOS + Android) |

There is **no custom API server**. The app talks to Supabase directly. Row-level security in Postgres is the authorisation layer. Only two pieces of server code exist: the signup gate (a Postgres function) and the notification dispatcher (an Edge Function).

**API keys:** this project uses Supabase's current key scheme. The **publishable** key (`sb_publishable_...`) is safe in the app bundle and carries the same low privileges the old `anon` key did. The **secret** key (`sb_secret_...`) bypasses RLS entirely and belongs only in Edge Function secrets. The legacy `anon`/`service_role` JWT keys are deprecated and are not used here.

Pin all dependency versions in `package.json`. Never `latest`.

---

## 5. Repo structure

```
ssg-autoparts/
├── AGENTS.md
├── .env.local                       (gitignored)
├── .env.local.example               (committed)
├── docs/
│   ├── BRIEF.md                     this file
│   └── SETUP.md
├── app/
│   ├── _layout.tsx                  root: providers, fonts, RTL init, splash
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── language.tsx             first-run language picker
│   │   ├── sign-in.tsx              identifier (+ password in dev mode)
│   │   └── verify.tsx               OTP entry — phone mode only
│   ├── (tabs)/
│   │   ├── _layout.tsx              bottom tab bar (5 tabs)
│   │   ├── index.tsx                Home — catalogue
│   │   ├── favourites.tsx
│   │   ├── requests.tsx             My requests
│   │   ├── cart.tsx
│   │   └── profile.tsx
│   ├── part/[id].tsx
│   ├── request/[id].tsx
│   └── admin/upload.tsx             Excel import, admin role only
├── components/
│   ├── PartCard.tsx  CategoryChips.tsx  VehicleSelector.tsx
│   ├── FilterSheet.tsx  SearchBar.tsx  QtyStepper.tsx
│   └── EmptyState.tsx  Screen.tsx
├── lib/
│   ├── config.ts                    EXISTS
│   ├── supabase.ts                  EXISTS
│   ├── auth.ts                      EXISTS
│   ├── queries/
│   │   ├── parts.ts  vehicles.ts  cart.ts  favourites.ts
│   │   ├── requests.ts  profile.ts  admin.ts
│   ├── i18n/  index.ts  en.json  ur.json
│   ├── theme.ts
│   ├── format.ts                    formatPkr(), formatDate()
│   └── rtl.ts
├── types/database.ts                GENERATED — never hand-edit
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql
│   │   ├── 002_rls.sql
│   │   ├── 003_auth_hook.sql        EXISTS
│   │   └── 004_notify.sql
│   ├── functions/notify-quote/index.ts
│   ├── functions/import-parts/index.ts
│   └── seed.sql
├── assets/fonts/  assets/images/
└── app.json  eas.json
```

---

## 6. Database schema

Write as `supabase/migrations/001_schema.sql`. Note that `allowed_users` is **not** here — it lives in `003_auth_hook.sql`, which already exists.

```sql
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
```

---

## 7. Row-level security

Write as `supabase/migrations/002_rls.sql`.

```sql
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
```

**Two gates, both required.** The signup hook in `003` only runs at account creation, so it cannot revoke anyone — a suspended user keeps a valid session token. `is_active_user()` in these policies is what actually cuts off access. Building one and forgetting the other is the common mistake.

---

## 8. Auth: two modes, no sign-up

There is no registration step. Sign-up and sign-in are the same action: the user presents an identifier, and either they're on the allowlist or they aren't.

**Two mechanisms produce an identical session**, selected by `EXPO_PUBLIC_AUTH_MODE`:

| Mode | Identifier | Flow | When |
|---|---|---|---|
| `dev` | email + password | one step | Now. No SMS provider needed, no cost. |
| `phone` | phone + 6-digit OTP | two steps | Production, once Twilio is configured. |

**All mode branching lives in `lib/auth.ts` and the two sign-in screens. Nowhere else.** Everything downstream keys off `auth.uid()` and must behave identically under both modes. If `config.authMode` is referenced in a component, that's a bug — the cutover is supposed to be a one-line env change.

`lib/auth.ts` exposes `startSignIn()`, `completeSignIn()`, `signOut()`, `getSession()`, and a `signInShape` object telling the screen which fields to render. Read it rather than reimplementing.

**Flow:**
1. `startSignIn()` — Supabase doesn't care whether the user exists
2. If they don't, Supabase begins creating them, firing the `before-user-created` hook
3. The hook checks `allowed_users` for a matching phone **or** email, and allows or rejects
4. Dev mode returns `signed_in`; phone mode returns `code_sent`, then `completeSignIn()`
5. The `on_auth_user_created` trigger creates the `profiles` row, copying `business_name`, `city`, and `role` from `allowed_users`
6. Session persists on-device indefinitely — returning users land straight on Home

`003_auth_hook.sql` implements steps 3 and 5 and already exists. **It must also be enabled in the dashboard** under Authentication → Hooks → Before user created, pointing at `hook_restrict_signup`. Cursor cannot flip that switch. A silently-inactive hook means the allowlist does nothing while appearing to work.

The hook returns the sentinel `NOT_REGISTERED`. The app must translate this into a localised message with SSG's number as a tappable link. Never surface the raw error — that screen is SSG's inbound sales funnel.

**Onboarding a buyer** is one row:
```sql
insert into allowed_users (phone, business_name, city)
values ('923001234567', 'Al-Habib Motors', 'Lahore');
-- or, in dev mode:
insert into allowed_users (email, business_name, city)
values ('buyer@ssgtest.com', 'Al-Habib Motors', 'Lahore');
```

---

## 9. Screens

### Splash — `app/_layout.tsx`
SSG logo, "Trusted since 1971", brief progress indicator. Loads fonts and restores the session while showing. Then routes: no session → language or sign-in; session → Home.

### Language picker — `(auth)/language.tsx`
First run only. Two large options: English, اردو. Writes to context, and to `profiles.language` once logged in. Reachable later from Profile.

### Sign-in — `(auth)/sign-in.tsx`
Renders according to `signInShape` from `lib/auth.ts`:
- **dev mode:** email field, password field, one button, straight to Home on success
- **phone mode:** +92 prefix fixed, numeric keypad, local display formatting (0300 1234567) submitting normalised digits, then routes to verify

On `not_registered`, show the localised not-registered message with SSG's tappable number.

### Verify — `(auth)/verify.tsx`
Phone mode only. Six-digit entry, auto-advance, resend after 30s with countdown.

### Home — `(tabs)/index.tsx`
The main screen, top to bottom:
- **Search bar** — free-text against `search_vector`, debounced 300ms, matching name, brand, OEM number, SKU
- **Vehicle selector** — three dependent pickers (Make → Model → Variant) as bottom sheets. Selecting a Make resets Model and Variant. Variant optional. Clear button resets all three.
- **Category chips** — horizontal scroll from `categories`, "All" first
- **Parts grid** — two columns, infinite scroll, page size 20

Filtering is **server-side** via an RPC. Vehicle filtering must respect fitment nullability: Toyota → Corolla → GLi returns parts fitting that variant, *plus* parts fitting all Corollas, *plus* parts fitting all Toyotas.

```sql
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
```

**Part card:** image, name, brand, price. Heart icon toggling favourite. No quantity, no stock badge.

**Image fallback chain:** `parts.image_url` → brand logo from `assets/images/brands/` → category icon → generic placeholder. Implement once in `PartCard`, reuse everywhere. Many parts will have no photo.

### Part detail — `part/[id].tsx`
Large image, name, brand, price, OEM number, category, description. A fitment list generated from `part_fitments`, rendering `model_id IS NULL` rows as "All Toyota models". Two actions: **Add to request**, and **Contact SSG** opening `https://wa.me/{config.ssgWhatsapp}?text=…` prefilled with SKU and part name.

`config.ssgWhatsapp` may be **null** until SSG supplies a number. Handle null by disabling the button with an explanatory message. Never render `wa.me/` with an empty number — that looks like a working button until someone taps it.

### Favourites — `(tabs)/favourites.tsx`
Same grid as Home, filtered to the user's favourites. Empty state pointing back to the catalogue.

### Cart — `(tabs)/cart.tsx`
Rows: thumbnail, name, unit price, quantity stepper, line total, remove. An estimated total clearly labelled **indicative only, not a final quote**. A free-text note field (placeholder: delivery details, urgency, anything else). One button: **Submit request**. On success, a confirmation showing the reference number, then clear the cart.

Submission is transactional — one RPC, so a partial failure can't leave a half-written request:

```sql
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
```

### My requests — `(tabs)/requests.tsx`
Replaces the prototype's History tab. Reverse-chronological: reference number, date, item count, indicative total. Tapping opens `request/[id].tsx` with the snapshot line items and the note. Read-only — no cancel, no reorder in v1.

### Profile — `(tabs)/profile.tsx`
Business name, contact name, identifier, city, "Verified buyer" badge. Settings rows: language, appearance (light/dark/system), contact SSG, sign out. Admins additionally see a link to the upload screen.

### Admin upload — `app/admin/upload.tsx`
Visible only when `profiles.role = 'admin'`, and also guarded by RLS so hiding the link is not the only defence. Flow: pick `.xlsx` via `expo-document-picker` → upload to the private `imports` Storage bucket → invoke the `import-parts` Edge Function → show a result summary (rows read, created, updated, skipped, per-row errors). Validate the whole file before applying anything; never partially apply a failed import.

---

## 10. Excel import template

SSG has no file yet, so **we define the format**. Two sheets.

**Sheet `Parts`**

| Column | Required | Notes |
|---|---|---|
| SKU | yes | unique key, used for upsert |
| Name | yes | English |
| Name_UR | no | Urdu |
| Brand | no | free text |
| OEM_Number | no | |
| Category | yes | must match an existing `categories.slug` |
| Price_PKR | yes | number — no "Rs", no commas |
| Description | no | |
| Description_UR | no | |
| Image_Filename | no | matched against the Storage bucket |
| Active | no | TRUE/FALSE, defaults TRUE |

**Sheet `Fitment`**

| Column | Required | Notes |
|---|---|---|
| SKU | yes | must exist in Parts |
| Make | yes | e.g. Toyota |
| Model | no | blank = fits all models of that make |
| Variant | no | blank = fits all variants of that model |

One part gets as many Fitment rows as it needs. A brake pad covering fifteen vehicles is one Parts row and fifteen Fitment rows.

The importer upserts `makes`, `models`, and `variants` on the fly from the Fitment sheet, matching case-insensitively on slugified names, so SSG never maintains the taxonomy separately. Unrecognised **category** slugs are reported as row errors rather than auto-created — a typo should be visible, not become a phantom category.

Ship a filled example at `docs/import-template.xlsx`.

---

## 11. Notification pipeline

Write as `supabase/migrations/004_notify.sql` plus `supabase/functions/notify-quote/index.ts`.

A Supabase **Database Webhook** on `insert into quote_requests` calls the `notify-quote` Edge Function. Not the app — the database. If the buyer's phone dies right after tapping submit, the row is committed and the alert still goes out.

The function does three things:

1. **Load** the request, its items, and the buyer's profile using the secret key.
2. **Append a row to Google Sheets** via a service account: reference, timestamp, business name, contact name, identifier, city, item count, indicative total, note, flattened item list. This sheet is SSG's working record.
3. **Fan out WhatsApp alerts** via the WhatsApp Cloud API to every number in `SSG_SALES_NUMBERS` (comma-separated), using an approved template.

**Key handling — this is the part that silently 401s.** The new `sb_secret_` keys are not JWTs:

- Database Webhooks must send the key on the **`apikey`** header, not `Authorization: Bearer`. Bearer is rejected.
- Don't hardcode the key in the webhook config, where it sits in plain text. Store it in **Supabase Vault** and read it at call time.
- In the Edge Function, read it as:
  ```ts
  const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'];
  ```
  It's a JSON object keyed by name, not the plain string that `SUPABASE_SERVICE_ROLE_KEY` held.

> **On WhatsApp groups.** Meta's Groups API requires Official Business Account status, excludes WhatsApp Business app numbers and Multi-solution Conversations numbers, is limited to very high-volume senders, and creates invite-only groups through the API — so SSG's existing sales group cannot be wired up. Unofficial providers that do support groups drive a personal WhatsApp session and risk the number being banned. Therefore: **fan out to individual staff numbers.** For a notification it's equivalent, and the Google Sheet is the shared surface a group chat is bad at anyway.

Each step must fail independently. A Sheets outage must not block the WhatsApp alert, and neither may ever fail the buyer's submission — the row is committed before the function runs. Write every outcome to `notification_log` so nothing is silently lost.

---

## 12. Internationalisation and RTL

Urdu ships at launch. This is the most error-prone part of the build, so set it up before any screen exists.

- All user-facing strings go through `t()`. Zero hardcoded English in components — including error messages, empty states, and button labels.
- `en.json` and `ur.json` must have identical key trees.
- Load **Noto Nastaliq Urdu** via `expo-font` and test on a **physical Android device** early. Complex-script rendering has historically been unreliable there, and Nastaliq needs extra line height — set it explicitly on Urdu text styles.
- Use **logical layout properties everywhere**: `marginStart`/`marginEnd`, `paddingStart`/`paddingEnd`, `start`/`end`. Never `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight`, `left`, `right`.
- `I18nManager.forceRTL()` requires an **app reload**. Switching to Urdu must show a localised "restart to apply" prompt and call `Updates.reloadAsync()`. Do not attempt live direction switching — it half-applies and looks broken.
- Numbers and prices stay in Western digits and LTR even in Urdu. Wrap price strings so bidi doesn't reorder them.
- Currency formatting lives only in `formatPkr()`. Never build a price string inline.

---

## 13. Theme

From the HTML prototype: two brand colours plus light and dark surfaces.

```ts
export const brand = { navy: '#1B2C5B', red: '#C8102E' };
```

Build `lib/theme.ts` with `light` and `dark` objects covering: background, surface, surfaceAlt, border, textPrimary, textSecondary, textMuted, accent, accentText, danger, success. Every component reads the active theme from context. No hex literals in components. Respect system appearance by default, with a manual override in Profile.

Match the prototype's visual language: rounded cards, hairline borders, generous spacing, flat surfaces, no shadows beyond a subtle card lift.

---

## 14. Build order

**One stage per Composer session. Commit after each. Do not skip ahead.**

1. **Scaffold** — folder structure per Section 5, empty placeholder files, pinned deps from Section 4, `.env.local.example`. Delete the starter template's demo screens. No features.
2. **Database** — write and push `001_schema.sql` and `002_rls.sql`. `003_auth_hook.sql` already exists; push all three together. Then run `npx supabase gen types typescript --linked > types/database.ts` and commit it. Add the `Database` generic to `lib/supabase.ts`. **Nothing else until this is done** — every later stage depends on these types being accurate.
3. **Seed** — `seed.sql` with the 7 categories, Toyota/Honda/Suzuki taxonomy, and ~25 sample parts with fitment rows, so screens have realistic content from day one.
4. **Theme + i18n + RTL** — `theme.ts`, both JSON files, fonts, `I18nManager` init, reload-on-switch. Verify Urdu renders correctly on a real Android device before proceeding.
5. **Auth screens** — `language.tsx`, `sign-in.tsx`, `verify.tsx`, session persistence, routing guards, using `lib/auth.ts`. Enable the hook in the dashboard. Test with one identifier on the allowlist and one deliberately off it, and confirm the second is rejected.
6. **Tab shell** — five tabs, icons, labels in both languages, correct order under RTL.
7. **Catalogue** — the `search_parts` RPC, Home screen, part card with image fallback, infinite scroll, search and category chips.
8. **Vehicle selector** — three dependent bottom sheets, cascade resets, clear-all, wired into the RPC. Verify the fitment nullability cases explicitly.
9. **Detail + favourites** — part detail with fitment list and WhatsApp deep link (handling null); favourites toggle and tab.
10. **Cart + submission** — cart CRUD, quantity steppers, note field, `submit_quote_request`, confirmation with reference number.
11. **My requests** — list and detail from the snapshot tables.
12. **Profile** — fields, settings rows, language and theme switching, sign out.
13. **Notifications** — `004_notify.sql`, Database Webhook, `notify-quote` Edge Function, Sheets append, WhatsApp fan-out, `notification_log`.
14. **Admin upload** — role guard, file picker, `import-parts` Edge Function, validation and result summary, example template.
15. **Ship** — Expo web export to Vercel for the pilot link; then `app.json`, `eas.json`, icons, splash, bundle IDs, EAS builds, TestFlight and Play Internal Testing.

Stages 2, 4, and 5 are where mistakes are most expensive to unwind. Review those line by line rather than accepting Cursor's output.

**Phone auth cutover** happens whenever Twilio is ready, independently of this sequence: configure the SMS provider, add test OTP numbers, add phone numbers to `allowed_users`, set `EXPO_PUBLIC_AUTH_MODE=phone`, restart. No code changes. Keep one email-mode account on the allowlist permanently for Apple's reviewers.

---

## 15. Environment

`.env.local.example` (committed):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_KEY=
EXPO_PUBLIC_AUTH_MODE=dev
EXPO_PUBLIC_SSG_WHATSAPP=
EXPO_PUBLIC_SSG_PHONE=
```

Every variable needs the `EXPO_PUBLIC_` prefix or the app cannot read it. Values are baked in at bundle time, so restart the dev server after any change. Read them only through `lib/config.ts`.

Edge Function secrets (never in the app bundle):

```
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEET_ID=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_TEMPLATE_NAME=
SSG_SALES_NUMBERS=923001234567,923219876543
```

The secret key is injected automatically as `SUPABASE_SECRET_KEYS` — don't add it manually.

The publishable key is safe in the client bundle; RLS is what protects the data. The secret key bypasses RLS entirely. If it ever reaches the app, the whole catalogue and every buyer's request history is public.

---

## 16. Open items

Not blocking stages 1 through 12.

- **Twilio account** — currently unavailable, hence dev auth mode. Verify SMS deliverability to +92 numbers before committing to it. If pricing doesn't work, Supabase's **Send SMS auth hook** allows any provider, including a local Pakistani gateway.
- **Meta Business verification** and an approved WhatsApp template — start early, it has lead time and blocks stage 13.
- SSG's sales WhatsApp number and the staff numbers for fan-out.
- The real category list — the prototype's seven are placeholders.
- Where part photos come from, plus a brand-logo set for the fallback chain.
- Whether admins are provisioned by hand in SQL or need a screen.
