# Deploying MediMind — Vercel · Railway · Supabase

Three free-tier services, each doing one job. Everything below is done through
each service's website by importing the GitHub repository — no command-line
tooling on your PC is needed.

```
  iPhone (Expo Go)  ─┐
                     ├──►  Railway   ── server/ ──►  Claude API   (assistant)
  Browser (Vercel) ─┘          │
                               └──►  Supabase ── Postgres + Auth  (accounts, cloud copy of data)
```

| Service | Hosts | Repo path | Cost |
|---|---|---|---|
| **Vercel** | the web version of the app | repo root (`vercel.json`) | free |
| **Railway** | the API server that holds the Anthropic key | `server/` | free tier / ~$5 credit |
| **Supabase** | PostgreSQL database + user accounts | `supabase/schema.sql` | free |

Do them in this order — each later step needs a value from an earlier one.

---

## 1. Supabase — database and accounts (5 minutes)

1. https://supabase.com → **New project**. Name: `medimind`. Choose a region
   near you. Save the database password somewhere safe (you will rarely need it).
2. Left menu **SQL Editor → New query**. Open `supabase/schema.sql` from the
   repo, paste all of it, click **Run**. You should see "Success".
3. **Authentication → Settings**: turn **Confirm email** *off* (so demo sign-ups
   don't need an inbox).
4. **Project Settings → Data API**. Copy two values:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public** key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

   Never copy the `service_role` key anywhere.

---

## 2. Railway — the API server (5 minutes)

1. https://railway.app → **New Project → Deploy from GitHub repo** →
   choose `raithaalshamsi13-art/medimind`.
2. Railway will try to build the repo root. Change it to the server folder:
   **Settings → Source → Root Directory** = `server`.
   Railway then detects Node, runs `npm run build` and `npm start` on its own.
3. **Variables** tab → add:

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | **Recommended — free, no card.** Get one at https://aistudio.google.com/apikey (sign in with a Google account → *Create API key*). The server picks Gemini automatically when this is set. |
   | `GROQ_API_KEY` | Alternative free option: https://console.groq.com/keys. Used if no Gemini key is set. |
   | `ANTHROPIC_API_KEY` | Optional, paid: https://console.anthropic.com. Needs prepaid credit (Plans & Billing) or every request fails with "credit balance is too low". Used only if neither free key is set. |
   | `APP_ACCESS_KEY` | any long random string, e.g. 32 letters and digits |
   | `ALLOWED_ORIGIN` | your Vercel URL once you have it (step 3), e.g. `https://medimind.vercel.app` — or `*` while testing |

4. **Settings → Networking → Generate Domain**. Copy it, e.g.
   `https://medimind-server-production.up.railway.app`.
5. Check it works: open `<that domain>/health` in a browser. You should see
   `{"ok":true,"service":"medimind-server","assistant":true}`.

The app will talk to `<that domain>/assistant`.

---

## 3. Vercel — the web app (3 minutes)

1. https://vercel.com → **Add New → Project → Import** `raithaalshamsi13-art/medimind`.
2. Vercel reads `vercel.json` automatically (build: `expo export -p web`,
   output: `dist`). Leave Framework Preset as *Other*.
3. **Environment Variables** → add:

   | Variable | Value |
   |---|---|
   | `EXPO_PUBLIC_SUPABASE_URL` | from Supabase step 4 |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | from Supabase step 4 |
   | `EXPO_PUBLIC_ASSISTANT_ENDPOINT` | Railway domain + `/assistant` |
   | `EXPO_PUBLIC_ASSISTANT_ACCESS_KEY` | the same string you used for `APP_ACCESS_KEY` on Railway |

4. **Deploy**. About two minutes later you get a URL like
   `https://medimind-xyz.vercel.app`.
5. Go back to Railway and set `ALLOWED_ORIGIN` to that URL.

Every push to `main` on GitHub now redeploys Vercel and Railway automatically.

---

## 4. The phone app

Put the same four values in `medimind/.env.local` on your PC so the app you
run with `npm run start:tunnel` uses the same servers:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_ASSISTANT_ENDPOINT=https://<railway-domain>/assistant
EXPO_PUBLIC_ASSISTANT_ACCESS_KEY=...
```

Then in the app: **Settings → turn Demo Mode off**. The Ask tab's badge changes
from "Offline assistant" to "AI assistant".

---

## What each secret is, and where it lives

| Value | Secret? | Where it is allowed |
|---|---|---|
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `ANTHROPIC_API_KEY` | **Yes** | Railway variables only. Never in the app, never in Vercel, never in git. Set just one. |
| `APP_ACCESS_KEY` / `EXPO_PUBLIC_ASSISTANT_ACCESS_KEY` | No (it ships in the app) | Abuse mitigation so random traffic can't spend your AI credit. Not authentication. |
| Supabase anon key | No | Public client key; every table is protected by Row Level Security. |
| Supabase `service_role` key | **Yes** | Nowhere in this project. |

---

## Limits to know

- **The web version cannot use the camera or notifications** (browser
  limitation). It is for showing the UI, medicines and assistant on a laptop.
  The phone app via Expo Go has everything.
- **Railway's free tier sleeps** after inactivity; the first request may take
  ~10 seconds while it wakes. The app's 30-second timeout covers this.
- **The web version stores medicines in the browser** (`JsonMedicationRepository`),
  not SQLite, until Milestone 6 adds cloud sync.
