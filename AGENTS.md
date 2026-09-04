# Rules

## Scope
- Read `docs/BRIEF.md` before making changes.
- Never add checkout, payments, orders, shipping, stock quantities,
  seller accounts, tiered pricing, organisations, or a sign-up form.
  See "Non-goals" in the brief.

## Data access
- All Supabase queries live in `lib/queries/`. Never query from a component.
- Column and table names come from `types/database.ts`. Never invent one.
  If a field you need doesn't exist, stop and say so instead of guessing.
- Never use the service role key in app code. It belongs only in Edge
  Functions and server environment variables.
- Filtering and pagination are server-side. Never fetch the whole
  catalogue and filter in JS.

## Strings and formatting
- Every user-facing string goes through `t()`. No hardcoded English.
- `en.json` and `ur.json` must stay key-identical.
- Prices only ever render via `formatPkr()`. Never concatenate "Rs".
- Prices are `numeric` in the DB and `number` in TS. Never a string.

## Layout
- Use `marginStart`/`marginEnd`/`paddingStart`/`paddingEnd`/`start`/`end`.
  Never `marginLeft`, `paddingRight`, `left`, or `right`.
- Colours come from the theme context. No hex literals in components.
- Styles via `StyleSheet.create`. No inline style objects.

## General
- TypeScript strict. No `any`. No `@ts-ignore`.
- Pin dependency versions. Never `latest`.
- No new dependency without saying why in the response.
- Ask before changing anything in `supabase/migrations/`.