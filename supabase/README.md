# Supabase — database and accounts

Supabase provides MediMind's cloud PostgreSQL database and user accounts. It is
the server-side mirror of the on-device SQLite schema, with **Row Level
Security** so every user can only reach their own rows.

| File | Purpose |
|---|---|
| `schema.sql` | Tables (`profiles`, `medications`, `reminders`, `doses`), indexes, RLS policies, triggers |

The AI proxy is **not** here — it runs on Railway (see `../server/`).

## Setup (once)

1. Create a project at https://supabase.com (free tier).
2. **SQL Editor → New query**, paste the whole of `schema.sql`, **Run**.
3. **Authentication → Providers**: leave Email enabled. For a smoother demo,
   turn **Confirm email** off (Authentication → Settings) so sign-ups work
   without checking an inbox.
4. **Project Settings → Data API**: copy the **Project URL** and the
   **anon public** key into the app's `.env.local`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

   Also add both as Environment Variables on the Vercel project.

The anon key is a **public** client key — it is safe in the app bundle because
every table is protected by RLS. The `service_role` key must never be used in
the app or in Vercel.

## What the app does with it

- `SupabaseAuthService` (Milestone 6) signs users up and in against Supabase
  Auth, replacing the on-device `LocalAuthService` when these variables are set.
- `SyncService` (Milestone 6) mirrors medicines, reminders and doses to these
  tables. The phone remains the source of truth; the cloud is a backup and a
  way to use a second device.
