# MediMind

**Check the medicine first. Then remind the user.**

MediMind is a medication-management app built around a five-stage workflow:

```
SCAN  →  CHECK  →  CONFIRM  →  REMIND  →  TRACK
```

Unlike an ordinary reminder app, MediMind verifies the medicine *before* it
schedules anything: it reads the label, checks the expiry date and flags missing
information, and only then suggests a reminder for the user to confirm.

> **MediMind is an informational medication-management and reminder tool.** It
> helps you read and organise what is printed on a medicine label. It does not
> diagnose conditions, prescribe medication, or replace advice from a doctor or
> pharmacist.

---

## Project summary

A complete record of everything built so far, the reasoning behind each decision,
test coverage, bugs fixed, and what remains is kept in
[docs/PROJECT_SUMMARY.md](docs/PROJECT_SUMMARY.md). It is written to be lifted
straight into the graduation report.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Native via **Expo SDK 57** (RN 0.86, React 19.2) |
| Language | **TypeScript**, strict mode |
| Navigation | **Expo Router** (file-based, routes live in `src/app/`) |
| Local database | **SQLite** (`expo-sqlite`) — local-first, the phone is the source of truth |
| Cloud backend | **Supabase** — PostgreSQL + Auth + Edge Functions, with Row Level Security |
| Auth | Supabase Auth (email + password), session cached in `expo-secure-store` |
| Notifications | `expo-notifications` — locally scheduled, works offline |
| AI label reading | `MedicationScannerService` interface: mock ⇄ Claude vision (via Edge Function) |
| Voice alerts | `expo-speech` (on-device text-to-speech) |
| State | **Zustand** |
| Validation | **Zod** — also validates AI output so unreadable fields become `null`, never invented |
| Testing | Jest + `jest-expo` + `@testing-library/react-native` |

---

## Getting started

### Requirements

- **Node.js 22.13+** (this project is developed on Node 24)
- An **iPhone** with the free **Expo Go** app
- No Xcode, no Mac, no Android Studio, no Apple Developer account, and **no
  native build step** — every MediMind feature, including local notifications
  with action buttons, runs inside Expo Go on iOS.

### Run it

```powershell
cd medimind
npm install
npm start
```

Then scan the QR code shown in the terminal with the iPhone's **Camera** app,
which opens it in Expo Go. The app reloads automatically as files change.

**Troubleshooting the connection on Windows**

- *Camera says "No usable data found"* — Expo Go is not installed. The QR
  encodes an `exp://` link, and without Expo Go nothing on the phone can open
  it.
- *Expo Go opens but cannot reach the server* — Windows Firewall is blocking
  inbound connections to Metro. Either run `npm run start:tunnel` (no admin
  rights needed), or fix it once in an **Administrator** PowerShell:

  ```powershell
  # Windows blocks Node inbound by default if the firewall prompt was dismissed
  Get-NetFirewallRule -DisplayName "Node.js JavaScript Runtime" |
    Where-Object { $_.Action -eq 'Block' } | Remove-NetFirewallRule

  # Mark the home Wi-Fi as Private, then allow Metro's port on that profile
  Set-NetConnectionProfile -InterfaceAlias "Wi-Fi 2" -NetworkCategory Private
  New-NetFirewallRule -DisplayName "Expo Metro 8081" -Direction Inbound `
    -Protocol TCP -LocalPort 8081 -Action Allow -Profile Private
  ```

  A `Block` rule always beats an `Allow` rule in Windows Firewall, which is why
  the existing block has to be removed rather than just overridden.

### Target platforms

**iOS via Expo Go is the primary target** — it is where the app is developed and
demonstrated. The web build is kept working as a convenience for fast UI work,
but it cannot run the core features:

| | iOS (Expo Go) | Web |
|---|---|---|
| UI, navigation, auth, settings | ✅ | ✅ |
| SQLite database | ✅ | ⚠️ alpha; needs WASM + COOP/COEP headers |
| Camera label scanning | ✅ | ❌ |
| Local notifications | ✅ | ❌ |
| Voice alerts | ✅ | ⚠️ partial |

Native-only modules must therefore always have a web fallback or an explicit
"not available here" state — see [src/lib/storage.ts](src/lib/storage.ts) for
the pattern.

### Useful scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Metro dev server (phone connects over the LAN) |
| `npm run start:tunnel` | Same, but routed through ngrok — use when Windows Firewall or a public/campus Wi-Fi blocks the LAN connection |
| `npm run android` | Start and open on a connected Android device/emulator |
| `npm test` | Run the Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript check with no emit |
| `npm run lint` | Expo ESLint |

Before claiming a change works, run all three:

```powershell
npm run typecheck
npm test
npx expo export --platform ios --platform web --output-dir .bundle-check  # then delete it
```

Both platforms matter: `ios` is the demo target, and `web` catches assumptions
that a native module always exists.

### Environment configuration

```powershell
Copy-Item .env.example .env.local
```

`.env.local` is git-ignored. **Only publishable values belong in it** — everything
prefixed `EXPO_PUBLIC_` is compiled into the app bundle and readable by anyone
who downloads the app. The Anthropic API key is *never* stored here; it lives as
a secret on the Supabase Edge Function.

The app runs fully without any configuration: with no Supabase URL it stays
local-only, and with no scan endpoint it uses the mock scanner (demo mode).

---

## Project structure

```
src/
├── app/                  Expo Router — every file here is a screen
│   ├── _layout.tsx       root: providers, launch sequence, auth gate
│   ├── onboarding.tsx    3 slides: scan → check → remind
│   ├── (auth)/           login, signup
│   └── (tabs)/           Home · Medicines · Schedule · History · Settings
├── components/
│   ├── ui/               design system: Screen, AppText, Button, Card,
│   │                     Badge, TextField, TextLink, InlineMessage
│   └── auth/             AuthHeader
├── config/               constants, disclaimer text, typed env access
├── db/
│   ├── database.ts       opens SQLite, runs migrations
│   ├── migrations.ts     versioned schema, driven by PRAGMA user_version
│   ├── types.ts          SqlDatabase — the interface that makes SQL testable
│   └── repositories/     MedicationRepository + SQLite and JSON implementations
├── domain/               entity types + Zod validation schemas
├── lib/                  Result type, error catalogue, storage, dates, ids
├── services/
│   └── auth/             AuthService interface + LocalAuthService
├── stores/               Zustand stores (auth, settings, medications)
└── theme/                colour / type / spacing tokens + ThemeProvider

__tests__/                Jest suites, mirroring src/
```

Planned additions, by milestone:

```
src/services/
├── scanner/              MedicationScannerService + implementations  (M4)
├── safety/               MedicationSafetyService                     (M4)
├── notifications/        scheduling, permissions, actions            (M5)
└── voice/                text-to-speech                              (M6)
```

### The database

Medicines live in **SQLite** on the device. The schema is versioned with
SQLite's own `PRAGMA user_version`, so an existing install upgrades in place
instead of losing data — see [src/db/migrations.ts](src/db/migrations.ts).

Two details worth knowing:

- **Enums are enforced by the database**, not only by TypeScript. `safety_status`,
  `source` and `archived` all carry `CHECK` constraints, so no code path can
  store an invalid value.
- **Every query is scoped by `user_id`**, including reads by primary key. A
  caller cannot fetch a medicine without proving whose it is, which is the
  same guarantee Row Level Security gives in Postgres.

`MedicationRepository` has two implementations, chosen in
[src/db/repositories/index.ts](src/db/repositories/index.ts): SQLite on the
phone, and a JSON store in the browser (where `expo-sqlite` is alpha). The same
test suite runs against both, so the fallback cannot drift.

### Authentication

`AuthService` is an interface with swappable implementations, selected in
[src/services/auth/index.ts](src/services/auth/index.ts):

- **`LocalAuthService`** (active) — accounts stored on the device, encrypted by
  the OS keystore. Works with no internet, no backend and no API keys, so the
  demo can never be broken by an outage. Passwords are stored as a salted
  SHA-256 digest; see the file header for an honest note on that limitation.
- **`SupabaseAuthService`** (Milestone 2b) — real cloud auth with server-side
  bcrypt hashing, enabled automatically once `EXPO_PUBLIC_SUPABASE_URL` and
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set.

No screen imports either implementation directly.

**There is no admin account and no preset login.** Every account is created
through Sign up and lives only on the device that created it.

For demonstrations, the login screen offers a **"Use demo account"** button
while Demo Mode is on:

```
Email:    demo@medimind.app
Password: medimind123
```

Pressing it creates that account through the ordinary sign-up path the first
time and simply signs in thereafter. The credentials are displayed on screen,
the button disappears when Demo Mode is switched off, and nothing is pre-seeded
— so it is a convenience, not a backdoor. Defined in
[src/config/demo.ts](src/config/demo.ts).

### Branding

The palette in [src/theme/colors.ts](src/theme/colors.ts) is derived from the
MediMind logo, with the source colours declared up front as `BRAND`:

| Token | Colour | From |
|---|---|---|
| `navy` | `#17255A` | capsule outline + wordmark |
| `nodeBlue` | `#2E7FD4` | the neural-network nodes |
| `pillRed` | `#D32F27` | lower half of the capsule |
| `paleBlue` | `#DDEDF9` | the logo's background panel |

The light theme uses the logo's own arrangement: **pale blue as the app
background, white cards on top**. That inversion is what makes the app read as
MediMind rather than as a white app with a logo in the corner.

Navy is the primary action colour rather than the brighter node blue, because
white-on-navy reaches ~14:1 contrast while white-on-`#2E7FD4` is only ~3.6:1 —
below the 4.5:1 WCAG minimum for body text.

### Themes

Settings offers two independent choices:

- **Appearance** — Match my phone / Light / Dark
- **Colour theme** — MediMind Blue (default), Clean White, Calm Mint

Palettes live in [src/theme/palettes.ts](src/theme/palettes.ts), each a full
`ColorTokens` set for light and dark. Adding one means adding two literals plus
a registry entry; the Settings picker is generated from the registry, so no
screen changes. "High contrast" composes on top of whichever palette is
selected, replacing it with maximum-contrast black and white.

Colour choices are checked, not eyeballed:

```powershell
npm run check:contrast
```

[scripts/check-contrast.js](scripts/check-contrast.js) reads every palette
straight out of the theme source and verifies 15 foreground/background pairs
per palette against WCAG AA — 4.5:1 for text, 3:1 for input outlines and
dividers. It exits non-zero on failure. **Run it after changing any colour or
adding a palette.**

**All icon assets are generated** from `assets/images/logo-lockup.png` (the
master artwork) by [scripts/generate-icons.ps1](scripts/generate-icons.ps1):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
```

It crops the capsule mark out of the banner, colour-keys the pale-blue panel to
transparency with a graded alpha ramp, and renders the app icon, Android
adaptive icon (foreground/background/monochrome), splash image, favicon, and
the in-app `logo-mark.png`. Re-run it after changing the logo.

The mark is rendered in-app only through
[`<Logo/>`](src/components/brand/Logo.tsx), which has `mark`, `lockup` and
`stacked` variants. The wordmark is drawn as **text**, not as part of the
image, so it follows the theme — the logo's black lettering would be invisible
in dark mode.

### Architectural rules

1. **Screens contain no business logic.** A file in `src/app/` renders UI and
   calls a store or a service. Nothing else.
2. **Safety decisions live in exactly one place** — `MedicationSafetyService`.
   It is a pure function of its inputs, so it is fully unit-testable.
3. **Database access goes through repositories.** No SQL in components.
4. **The app is never coupled to one AI provider.** Screens depend on the
   `MedicationScannerService` interface, not on any implementation.
5. **Colour never carries meaning alone.** Every safety state also renders a
   written label and an icon.
6. **AI output is never trusted or auto-saved.** It is validated with Zod,
   fields that could not be read become `null`, and the user confirms or edits
   every value before anything is stored.

---

## Development milestones

| Milestone | Scope | Status |
|---|---|---|
| **M1** | Project setup, design system, navigation | ✅ Complete |
| **M2** | Splash, onboarding, auth, home dashboard, accessibility settings | ✅ Complete |
| **M3** | SQLite schema + migrations, repositories, medication CRUD, manual entry | ✅ Complete |
| **M4** | Camera, scanner abstraction + mock, scan confirmation, safety engine, demo mode | ⬜ Next |
| **M5** | Suggested reminders, local notifications, dose tracking | ⬜ |
| **M6** | Voice alerts, offline sync, settings, accessibility, error handling, tests | ⬜ |

### Ask MediMind (the assistant)

A chat screen in the bottom tab bar (**Ask**), also reachable from a
medicine's **Ask about this medicine** button, that answers questions about the user's
saved medicines: when they expire, what dosage or instructions were recorded,
what to do about a missed dose.

Two implementations behind one interface, chosen in
[src/services/assistant/index.ts](src/services/assistant/index.ts):

- **`OfflineAssistant`** (active in Demo Mode, and whenever no proxy is
  configured) — deterministic rules that read the user's own records back in
  plain language. Needs no network. Every reply it can give is unit-tested.
- **`ProxyAssistant`** — sends the question to the Supabase Edge Function in
  [supabase/functions/assistant](supabase/functions/assistant/index.ts), which
  holds the Anthropic API key server-side and calls Claude with a system prompt
  that forbids diagnosis, dosing advice and interaction claims. The app never
  sees the key.

Three safety layers apply regardless of implementation:

1. **A one-time acknowledgement** the user must accept before first use, stating
   that the assistant can be wrong and is not a substitute for a doctor.
2. **A client-side safety screen** (`screenQuestion` in
   [src/domain/assistant.ts](src/domain/assistant.ts)) that intercepts questions
   about changing doses, mixing medicines, pregnancy, children or emergencies
   and answers them with a fixed conservative message — they never reach a
   model.
3. **A footer on every reply bubble** — "May be wrong — check with your doctor or
   pharmacist" — plus a warning banner pinned above the conversation.

The assistant is told only `name`, `dosage`, `frequency`, `instructions` and
`expirationDate` for each medicine — never notes, photos, ids or account data —
and the conversation is not persisted.
