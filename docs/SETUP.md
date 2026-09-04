# Where each file goes

Rename the two env files when you place them — they are named without the
leading dot here so they survive download.

```
ssg-autoparts/
├── AGENTS.md                              ← AGENTS.md
├── .env.local                             ← env.local        (RENAME, add dot)
├── .env.local.example                     ← env.local.example (RENAME, add dot)
├── .gitignore                             ← add one line, see below
├── docs/
│   └── BRIEF.md                           ← CURSOR_BUILD_PROMPT.md (renamed)
├── lib/
│   ├── config.ts                          ← lib/config.ts
│   ├── supabase.ts                        ← lib/supabase.ts
│   └── auth.ts                            ← lib/auth.ts
└── supabase/
    └── migrations/
        └── 003_auth_hook.sql              ← supabase/migrations/003_auth_hook.sql
```

`docs/`, `lib/`, and `supabase/migrations/` may not exist yet. Create them.

## .gitignore

Confirm this line is present. The Expo template usually has `.env*.local`
already, which covers it. If not, add:

```
.env.local
```

`.env.local.example` must NOT be ignored — it gets committed.

Verify: `.env.local` should appear **greyed out** in Cursor's file explorer.
Greyed means ignored, which is correct.

## Dependencies these files need

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

Use `npx expo install`, not `npm install`. It picks versions compatible
with your Expo SDK.

## Fill in .env.local

Two values from Supabase → Project Settings → API Keys:

- `EXPO_PUBLIC_SUPABASE_URL` — the Project URL
- `EXPO_PUBLIC_SUPABASE_KEY` — the **publishable** key (`sb_publishable_...`),
  never the secret one

Leave `EXPO_PUBLIC_AUTH_MODE=dev`. Leave the two SSG numbers empty.

Restart the dev server after editing. Values are baked in at bundle time.

---

# Creating dev users (no Twilio needed)

Email auth is built into Supabase. No external provider, no cost.

## 1. Enable email auth

**Authentication → Sign In / Providers → Email.** Enable it, and turn
**Confirm email OFF** for now. With confirmation on you would need an SMTP
provider, which is the same problem as Twilio in a different coat.

## 2. Add three rows to the allowlist

**SQL Editor**, after pushing your migrations:

```sql
insert into allowed_users (email, business_name, city, role) values
  ('buyer@ssgtest.com',  'Al-Habib Motors', 'Lahore',  'buyer'),
  ('admin@ssgtest.com',  'SSG Auto Parts',  'Karachi', 'admin');
```

Note there is deliberately **no** third row. You will create a user with
an email that is not on this list to prove the gate rejects it.

## 3. Create the users

**Authentication → Users → Add user → Create new user.** Do this three times:

| Email | Password | Expected |
|---|---|---|
| `buyer@ssgtest.com` | `Test1234!` | created — on the allowlist |
| `admin@ssgtest.com` | `Test1234!` | created — on the allowlist, admin role |
| `nobody@ssgtest.com` | `Test1234!` | **rejected** — proves the hook works |

Tick "Auto Confirm User" on each.

If the third one succeeds, your hook is not wired up. Go to
**Authentication → Hooks → Before user created** and point it at
`hook_restrict_signup`. Cursor writes the SQL but cannot flip that switch,
and a silently-inactive hook means your allowlist does nothing while
appearing to work.

## 4. Verify the profile trigger

```sql
select id, email, business_name, role, status from profiles;
```

You should see two rows with `business_name` populated from the allowlist.
If `business_name` is null, `handle_new_user()` is not matching — check
that the email casing in `allowed_users` is lowercase.

---

# Switching to phone auth later

When Twilio works:

1. Configure the SMS provider under **Authentication → Sign In / Providers → Phone**
2. Add test OTP numbers on that same page so you are not billed per login
3. Add phone numbers to existing `allowed_users` rows, or insert new ones
4. Change `.env.local` to `EXPO_PUBLIC_AUTH_MODE=phone`
5. Restart the dev server

No application code changes. That is the point of `lib/auth.ts`.

Keep at least one email-mode account on the allowlist permanently — Apple's
reviewers need working credentials, and an SMS to a US reviewer's phone is
a rejection waiting to happen.

---

# Two corrections to fold into docs/BRIEF.md

1. **`allowed_users`** in Section 5 is superseded by the version in
   `003_auth_hook.sql`. It now has `id` as the primary key with nullable
   `phone` and `email`, so both auth modes share one table.
2. **`profiles`** in Section 5 needs an `email text` column added.
