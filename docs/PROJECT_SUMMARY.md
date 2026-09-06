# MediMind — Project Summary

**Check the medicine first. Then remind the user.**

A complete record of what has been built so far, why it was built that way, and
what remains. Written to be lifted straight into a graduation report or used as
speaker notes for the demonstration.

_Snapshot taken 6 September 2026. Every number below was read from the
repository, not estimated._

---

## 1. At a glance

| | |
|---|---|
| Concept | **SCAN → CHECK → CONFIRM → REMIND → TRACK** — verify the medicine before scheduling anything |
| Platform | iPhone via Expo Go (primary); web browser (UI work only) |
| Stack | Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 · Expo Router · SQLite · Zustand · Zod |
| Source | 115 tracked files · ~9,700 lines across `src/`, tests, server function and scripts |
| Tests | **171 passing** in 10 suites — including real-SQLite tests and a WCAG contrast checker |
| Commits | 6, all verified (typecheck + tests + iOS and web bundles) before committing |
| Milestones | M1 Foundation ✅ · M2 UI & Auth ✅ · M3 Database & CRUD ✅ · Assistant ✅ · M4 Scanner ⬜ · M5 Reminders ⬜ · M6 Polish ⬜ |
| Native build needed | **None.** Everything runs in Expo Go — no Xcode, no Mac, no Android Studio, no Apple developer account |

---

## 2. The idea, in one paragraph

Ordinary reminder apps start by asking *when* to remind you. MediMind starts by
asking *what* you are taking: it reads the label, checks the expiry date, flags
anything it could not read, and only then suggests a reminder for you to
confirm. Every feature below serves that ordering. The governing rule, enforced
in code rather than by hope, is that **MediMind never invents medical
information** — anything it could not determine is stored as `null` and shown as
"Could not be determined", and the app never tells anyone to take more than
their label says.

---

## 3. Technology choices and the reasons behind them

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| Framework | **React Native via Expo SDK 57** | One codebase for iOS and Android; camera, notifications, speech, SQLite and secure storage are first-party modules. MIT App Inventor (mentioned in the original brief) cannot do AI vision or a real local database. |
| Language | **TypeScript, strict** | AI output is unpredictable JSON; the compiler forces every "could not read this" case to be handled instead of crashing. |
| Navigation | **Expo Router** | A file in `src/app/` is a screen. Easiest structure to explain in a viva. |
| Local database | **SQLite (`expo-sqlite`)**, local-first | The phone is the source of truth. Offline support (Phase 14) is free instead of painful, because reminders never needed the internet. |
| Cloud (planned) | **Supabase** — Postgres + Auth + Edge Functions | Real SQL, Row Level Security ("users only see their own rows" is one policy), and a place to hold the AI key server-side. |
| State | **Zustand** | ~1 KB; avoids Redux ceremony. |
| Validation | **Zod** | One schema validates the manual-entry form *and* (from M4) the AI's output, so an unreadable field becomes `null`, never a guess. |
| AI | **Claude (`claude-opus-5`)** via a server function | The key must never ship inside the app (Phase 18). The app talks to a function; the function talks to Claude. |
| Testing | **Jest + jest-expo** | Pure services and domain logic are unit-tested; SQL is tested against a real engine (see §9). |

---

## 4. What has been built

### 4.1 Milestone 1 — Foundation

- Expo SDK 57 project in `medimind/`, TypeScript strict, `@/*` path alias.
- **Design system** in `src/theme/`: colour tokens, a type scale, spacing,
  radii and touch-target sizes (48 pt minimum, 56 default, 64 for primary
  actions). Components never hardcode a colour or font size.
- **UI kit** in `src/components/ui/`: `Screen`, `AppText`, `Button`, `Card`,
  `Badge`, `TextField`, `TextLink`, `InlineMessage`, `OptionGroup`.
- Five-tab navigation shell: Home · Medicines · Ask · Schedule · History · Settings
  (Schedule and History are placeholders until M5/M6).
- Jest configured (`jest-expo/ios` preset); a `babel.config.js` was added because
  the SDK 57 template ships without one and Jest cannot parse React Native's
  Flow-typed files without it.

### 4.2 Milestone 2 — Onboarding, authentication, dashboard, settings

- **Onboarding**: three swipeable slides — Scan your medicine · Check its safety
  · Never forget your reminders — with the medical disclaimer on the last slide.
  Completion is persisted so it never replays.
- **Authentication** behind an `AuthService` interface (`src/services/auth/`):
  - `LocalAuthService` (active): accounts stored on the device in the OS
    keystore via `expo-secure-store`; passwords stored as a salted SHA-256
    digest. The file header states honestly that SHA-256 is not a password
    KDF and that real auth is Supabase's bcrypt — a limitation to *present*,
    not hide.
  - Wrong password and unknown email return the **identical** error, so the
    login screen cannot be used to discover registered addresses (tested).
  - `SupabaseAuthService` is the planned drop-in; the factory in
    `src/services/auth/index.ts` is the only file that changes.
- **Demo account** (`src/config/demo.ts`): `demo@medimind.app` /
  `medimind123`, shown openly on the login screen while Demo Mode is on, created
  through the normal sign-up path on first use. Not a backdoor: nothing is
  pre-seeded and the button disappears when Demo Mode is off.
- **Dashboard**: greeting by time of day, brand header, prominent Scan action
  (enabled in M4), medicine count, most recent medicines.
- **Settings**: profile card, Appearance (Match my phone / Light / Dark),
  Colour theme (3 palettes), Large text, High contrast, About with the full
  disclaimer, Log out with confirmation.
- **Storage resilience** (`src/lib/storage.ts`): a backend chain —
  secure-store (native) → localStorage (web) → in-memory — so a missing native
  module degrades gracefully instead of making login impossible. Settings warns
  when storage is not durable. This fixed a real bug found by testing in a
  browser.

### 4.3 Branding and accessibility

- The supplied logo (capsule + neural network) was measured pixel-by-pixel and
  every icon asset generated from it by `scripts/generate-icons.ps1`: app icon,
  Android adaptive icon (foreground/background/monochrome), splash, favicon and
  the in-app mark. Re-runnable if the logo changes.
- The palette is derived from the logo (`BRAND` in `src/theme/colors.ts`):
  navy `#17255A` for actions (white-on-navy ≈ 14:1 contrast; the brighter node
  blue would fail at 3.6:1), pill red for warnings, the logo's pale blue as the
  app background with white cards on top.
- **Three selectable palettes** (`src/theme/palettes.ts`): MediMind Blue, Clean
  White, Calm Mint — each a full light + dark set. High contrast composes on top
  of any of them.
- **`npm run check:contrast`** reads every palette out of the theme source and
  verifies 15 foreground/background pairs per palette against WCAG AA (4.5:1
  text, 3:1 outlines). All 6 palettes pass; it caught two real failures during
  development.
- Colour never carries meaning alone: every status has a written label and an
  icon; selection in pickers is shown by radio + border + fill.

### 4.4 Milestone 3 — Database and medication management

- **Schema** (`src/db/migrations.ts`), versioned with SQLite's own
  `PRAGMA user_version` so installs upgrade in place. The `medications` table
  carries `CHECK` constraints on `safety_status`, `source` and `archived` — the
  database itself rejects invalid values, whatever code path wrote them.
- **Repositories** behind `MedicationRepository` (`src/db/repositories/`):
  - `SqliteMedicationRepository` — the real one. Every query, including reads
    by primary key, is scoped by `user_id`; a user cannot reach another's row.
  - `JsonMedicationRepository` — browser fallback (expo-sqlite is alpha on
    web). The same test suite runs against both, so they cannot drift.
- **Validation** (`src/domain/medication.ts`): name required; blank optional
  fields become `null`; expiry must be `YYYY-MM-DD`, a real calendar date
  (2026-02-30 is rejected — a regex alone would accept it and `new Date()`
  would silently roll it to 2 March) and a plausible year.
- **Screens**: Medicines list with search (name, dose, instructions, notes),
  detail page showing "Could not be determined" for unknown fields, add form,
  edit form (shared component, so the rules cannot diverge), delete with
  confirmation.
- `safety_status` is deliberately left `UNKNOWN` until M4's safety engine
  exists — one place decides safety, not two.

### 4.5 Ask MediMind — the assistant

Reached from the **Ask** tab or a medicine's **Ask about this medicine** button.

- **Interface + two implementations** (`src/services/assistant/`):
  - `OfflineAssistant` — deterministic rules that read the user's own records
    back in plain language. Runs on the phone with no network. Active in Demo
    Mode. Every reply it can produce is unit-tested.
  - `ProxyAssistant` — posts to the Supabase Edge Function in
    `supabase/functions/assistant/`, which holds the Anthropic key server-side
    and calls Claude with a system prompt forbidding diagnosis, dose changes and
    interaction claims. Includes the API's refusal-fallback. Written and ready;
    not yet deployed (needs a Supabase project and an API key).
- **What it answers**: next dose ("what do I take now?"), recorded dosage,
  frequency and instructions, expiry (soonest first), missed-dose guidance
  ("do not take a double dose"), and a list of saved medicines.
- **Dose scheduling** (`src/domain/dosing.ts`): parses recorded frequency text
  — "twice daily", "every 8 hours", "at bedtime", "morning and evening", BID/TID,
  "as needed" — into clock times and computes the next dose (with a ±30-minute
  "that is now" window). Wording it cannot read yields `null`, never a default
  schedule. The **amount is always the recorded amount or "not recorded"**; it
  is never inferred.
- **Three safety layers**, applied regardless of implementation:
  1. A one-time acknowledgement before first use, in plain language, that the
     assistant can be wrong and is not a substitute for a doctor.
  2. A **client-side safety screen** (`screenQuestion`): questions about taking
     more or less than the label, stopping, maximum doses, mixing medicines or
     alcohol, pregnancy, children, or an emergency get a fixed conservative
     reply and **never reach a model**. Reading the label back ("how much do I
     take?") is allowed.
  3. A footer on **every** reply — *"May be wrong — check with your doctor or
     pharmacist"* — plus a warning banner pinned above the conversation.
- **Privacy**: the assistant is told only name, dosage, frequency, instructions,
  expiry and the app-computed schedule — never notes, photos, ids or account
  data. Conversations are not saved.

### 4.6 Platform and tooling

- **iPhone via Expo Go** is the demo target; the browser is kept working for
  fast UI work. Native-only modules get a web fallback (`database.web.ts`,
  storage chain) or an explicit "not available here" state.
- Windows Firewall and Expo Go connection troubleshooting is documented in the
  README, with an `npm run start:tunnel` escape hatch.
- Git repository initialised with a clean, secret-free history;
  `scripts/push-to-github.cmd` is a one-click push (first push needs an
  interactive GitHub sign-in).

---

## 5. Safety and security decisions (the ones to defend in a viva)

| Decision | Where | Why it matters |
|---|---|---|
| Unknown values are `null`, shown as "Could not be determined" | `domain/medication.ts`, detail screen | Blank reads as "nothing to say"; a guess is dangerous. |
| Enums enforced by `CHECK` constraints | `db/migrations.ts` | TypeScript protects the code; the constraint protects the data from *any* code. |
| Every query scoped by `user_id` | both repositories | Same guarantee as Postgres Row Level Security, applied on-device. Tested for read, update and delete. |
| No admin account, no hardcoded login | `AGENTS.md` rule | A backdoor is what an examiner looks for. The demo account is created via normal sign-up and shown openly. |
| API key never in the app | `config/env.ts`, Edge Function | Anything in the bundle can be extracted from the APK in minutes. |
| Safety screen runs *before* any AI | `domain/assistant.ts`, `stores/useAssistantStore.ts` | Dangerous questions are answered by fixed text in code, not by a model's judgement. |
| Amount never inferred; schedule never defaulted | `domain/dosing.ts`, `OfflineAssistant.ts` | The one thing a dose helper must not do is make up a dose. |
| Minimal personal data | signup collects name, email, password only; assistant context is five label fields | Least data kept is least data leaked. |
| Honest limitations documented in code | `LocalAuthService.ts` header | SHA-256 is not a password KDF; saying so is stronger than hiding it. |

---

## 6. Screens

| Screen | Route file | Status |
|---|---|---|
| Onboarding (3 slides) | `src/app/onboarding.tsx` | ✅ |
| Login (+ demo account) | `src/app/(auth)/login.tsx` | ✅ |
| Sign up | `src/app/(auth)/signup.tsx` | ✅ |
| Home dashboard | `src/app/(tabs)/index.tsx` | ✅ (Scan action enabled in M4) |
| Medicines list + search | `src/app/(tabs)/medications.tsx` | ✅ |
| Ask MediMind | `src/app/(tabs)/assistant.tsx` | ✅ |
| Schedule | `src/app/(tabs)/schedule.tsx` | placeholder (M5) |
| History | `src/app/(tabs)/history.tsx` | placeholder (M6) |
| Settings | `src/app/(tabs)/settings.tsx` | ✅ |
| Medicine detail | `src/app/medication/[id].tsx` | ✅ |
| Add medicine (manual) | `src/app/medication/add.tsx` | ✅ |
| Edit medicine | `src/app/medication/edit/[id].tsx` | ✅ |

---

## 7. Data model

```
medications (SQLite, schema v1)
  id TEXT PK · user_id · name · dosage · instructions · expiration_date
  frequency · safety_status CHECK(SAFE|EXPIRING_SOON|EXPIRED|NEEDS_REVIEW|UNKNOWN)
  source CHECK(SCAN|MANUAL) · scan_confidence · notes · image_uri
  archived CHECK(0|1) · created_at · updated_at
  indexes: (user_id, archived) · (user_id, name) · (user_id, expiration_date)

Schema v2 (Milestone 5) adds reminders and doses with
FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE.
```

Sessions, local accounts and preferences live in encrypted key-value storage,
not in SQLite.

---

## 8. Architecture in one picture

```
Screen (src/app)  →  Store (zustand)  →  Service / Repository interface  →  Implementation
     UI only           state + errors        the contract screens see        swappable

AuthService            → LocalAuthService        | SupabaseAuthService (planned)
MedicationRepository   → SqliteMedicationRepository | JsonMedicationRepository (web)
AssistantService       → OfflineAssistant        | ProxyAssistant → Claude
MedicationScannerService (M4) → MockMedicationScanner | ClaudeVisionScanner
```

Screens contain no business logic, no SQL and no AI calls. Every external
dependency sits behind an interface with a mock or offline implementation, so the
demo cannot be broken by a missing key or a dead network.

---

## 9. Testing and verification

**171 tests in 10 suites**, all passing:

| Suite | Covers |
|---|---|
| `db/migrations` | schema version, idempotence, indexes, every CHECK constraint |
| `db/MedicationRepository` | CRUD + per-user isolation, run against **both** implementations |
| `domain/medication` | validation rules, null normalisation, calendar-date rejection |
| `domain/user` | email/password schemas |
| `domain/assistant` | safety screen (blocked and allowed questions), context privacy, schedule derivation |
| `domain/dosing` | frequency parsing incl. refusals, next-dose arithmetic |
| `lib/storage` | fallback chain when the native store throws |
| `services/LocalAuthService` | sign up/in/out, no plaintext passwords, no email enumeration |
| `services/demoAccount` | create-on-first-use, reuse, conflict |
| `services/OfflineAssistant` | every reply type; never invents an amount or a time |

**SQL is tested for real.** `src/db/types.ts` defines a small `SqlDatabase`
interface so the repository can run against Node 24's built-in `node:sqlite` in
Jest — migrations, `CHECK` constraints and `COLLATE NOCASE` ordering are
executed by a genuine SQLite engine, not a mock.

**Verification before every commit:**

```powershell
npm run typecheck
npm test
npm run check:contrast   # when colours change
npx expo export --platform ios --platform web --output-dir .bundle-check
```

Web is exported deliberately: it is what catches "this native module always
exists" assumptions.

---

## 10. Bugs found and fixed along the way (worth a slide)

| Symptom | Cause | Fix |
|---|---|---|
| "MediMind could not save data" on login | App opened in a browser; `expo-secure-store` is native-only and one missing backend was fatal | Storage backend chain with honest warning |
| "Worker chunk not found: expo-sqlite/web/worker.ts" | A static import pulled SQLite's web worker into the browser bundle | `database.web.ts` platform split (a Metro wasm config only fixed the export, not the dev server) |
| Every test suite crashed with a SyntaxError | SDK 57 template has no `babel.config.js` | Added one; app bundle byte-identical |
| Divider invisible on the pale-blue background | Contrast 2.7:1 | Contrast checker found it; `borderStrong` retuned to 3.2:1 |
| Would have passed the array index as the clock time | `.map(toMedicationContext)` after adding a second parameter | Explicit arrow function; caught by tests |
| "every morning" parsed as unknown | Guard rejected any wording containing "every" | Guard narrowed to hour-based wording |

---

## 11. How to run and demonstrate today

```powershell
cd "C:\Medimind app\medimind"
npm install
npx expo start --clear
```

Scan the QR code with the iPhone Camera app (opens Expo Go). Then:

1. Onboarding → **Get started**
2. Login → **Use demo account** (or create one)
3. **Medicines → Add medicine**: try an empty name, `2026-02-30`, then a real
   entry — Paracetamol, 500 mg, twice daily, expiry 2027-04-30, "Take with food"
4. Open it → **Ask about this medicine** → "When is my next dose?"
5. **Ask** tab → "can I take two together?" to show the safety screen
6. **Settings** → switch colour theme, large text, high contrast; log out; log in

Everything above works with the phone in Airplane Mode.

---

## 12. What remains

| Milestone | Scope |
|---|---|
| **M4 — Scanner & safety** | Camera (`expo-camera`, iOS usage description), `MedicationScannerService` with `MockMedicationScanner` (safe / expired / unreadable demo scenarios) and `ClaudeVisionScanner` behind an Edge Function, scan-result confirmation screen (never auto-save), `MedicationSafetyService` (expired → prominent warning + voice, no normal reminder; missing/unclear → review) |
| **M5 — Reminders** | Schema v2 (reminders, doses), suggested schedule pre-filled from `domain/dosing.ts`, local notifications with Taken/Missed actions (works in Expo Go on iOS), Schedule tab, dose tracking, gentle missed-dose follow-up |
| **M6 — Polish** | Voice alerts (`expo-speech`), History tab, remaining Settings, Supabase auth + sync, accessibility pass, error-state pass, final test coverage |
| Deploy the assistant's Claude backend | Needs a Supabase project and an Anthropic API key — four steps in `supabase/README.md` |
| Push to GitHub | `scripts\push-to-github.cmd` — one interactive sign-in the first time |

---

## 13. Commit history

```
4395d7a  2026-09-06  Assistant: answer next-dose questions from the recorded label schedule
3c5bbb0  2026-09-06  Move the assistant into the tab bar as 'Ask' and remove the dashboard card
0891d31  2026-09-06  Add one-click push helper script
8871c7c  2026-09-06  Document typed-routes generation quirk in AGENTS.md
a478570  2026-09-06  Add Ask MediMind assistant with offline and Claude-backed implementations
9bef2f8  2026-09-03  Initial commit: MediMind Milestones 1-3
```

---

## 14. Where to look for each thing

| Topic | File |
|---|---|
| Project rules and conventions | `AGENTS.md` (also loaded as `CLAUDE.md`) |
| Setup, troubleshooting, scripts | `README.md` |
| Medical disclaimer text | `src/config/constants.ts` |
| Brand colours and palettes | `src/theme/colors.ts`, `src/theme/palettes.ts` |
| Auth contract and offline accounts | `src/services/auth/` |
| Demo account | `src/config/demo.ts`, `src/services/auth/demoAccount.ts` |
| Schema and migrations | `src/db/migrations.ts` |
| Repositories | `src/db/repositories/` |
| Medicine validation | `src/domain/medication.ts` |
| Assistant safety screen and wording | `src/domain/assistant.ts` |
| Dose scheduling | `src/domain/dosing.ts` |
| Offline assistant | `src/services/assistant/OfflineAssistant.ts` |
| Claude proxy (server) | `supabase/functions/assistant/index.ts` |
| Contrast checker | `scripts/check-contrast.js` |
| Icon generation | `scripts/generate-icons.ps1` |
| Real-SQLite test adapter | `__tests__/helpers/testDatabase.ts` |
