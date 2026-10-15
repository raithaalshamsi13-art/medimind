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

## 2a. The API on Vercel — free, no Railway (recommended)

Since 15 Oct 2026 the same API code also runs as a **Vercel serverless
function** (`api/[...path].ts` → `server/src/app.ts`), inside the project
that already hosts the web app. Nothing extra to deploy, nothing to pay for:
Vercel's Hobby plan is free, and the Gemini key is free.

1. In the Vercel project → **Settings → Environment Variables** add, for
   *Production* (and Preview if you use it):

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | from https://aistudio.google.com/apikey (free, no card). **Not** prefixed `EXPO_PUBLIC_`, so it stays on the server and never reaches the app bundle. |
   | `APP_ACCESS_KEY` | any long random string |
   | `EXPO_PUBLIC_ASSISTANT_ENDPOINT` | `https://<your-vercel-domain>/api/assistant` — the app derives `/api/scan` and `/api/health` from it |
   | `EXPO_PUBLIC_ASSISTANT_ACCESS_KEY` | the same string as `APP_ACCESS_KEY` |

2. **Deployments → Redeploy** the latest deployment (environment variables
   are baked into the web build at deploy time).
3. Open `https://<your-vercel-domain>/api/health`. You should see
   `{"ok":true,"service":"medimind-server","version":"1.8.1","assistant":true,"scan":true,"provider":"gemini",...}`.
   The reply also has a `config` block that says, name by name, which
   variables **this deployment** can see (true / false, never the value) and
   a `deployment` block with the environment and commit. `assistant:false`
   with `"GEMINI_API_KEY":false` means the variable is not attached to this
   deployment: it is missing, it was saved for a different environment
   (Preview / Development instead of Production), its name is misspelt, or
   it was added after the deploy — add it for Production and **Redeploy**.
4. On the PC, put the same `EXPO_PUBLIC_ASSISTANT_ENDPOINT` and
   `EXPO_PUBLIC_ASSISTANT_ACCESS_KEY` in `medimind/.env.local` so Expo Go uses it.

Limits of the free function: 60 s per request (set in `vercel.json`; label
reading takes 5–15 s) and a 4.5 MB request body — the app resizes photos to
about 300 KB before sending, so this is never reached.

The Railway route below still works and is unchanged; use one or the other.

## 2b. Railway — the API server (alternative, about US$5 a month)

1. https://railway.app → **New Project → Deploy from GitHub repo** →
   choose `raithaalshamsi13-art/medimind`.
2. Railway will try to build the repo root. Change it to the server folder:
   **Settings → Source → Root Directory** = `server`.
   Railway then detects Node, runs `npm run build` and `npm start` on its own.
3. **Variables** tab → add:

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | **Recommended — free, no card.** Get one at https://aistudio.google.com/apikey (sign in with a Google account → *Create API key*). The server picks Gemini automatically when this is set. Default model `gemini-3.6-flash`; override with a `GEMINI_MODEL` variable if Google retires it — their error message names the replacement. |
   | `GROQ_API_KEY` | Alternative free option: https://console.groq.com/keys. Used if no Gemini key is set. |
   | `ANTHROPIC_API_KEY` | Optional, paid: https://console.anthropic.com. Needs prepaid credit (Plans & Billing) or every request fails with "credit balance is too low". Used only if neither free key is set. |
   | `APP_ACCESS_KEY` | any long random string, e.g. 32 letters and digits |
   | `ALLOWED_ORIGIN` | your Vercel URL once you have it (step 3), e.g. `https://medimind.vercel.app` — or `*` while testing |

4. **Settings → Networking → Generate Domain**. Copy it, e.g.
   `https://medimind-server-production.up.railway.app`.
5. Check it works: open `<that domain>/health` in a browser. You should see
   `{"ok":true,"service":"medimind-server","version":"1.8.1","assistant":true,"scan":true,...}`.
   If `version` is older than the one in `server/src/index.ts`, Railway has
   not picked up the latest push: open the service → **Deployments →
   Redeploy**, or connect the Railway GitHub App so pushes deploy automatically.

   **If you get a plain 404 (empty page, response header `server:
   railway-hikari`) on `/health`** — this is what happened on 15 Oct 2026 —
   nothing is deployed at that domain any more. Railway's edge answers 404
   when the service has been stopped or removed, when the project is paused
   (trial or credit exhausted), or when the public domain was deleted or
   regenerated. Open the Railway project and check: is the service there, is
   its latest deployment **Active**, and does **Settings → Networking** still
   show this exact domain? Fix whichever it is (redeploy, add credit, or
   generate a domain again and put the new one in Vercel's
   `EXPO_PUBLIC_ASSISTANT_ENDPOINT` and in `.env.local`, then redeploy Vercel).
   In the app, **Settings → Scanner → Test connection** shows the same three
   checks (internet, server, label reading) on the phone.

   `scan` in the health reply is `true` when label reading is possible
   (Gemini or Claude key). With only a Groq key it is `false`: chat works,
   scanning does not.

The app will talk to `<that domain>/assistant` (the chat) and
`<that domain>/scan` (label reading — the app derives it from the assistant
endpoint, or set `EXPO_PUBLIC_SCAN_ENDPOINT` to point somewhere else).
**Label reading needs a vision model:** Gemini or Claude. Groq has no vision
model, so with only a Groq key the app's scanner stays on the demo reader and
`/scan` answers 501.

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
   | `EXPO_PUBLIC_ASSISTANT_ENDPOINT` | `https://<your-vercel-domain>/api/assistant` (API on Vercel, §2a) or Railway domain + `/assistant` (§2b) |
   | `EXPO_PUBLIC_ASSISTANT_ACCESS_KEY` | the same string you used for `APP_ACCESS_KEY` on Railway |
   | `EXPO_PUBLIC_SCAN_ENDPOINT` | optional — only if the scanner should use a different URL than Railway domain + `/scan` |

4. **Deploy**. About two minutes later you get a URL like
   `https://medimind-xyz.vercel.app`.
5. If you use Railway, go back to it and set `ALLOWED_ORIGIN` to that URL.

Every push to `main` on GitHub now redeploys Vercel (web app + API function)
and, if connected, Railway automatically.

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

The Ask tab then chats through the server automatically — its header reads
"AI chat · falls back to offline answers". Demo Mode does not affect the chat.

---

## 5. On-device label reading — the development build (no Railway needed)

Scanning can run entirely on the iPhone with Apple's Vision framework
(`modules/label-ocr/`). That code is native, and **Expo Go cannot load
native code**, so it needs a *development build* of MediMind — a one-off
build made in the cloud by Expo's EAS service. No Mac is needed. What is
needed:

- an **Apple Developer Program** membership (US$99 / year) — Apple requires
  it to install a self-built app on a physical iPhone. (Without it the only
  route is a Mac with Xcode and a free Apple ID, which installs for 7 days
  at a time.) If you keep Railway instead, the hobby plan is about US$5 /
  month — pick whichever is cheaper for you; the app works with either.
- a free Expo account (expo.dev).

Steps, once, on the PC:

```powershell
cd medimind
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

The first run asks you to sign in to your Apple account and lets EAS create
the signing certificate and register your iPhone (it shows a QR code to
register the device — scan it on the iPhone). The build takes 10–20
minutes; EAS then shows a link / QR code to install "MediMind" on the phone.

Then, every day:

```powershell
npm start
```

and open the **MediMind** app (not Expo Go) — it connects to the same dev
server. Settings → Scanner should say *Label reading happens on this
iPhone (Apple Vision)*, and the scan screen shows *Reading on this iPhone*.
With that build, `EXPO_PUBLIC_ASSISTANT_ENDPOINT` is only needed for the
chat; scanning works in Airplane Mode.

What on-device reading does and does not do: it reads the printed words
and copies the strength, form, ingredients, expiry (only after an EXP /
Use by marker) and the most prominent line as the name — which it trusts
only when that line is clearly the largest text, otherwise it asks you to
confirm. It does **not** verify what the medicine is, whether it is safe,
or how much to take, and it does not translate to Arabic.

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
