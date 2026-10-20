# Move project to another PC and push to GitHub

Use this after copying the zip from the locked-down PC.

## What is in the zip

- Full project **including `.git` history** (local commits on `master`).
- **Not included:** `node_modules`, `.expo`, `dist`, `.env.local`, `Pass.txt`, `supabase/.temp`.

## After unzip on the other laptop

1. Unzip so you have a folder like `ssg-autoparts/` with `package.json` inside.
2. Copy secrets separately (USB or password manager), **never email passwords in the zip:**
   - Create `.env.local` from `.env.local.example` and fill Supabase URL + publishable key.
3. Install and smoke-test (optional but recommended):

```bash
cd ssg-autoparts
npm ci
npx expo export -p web
```

## First push to GitHub

Create an **empty** repo on GitHub (no README if you already have local commits).

```bash
cd ssg-autoparts
git status
git remote -v
```

If there is no `origin` yet:

```bash
git remote add origin https://github.com/YOUR_ORG/ssg-autoparts.git
git branch -M main
git push -u origin main
```

If `origin` already exists but points elsewhere, update it:

```bash
git remote set-url origin https://github.com/YOUR_ORG/ssg-autoparts.git
git push -u origin master
```

Use `main` or `master` to match what GitHub created.

## Commit all current work (if not already committed)

Run from the project root:

```bash
git add app components lib types supabase docs AGENTS.md
git add -u
git status
```

**Do not** `git add Pass.txt`, `.env.local`, or `supabase/.temp`. They should stay ignored.

If `git status` still shows files you want, add explicitly, e.g.:

```bash
git add components/CatalogueFilterBar.tsx components/CatalogueHierarchyPicker.tsx
git add components/PartListRow.tsx components/PreferenceMultiPick.tsx
git add lib/catalogue-preference-sort.ts lib/part-display.ts
git add lib/queries/catalogue-filters.ts lib/queries/catalogue-hierarchy.ts
git add supabase/migrations/010_client_itemlist_catalogue.sql
git add supabase/migrations/011_hierarchical_catalogue.sql
git add supabase/migrations/012_profile_catalogue_preferences.sql
```

Commit:

```bash
git commit -m "Hierarchical catalogue browse, onboarding preferences, and Excel import sync."
git push origin master
```

(Replace branch name with `main` if you renamed it.)

## Vercel (once, on the laptop or in browser)

1. Import the GitHub repo in Vercel.
2. Build: `npx expo export -p web`, output directory: `dist`.
3. Add the same `EXPO_PUBLIC_*` variables as in `.env.local`.
4. Deploy.

Later deploys happen on every `git push` without using this PC.

## Supabase (from either PC)

Dashboard: users, allowlist, storage, secrets.

CLI (optional):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy import-parts
supabase functions deploy notify-quote
```

Project ref is in Supabase → Project Settings → General.
