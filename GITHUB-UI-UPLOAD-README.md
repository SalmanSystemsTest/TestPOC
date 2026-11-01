# Upload this project via GitHub website (no git on your PC)

## What to use

- **Zip:** `ssg-autoparts-GitHub-UI-upload.zip` (in the parent folder next to this project, or regenerate — see below)
- **Or folder:** unzip to `ssg-autoparts-GitHub-UI-upload/`

Same contents: full app source, migrations, `vercel.json`, docs. **Not included:** `node_modules`, `.expo`, `dist`, `.env.local`, `Pass.txt`, `supabase/.temp`, `.git`.

## Steps on GitHub

1. Open **https://github.com/SalmanSystemsTest/TestPOC** (or your repo).
2. If the repo already has files and you want to **replace everything**:
   - Easiest: delete the repo and create a new empty one with the same name, **or**
   - Upload into an empty branch (advanced). For a full replace, **git push is simpler**; UI upload is best for **adding/updating files in batches**.
3. **Add file → Upload files**.
4. Unzip locally, open the **`ssg-autoparts-GitHub-UI-upload`** folder, select **all files and folders inside** (not the outer wrapper only), drag onto the GitHub page.
5. Commit message example: `Update app: sign-up, hierarchy catalogue, Vercel and fixes`.
6. **Commit changes** to `master` (or `main`).

## After upload — Vercel

1. **Settings → Environment Variables:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`, `EXPO_PUBLIC_AUTH_MODE=dev`, `EXPO_PUBLIC_SSG_WHATSAPP` (digits only).
2. **Redeploy** so the build picks up env vars.

## Regenerate the zip (on a dev PC)

From project root in PowerShell:

```powershell
.\scripts\pack-github-ui-upload.ps1
```

Output: `..\ssg-autoparts-GitHub-UI-upload.zip` and folder `..\ssg-autoparts-GitHub-UI-upload\`.

## Secrets

Create `.env.local` on any machine from `.env.local.example` — **never** put it in the zip or GitHub.
