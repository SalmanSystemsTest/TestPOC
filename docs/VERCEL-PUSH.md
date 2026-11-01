# Push to GitHub and redeploy on Vercel

Repo: `https://github.com/SalmanSystemsTest/TestPOC`  
Branch: **`master`** (not `main`).

## Minimum files to fix Vercel 404

Place at the **repository root** (same folder as `package.json`):

```
TestPOC/                          ← GitHub repo root
├── vercel.json                   ← NEW (required)
├── package.json                  ← UPDATE (add "build" script)
└── … (rest already on GitHub)
```

### 1. `vercel.json` (new file, repo root)

Already in this project at `./vercel.json`.

### 2. `package.json` (repo root)

Must include in `"scripts"`:

```json
"build": "expo export -p web"
```

---

## Optional: admin analytics (not required for site to load)

Only if you want **Admin → Analytics** on production:

```
app/admin/analytics.tsx
app/admin/index.tsx          (link to analytics)
components/AdminBreakdownTable.tsx
lib/queries/admin-analytics.ts
lib/i18n/en.json
lib/i18n/ur.json
types/database.ts
supabase/migrations/013_admin_analytics.sql   ← run in Supabase SQL Editor after push
```

---

## Do NOT push

- `Pass.txt`
- `.env.local`
- `supabase/.temp/`
- `node_modules/`, `dist/`, `.expo/`

---

## Git commands (on the machine that can push)

```bash
cd TestPOC

# Minimum Vercel fix only:
git add vercel.json package.json
git commit -m "Configure Expo web export for Vercel (dist output)."
git push origin master
```

Or push all app changes (exclude secrets):

```bash
git add vercel.json package.json app components lib types supabase docs AGENTS.md
git add -u
git status
# confirm Pass.txt and .env.local are NOT staged
git commit -m "Vercel deploy config and latest app updates."
git push origin master
```

---

## Vercel after push

1. **Settings → Git** → connected to `SalmanSystemsTest/TestPOC`, branch **`master`**.
2. **Settings → Environment Variables** (Production) — **required or build fails**:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_KEY`
   - `EXPO_PUBLIC_AUTH_MODE` = `dev`
   - **WhatsApp (required for the green header button):** `EXPO_PUBLIC_SSG_WHATSAPP` — digits only, country code first (example `923234750860`). Same value as in local `.env.local`. If this is missing at **build** time, the button stays grey and does nothing.
   - optional: `EXPO_PUBLIC_SSG_PHONE`

   Without the Supabase vars, `expo export` throws `Missing environment variable: EXPO_PUBLIC_SUPABASE_URL` and **no `dist/` is produced** → Vercel 404.

   After adding or changing any `EXPO_PUBLIC_*` variable, trigger a **new deployment** (Redeploy). Vercel bakes them in during `npm run build`, not at runtime.
3. **Settings → General → Build & Development** (should match `vercel.json`):
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci` or `npm install`
4. **Deployments** → latest → **Redeploy** (or wait for auto-deploy on push).
5. Open production URL → sign-in screen should load (not Vercel 404).

---

## Verify build on Vercel

Open deployment → **Building** log → look for:

- `expo export -p web`
- success / `Exported:` message
- no `Missing environment variable: EXPO_PUBLIC_…`
