# MediMind — Project Summary

**Check the medicine first. Then remind the user.**

A complete record of what has been built so far, why it was built that way, and
what remains. Written to be lifted straight into a graduation report or used as
speaker notes for the demonstration.

_Last updated 13 September 2026. Every number below was read from the
repository, not estimated. This file is kept current with every commit: each
step adds an entry to §18 (change log) and updates the sections it touches._

---

## 1. At a glance

| | |
|---|---|
| Concept | **SCAN → CHECK → CONFIRM → REMIND → TRACK** — verify the medicine before scheduling anything |
| Platform | iPhone via Expo Go (primary); web browser (UI work only) |
| Stack | Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript 6 · Expo Router · SQLite · Zustand · Zod |
| Source | 170 tracked files · ~16,500 lines across `src/`, tests, the API server, scripts and SQL |
| Tests | **259 passing** in 16 suites — including real-SQLite tests and a WCAG contrast checker |
| Commits | 30, all verified (typecheck + tests + iOS and web bundles) before committing |
| Milestones | M1 Foundation ✅ · M2 UI & Auth ✅ · M3 Database & CRUD ✅ · Assistant ✅ · Deployment ✅ · Structured entry + health conditions ✅ · Family profiles ✅ · M4 Scanner ⬜ · M5 Reminders ⬜ · M6 Polish ⬜ |
| Live | Web: https://medimind-medimind3.vercel.app · API: Railway (`/health` shows version + model) · Accounts/DB: Supabase |
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
| Cloud database + accounts | **Supabase** — Postgres + Auth | Real SQL and Row Level Security ("users only see their own rows" is one policy). Schema in `supabase/schema.sql`. |
| API server | **Node on Railway** (`server/`) | Holds the AI key server-side; provider-agnostic (Gemini / Groq / Claude), with validation and rate limiting. |
| Web hosting | **Vercel** (`vercel.json`) | Static export of the app, redeployed on every push. |
| State | **Zustand** | ~1 KB; avoids Redux ceremony. |
| Validation | **Zod** | One schema validates the manual-entry form *and* (from M4) the AI's output, so an unreadable field becomes `null`, never a guess. |
| AI | **Google Gemini (free tier)** via the Railway server; Groq or Claude are drop-in alternatives chosen by which key is set | The key must never ship inside the app (Phase 18). The app talks to the server; the server talks to the model. A free provider keeps the demo independent of any paid balance. |
| Testing | **Jest + jest-expo** | Pure services and domain logic are unit-tested; SQL is tested against a real engine (see §9). |

---

## 4. What has been built

### 4.1 Milestone 1 — Foundation

- Expo SDK 57 project in `medimind/`, TypeScript strict, `@/*` path alias.
- **Design system** in `src/theme/`: colour tokens, a type scale, spacing,
  radii and touch-target sizes (48 pt minimum, 56 default, 64 for primary
  actions). Components never hardcode a colour or font size.
- **UI kit** in `src/components/ui/`: `Screen`, `AppText`, `Button`, `Card`,
  `Badge`, `TextField`, `TextLink`, `InlineMessage`, `OptionGroup`, and (added
  with the structured form) `ChoiceChips` / `MultiChoiceChips`, `DateField`
  (native picker, browser date input on web), `Collapsible`, `FormSection`.
- Six-tab navigation shell: Home · Medicines · Ask · Schedule · History · Settings
  (Schedule and History are placeholders until M5/M6). Icon-only in portrait,
  labels beside the icons in landscape; the bar is sized explicitly to clear
  the iPhone home indicator, including when saved to the home screen from Safari.
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

**Structured manual entry (schema v2).** The add/edit form is now five short
numbered sections instead of six free-text boxes:

1. *About the medicine* — name (the only required field), **type** chips
   (Prescription / Over the counter / Supplement) and **form** chips (tablet,
   capsule, liquid, inhaler, injection, cream, drops, patch, spray, other),
   stored in the new nullable `kind` and `form` columns.
2. *Dose and how often* — amount + unit chips (mg, g, mcg, ml, IU, tablet(s),
   puff(s), drop(s)) and frequency chips (once/twice/3×/4× a day, every N
   hours, only when needed, something else). These still **compose to the
   existing text columns** (`"500 mg"`, `"Twice daily"`) so the assistant and
   `parseFrequency` keep working; `domain/medicationOptions.ts` also parses
   stored text back into chips for editing, and keeps anything it does not
   recognise verbatim as "custom" — nothing is ever rewritten.
3. *Expiry date* — a real calendar (`DateField`: native picker on the phone,
   `<input type="date">` on web via a `.web.tsx` split) with a live badge from
   `domain/expiry.ts`: **Expired** / **Expires in N days** (30-day window) /
   **In date**. The same function will feed the M4 safety engine.
4. *Instructions* — multi-select chips (with food, before food, at bedtime,
   do not crush…) plus a folded "Other instructions" box.
5. *Health conditions* — see below. Notes are folded away until needed.

**Health conditions.** `health_conditions` (per user) and
`medication_conditions` (links, `ON DELETE CASCADE`) tables; a preset list
(high blood pressure, diabetes, low blood sugar, asthma, high cholesterol,
heart, thyroid, kidney, arthritis, other + custom name), an optional *latest
reading* stored as typed, and notes. The **My health conditions** screen
(Settings → My health) adds / edits / removes them; the medicine form links a
medicine to any of them and can add one inline. This is strictly a notebook:
readings are never interpreted, and conditions are **not sent to the
assistant**.

### 4.4b Family — one account, many profiles

One account manages medicines for several people **without separate logins**.

- **Model** (`src/domain/familyMember.ts`, schema v3): a `family_members`
  table — name, relationship (Me / Mother / Father / Spouse / Son / Daughter /
  Grandmother / Grandfather / Other + custom wording), optional date of birth
  (shown as an age), an avatar colour (a theme role, so it follows the palette
  and dark mode) and an `is_self` flag. A partial unique index guarantees
  exactly one "Me" per account. `medications` and `health_conditions` gain a
  `member_id` with `ON DELETE CASCADE`.
- **"Me" is automatic and existing data is kept.** On first load
  `ensureSelf()` creates the account holder's profile and assigns every
  medicine and condition recorded before v3 to it (SQLite: one UPDATE inside
  the same transaction; JSON: by hand). Tested on both backends.
- **Reuse, not duplication.** No second medicine system: the same
  repositories, stores, form, detail and edit screens carry a `memberId`, and
  screens filter by the *active* member (`useFamilyStore.activeMemberId`,
  remembered per account across launches).
- **Whose data is on screen is always visible.** A `MemberContextBanner`
  ("Adding medicine for: Fatima · Mother", "Showing medicines for…",
  "Answering about medicines for…") sits on the add / edit / detail /
  conditions / assistant screens; the Medicines tab and home dashboard have a
  member switcher; the Add button carries the member's id, so a medicine can
  only be saved under the person on screen, and the add screen refuses to
  render a form without one.
- **Family tab** (replaces the empty History placeholder in the bar; dose
  history will live in Schedule from M5): member cards with avatar, relation,
  age and counts, a "Managing now" badge, a welcoming empty state until a
  second person is added, and **Add family member**.
- **Member dashboard** (`/family/[id]`): overview tiles (medicines, expired or
  expiring, conditions), recent medicines, conditions, a Schedule placeholder
  for M5, Add medicine, Manage conditions, Switch to managing, Edit profile,
  Remove.
- **Removal is deliberate.** The confirmation spells out what goes with the
  person ("This also deletes their 3 medicines and 1 health condition"), and
  the "Me" profile cannot be removed (`NOT_ALLOWED`, enforced in both
  repositories and hidden in the UI).
- **Assistant privacy** improves as a side effect: the assistant now only
  ever receives one person's medicines — the medicine it was opened for, else
  the active member — so two relatives' medicines are never mixed in one answer.

### 4.5 Ask MediMind — the assistant

Reached from the **Ask** tab or a medicine's **Ask about this medicine** button.

- **Interface + two implementations** (`src/services/assistant/`):
  - `OfflineAssistant` — deterministic rules that read the user's own records
    back in plain language. Runs on the phone with no network. Active in Demo
    Mode. Every reply it can produce is unit-tested.
  - `ProxyAssistant` — posts to the MediMind API server in `server/`
    (deployed on Railway), which holds the AI key server-side and calls the
    model with a system prompt forbidding diagnosis, dose changes and
    interaction claims. The server is **provider-agnostic**
    (`server/src/providers.ts`): Google Gemini (free tier, the live default,
    `gemini-3.6-flash`), Groq (free) or Anthropic Claude (paid) — chosen by
    which key is set in Railway, `AI_PROVIDER` to force one. Includes the
    refusal fallback, per-IP rate limiting, an app access key and a `/health`
    endpoint reporting version, provider and model. **Live and verified**: it
    answers next-dose questions correctly and refuses double-dose questions.
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
| API key never in the app | `config/env.ts`, `server/` | Anything in the bundle can be extracted from the APK in minutes. |
| Safety screen runs *before* any AI | `domain/assistant.ts`, `stores/useAssistantStore.ts` | Dangerous questions are answered by fixed text in code, not by a model's judgement. |
| Amount never inferred; schedule never defaulted | `domain/dosing.ts`, `OfflineAssistant.ts` | The one thing a dose helper must not do is make up a dose. |
| Minimal personal data | signup collects name, email, password only; assistant context is five label fields | Least data kept is least data leaked. |
| Honest limitations documented in code | `LocalAuthService.ts` header | SHA-256 is not a password KDF; saying so is stronger than hiding it. |
| Health conditions are a notebook, not a clinical record | `domain/healthCondition.ts`, `AGENTS.md` rule | Readings are stored and shown as typed — never parsed, ranged or coloured good/bad — and are never sent to the assistant. Anything more would be diagnosis. |
| Expiry decided in one place | `domain/expiry.ts` | The form's live "Expired / Expires in N days" badge and the M4 safety engine share one function, so they can never disagree. Calendar days only, no time-of-day edge cases. |
| Structured choices never rewrite label text | `domain/medicationOptions.ts` | Chips compose to the stored text; anything unrecognised (e.g. scanned wording) is kept verbatim as "custom". Round-tripping is unit-tested. |
| One person's data can never appear under another | `member_id` on medicines and conditions; `MemberContextBanner`; `useFamilyStore` | Separation is a column on every row, not a screen remembering to filter. Every screen names whose data it shows; the add form will not render without a member. |
| Removing a family member is explicit and complete | `FamilyRepository.remove`, `/family/[id]` | The confirmation lists the medicines and conditions that go with them; "Me" cannot be removed; cascades are tested on both backends. |
| AI key lives only in Railway variables | `docs/DEPLOYMENT.md` | Never in the app, never in Vercel, never in git. Supabase `service_role` key is used nowhere; the anon key is public by design and every table has Row Level Security. |

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
| Family | `src/app/(tabs)/family.tsx` | ✅ members, counts, empty state |
| Family member dashboard | `src/app/family/[id].tsx` | ✅ |
| Add / edit family member | `src/app/family/add.tsx`, `src/app/family/edit/[id].tsx` | ✅ shared form |
| History | `src/app/(tabs)/history.tsx` | placeholder, hidden from the bar (folds into Schedule in M5) |
| Settings | `src/app/(tabs)/settings.tsx` | ✅ |
| Medicine detail | `src/app/medication/[id].tsx` | ✅ |
| Add medicine (manual) | `src/app/medication/add.tsx` | ✅ sectioned, chips + date picker |
| Edit medicine | `src/app/medication/edit/[id].tsx` | ✅ same form |
| Health conditions (per family member) | `src/app/health/conditions.tsx` | ✅ |

---

## 7. Data model

```
family_members (schema v3)  — profiles under one account, no separate login
  id TEXT PK · user_id · name
  relationship CHECK(ME|MOTHER|FATHER|SPOUSE|SON|DAUGHTER|GRANDMOTHER|GRANDFATHER|OTHER)
  custom_relationship · date_of_birth · avatar_color CHECK(primary|info|success|warning|danger)
  is_self CHECK(0|1) · created_at · updated_at
  indexes: (user_id, is_self) · UNIQUE (user_id) WHERE is_self = 1   ← exactly one "Me"

medications (SQLite, schema v1 + v2 + v3 columns)
  id TEXT PK · user_id · member_id → family_members(id) ON DELETE CASCADE   ← v3
  name · dosage · instructions · expiration_date
  frequency · safety_status CHECK(SAFE|EXPIRING_SOON|EXPIRED|NEEDS_REVIEW|UNKNOWN)
  source CHECK(SCAN|MANUAL) · scan_confidence · notes · image_uri
  archived CHECK(0|1) · created_at · updated_at
  kind CHECK(NULL|PRESCRIPTION|OTC|SUPPLEMENT)                       ← v2
  form CHECK(NULL|TABLET|CAPSULE|LIQUID|INHALER|INJECTION|CREAM|
             DROPS|PATCH|SPRAY|OTHER)                                 ← v2
  indexes: (user_id, archived) · (user_id, name) · (user_id, expiration_date)

health_conditions (schema v2, + member_id in v3)
  id TEXT PK · user_id · member_id → family_members(id) ON DELETE CASCADE
  type CHECK(HIGH_BLOOD_PRESSURE|DIABETES|LOW_BLOOD_SUGAR|
    ASTHMA|HIGH_CHOLESTEROL|HEART|THYROID|KIDNEY|ARTHRITIS|OTHER)
  custom_name (required by the app when type = OTHER) · reading (text, as typed)
  notes · created_at · updated_at
  index: (user_id, created_at)

medication_conditions (schema v2)  — which medicines relate to which conditions
  medication_id → medications(id) ON DELETE CASCADE
  condition_id  → health_conditions(id) ON DELETE CASCADE
  user_id · PRIMARY KEY (medication_id, condition_id)

Schema v4 (Milestone 5) adds reminders and doses with
FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE.
```

Rows written before v3 have `member_id = NULL` only until the account next
loads: `FamilyRepository.ensureSelf` creates the "Me" profile and adopts them.

The same tables exist in Postgres (`supabase/schema.sql`) with Row Level
Security so each user can only reach their own rows. `dosage`, `frequency`
and `instructions` stay **text** on purpose: the structured chips in the form
compose to text (`"500 mg"`, `"Twice daily"`, `"With food. At bedtime"`) so
labels, the scanner, the assistant and the dose parser all share one
representation.

Sessions, local accounts and preferences live in encrypted key-value storage,
not in SQLite. In the browser, medicines and conditions fall back to JSON in
`localStorage` (`JsonMedicationRepository`, `JsonHealthConditionRepository`).

---

## 8. Architecture in one picture

```
Screen (src/app)  →  Store (zustand)  →  Service / Repository interface  →  Implementation
     UI only           state + errors        the contract screens see        swappable

AuthService            → LocalAuthService        | SupabaseAuthService (planned)
MedicationRepository   → SqliteMedicationRepository | JsonMedicationRepository (web)
HealthConditionRepository → SqliteHealthConditionRepository | JsonHealthConditionRepository (web)
FamilyRepository       → SqliteFamilyRepository    | JsonFamilyRepository (web)
AssistantService       → OfflineAssistant        | ProxyAssistant → Railway server → Gemini / Groq / Claude
MedicationScannerService (M4) → MockMedicationScanner | ClaudeVisionScanner
```

Screens contain no business logic, no SQL and no AI calls. Every external
dependency sits behind an interface with a mock or offline implementation, so the
demo cannot be broken by a missing key or a dead network.

---

## 9. Testing and verification

**259 tests in 16 suites**, all passing:

| Suite | Covers |
|---|---|
| `db/migrations` | schema version, idempotence, indexes, every CHECK constraint; v2 columns, condition-type CHECK, link cascade; v3 one-"Me" index, relationship/colour CHECKs, member_id FK + cascade |
| `db/FamilyRepository` | `ensureSelf` idempotence and adoption of pre-v3 rows, ordering ("Me" first), one-"Me" rule, self kept as ME, per-user isolation, self cannot be removed, removal cascades to that member's medicines and conditions only — **both** backends |
| `domain/familyMember` | schema (Other needs wording, future DOB rejected), addable relationships exclude Me, labels, age, initials, possessives, least-used avatar colour |
| `db/MedicationRepository` | CRUD + per-user isolation + kind/form round trip, run against **both** implementations |
| `db/HealthConditionRepository` | CRUD, ordering, per-user isolation, medicine links (foreign ids dropped, links replaced/kept/cleared, cascade on delete) — **both** backends |
| `domain/medication` | validation rules, null normalisation, calendar-date rejection |
| `domain/medicationOptions` | dosage amount + unit compose/parse, frequency presets understood by `parseFrequency`, instruction chips round trip, unrecognised text kept verbatim |
| `domain/expiry` | expired / expiring-soon / in-date boundaries, calendar-day arithmetic, malformed dates |
| `domain/healthCondition` | schema (Other needs a name, custom name dropped otherwise, lengths), presets, display name |
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
| Railway: 404 "Application not found", then 502 "failed to respond" | No deployment had been built; then the app listened on 8080 while the domain targeted 8787 | Root-level Dockerfile so the build works whatever the Root Directory setting; `PORT` and the domain both set to 8080; `/health` reports the running version |
| Railway kept serving an old build | GitHub repo connection had dropped ("Auto deploy unavailable") | Repo reconnected + manual redeploy; Railway GitHub App recommended for auto-deploy |
| Vercel: "public framework prefix cannot use `visibility: secret`" | `EXPO_PUBLIC_*` variables were marked Sensitive | Sensitive toggle off — they are publishable by definition; redeploy so they reach the build |
| Assistant: "credit balance is too low" | Anthropic account had no prepaid credit | Provider-agnostic server; Gemini free tier as default — the demo no longer depends on a paid balance |
| Gemini 404 for `gemini-2.5-flash` | Model retired for new accounts | Default moved to `gemini-3.6-flash`; `GEMINI_MODEL` variable overrides without a code change |
| Tab bar cut off when the web app is added to the iPhone home screen | Body sized to `100vh` in standalone Safari, which is taller than the visible area | `100dvh` root sizing + `viewport-fit=cover`, explicit tab-bar height with safe-area inset |
| Tab labels clipped at large text sizes | Five labels do not fit an iPhone width | Icon-only tabs in portrait, labels beside icons in landscape (user's choice) |
| App showed the template icon | `app.json` pointed at the template icon bundle | `ios.icon` → the supplied square artwork; favicon, manifest and apple-touch icons generated from it |
| "Log out" and "Delete medicine" did nothing in the browser / home-screen app | Both used `Alert.alert`, which react-native-web does not implement — the tap was silently swallowed | `lib/confirm.ts` (`confirmAction`): native alert on the phone, the browser's confirm dialog on web; used by every destructive button |
| Two conditions added in the same millisecond listed in random order in the browser | JSON list sorted by `created_at`, then by random id | Insertion order kept (matches SQLite's `ORDER BY created_at, rowid`); caught by the shared repository suite |

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
3. **Medicines → Add medicine**: try an empty name (blocked), then pick
   *Over the counter* + *Tablet*, amount 500 + *mg*, *Twice a day*, tick
   *With food*, and choose an expiry date from the calendar — pick last month
   to see the red **Expired** badge and banner, then a real date (2027-04-30).
4. In section 5, **Add a condition** → *High blood pressure*, reading `130/85`
   → it is linked to the medicine immediately. Save.
5. Open it → **Ask about this medicine** → "When is my next dose?"
6. **Ask** tab → "can I take two together?" to show the safety screen
7. **Settings → Health conditions** → edit the reading, remove a condition
   (the medicine stays, the link goes)
8. **Family** tab → **Add family member** → Fatima, *Mother*, date of birth,
   pick a colour → her profile opens. **Add medicine for Fatima** → note the
   banner "Adding medicine for: Fatima · Mother" → save. Back on **Medicines**,
   switch between Me and Fatima with the chips; each list is separate.
   **Remove family member** → the confirmation lists her medicines.
9. **Settings** → switch colour theme, large text, high contrast; log out; log in

Everything above works with the phone in Airplane Mode. The same app is live
in a browser at https://medimind-medimind3.vercel.app (add to the iPhone home
screen from Safari for the full-screen version); with **Demo Mode off** the
Ask tab uses the Railway server and Gemini.

---

## 12. The original brief, phase by phase

The project brief defined nineteen development phases plus a testing phase.
This is where each one stands.

| Phase (from the brief) | Status | Notes |
|---|---|---|
| 1 Project setup | ✅ Done | Expo SDK 57, TypeScript, Expo Router, theme, structure, env config |
| 2 UI foundation — splash, onboarding, auth, dashboard | ✅ Done | Splash uses the real logo; demo account added on top |
| 3 Medication management — add/view/edit/delete/search/details | ✅ Done | |
| 4 Database | ✅ Done for medications, health conditions (v2) and family members (v3) | `reminders` and `doses` tables arrive with Phase 9–11 as schema v4 |
| 5 Medication scanner (camera → OCR/AI → data) | ⬜ Not started | **Next.** `MedicationScannerService` interface + mock + Claude vision |
| 6 Scan result confirmation (Confirm / Edit, never auto-save) | ⬜ Not started | Reuses `MedicationForm` for the Edit path |
| 7 Safety engine (expiry, missing info, unclear label) | ⬜ Not started | `safety_status` column and labels already exist; only the service is missing |
| 8 Manual entry | ✅ Done | Five-section form: type/form chips, amount + unit, frequency presets, calendar date picker with expired / expiring-soon feedback, instruction chips, health conditions; blank → `null`, calendar-date checks |
| 9 Smart reminders (suggested schedule, editable) | ◐ Foundations | `domain/dosing.ts` already derives times from the label; the reminder screens and table are not built |
| 10 Notifications (local, Taken / Missed, permissions) | ⬜ Not started | Confirmed to work inside Expo Go on iOS — no native build needed |
| 11 Dose tracking (today + history) | ⬜ Not started | Schedule and History tabs are placeholders |
| 12 Missed dose (gentle reminder, never "double up") | ◐ Wording done | The assistant already gives the safe missed-dose answer; the notification-driven follow-up is not built |
| 13 Voice alerts (TTS, toggle in Settings) | ⬜ Not started | `voiceAlertsEnabled` setting exists; `expo-speech` not yet wired |
| 14 Offline support | ✅ Done by design | Local-first SQLite, on-device auth, offline assistant; AI features say so when they need internet |
| 15 Settings (profile, notifications, voice, accessibility, privacy, about, logout) | ◐ Partial | Profile, appearance, accessibility, about, logout done; notifications / voice / privacy screens pending |
| 16 Accessibility | ◐ Strong foundation | Large text, high contrast, WCAG-checked palettes, 48 pt targets, labels never colour-only; a final screen-reader pass remains |
| 17 Error handling (friendly messages everywhere) | ◐ Partial | `Result<T>` + error catalogue used throughout; camera / notification / OCR cases arrive with their features |
| 18 Security | ◐ Partial | No secrets in the bundle, per-user scoping, minimal data, no admin login; Supabase RLS pending |
| 19 Demo mode (safe / expired / unreadable scenarios) | ◐ Partial | `demoMode` flag, demo account and offline assistant exist; the three scanner scenarios arrive with Phase 5 |
| 20 Testing | ◐ Ongoing | 171 tests covering auth, medication, database, storage, assistant, dosing; scanner / safety / reminder / notification suites to come |

**Not planned, by the brief's own rule ("do not overbuild"):** social features,
chat between users, hospital systems, payments, analytics dashboards, AI
diagnosis.

---

## 13. Remaining work in detail

### Milestone 4 — Scanner, confirmation, safety engine, demo scenarios

Covers Phases 5, 6, 7 and 19. This is the heart of the project and needs the
iPhone (the camera cannot run in a browser).

**Camera (Phase 5)**
- Install `expo-camera`; add `NSCameraUsageDescription` to `app.json` (iOS
  crashes on first camera use without it).
- `src/app/scan/index.tsx` — permission request with a plain-language reason,
  live preview, capture button at 64 pt, a "having trouble? enter manually"
  escape hatch. Permission denied → friendly explanation + Settings deep link,
  never a dead end.
- `src/app/scan/processing.tsx` — "Reading the label…" with a cancel.

**Scanner service (Phase 5, Rule 29)**
- `src/services/scanner/MedicationScannerService.ts` — interface:
  `scan(imageUri) → Result<ScanResult>`, where every field of `ScanResult` is
  `string | null` plus a per-field confidence and an overall `confidence`.
- `MockMedicationScanner` — three deterministic scenarios selectable in demo
  mode: **Safe Medicine** (future expiry), **Expired Demo Medicine** (past
  expiry), **Unreadable** (low confidence). This is what the graduation demo
  runs on, so it can never be broken by a network or a key.
- `ClaudeVisionScanner` — sends the photo to a new endpoint on the API server
  (`supabase/functions/scan`) that calls a Claude vision model with a strict
  JSON schema; the response is validated with Zod so any field the model is
  unsure about becomes `null`. Same key-stays-on-the-server design as the
  assistant.
- Factory picks mock vs real from `demoMode` and `EXPO_PUBLIC_SCAN_ENDPOINT`.

**Confirmation (Phase 6)**
- `src/app/scan/result.tsx` — shows Name, Dosage, Expiry, Instructions,
  Frequency, each with "Could not be determined" where `null`, a confidence
  hint, and two buttons: **Confirm** and **Edit**. Nothing is saved until
  Confirm. Edit opens the existing `MedicationForm` pre-filled.
- `src/app/scan/unreadable.tsx` — "We couldn't clearly read this label" with
  **Scan again** and **Enter manually**.

**Safety engine (Phase 7)**
- `src/services/safety/MedicationSafetyService.ts` — a pure function
  `evaluate(medication, today) → { status, issues[] }`:
  expired → `EXPIRED`; within 30 days → `EXPIRING_SOON`; no expiry, dosage or
  frequency → `NEEDS_REVIEW` with the missing fields named; low scan confidence
  → `NEEDS_REVIEW`; otherwise `SAFE`.
- Runs on confirm, on manual save, on edit, and on app launch (dates move).
- **EXPIRED** produces a prominent banner — the word "EXPIRED" plus "Please
  verify this medication before using it", never colour alone — a voice alert
  (Phase 13), and **no normal reminder is offered**.
- The `Badge` on medicine cards and the detail page lights up (the hooks are
  already in place, hidden while everything is `UNKNOWN`).
- Tests: future / today / past / missing expiry; each missing field; confidence
  thresholds.

### Milestone 5 — Reminders, notifications, dose tracking, missed doses

Covers Phases 9, 10, 11 and 12.

**Schema v2 (Phase 4 completion)**
- Migration 2 adds `reminders` (id, medication_id, user_id, dose, time,
  frequency, days, start_date, end_date, enabled) and `doses` (id,
  medication_id, reminder_id, user_id, scheduled_time, status
  UPCOMING|TAKEN|MISSED|SKIPPED, timestamp, notification_id), both with
  `FOREIGN KEY … ON DELETE CASCADE` so deleting a medicine cleans up
  everything. `PRAGMA foreign_keys = ON` is already set.
- `ReminderRepository`, `DoseRepository` with the same per-user scoping and
  the same real-SQLite tests.

**Smart reminders (Phase 9)**
- `src/app/reminder/create.tsx` — opened after a SAFE confirmation. Pre-filled
  from `domain/dosing.ts`: "Paracetamol · 1 tablet · twice daily · 8:00 AM and
  8:00 PM". Editable: time(s), dose, frequency, days, start and end date. Big
  **Confirm reminder** button.
- `src/app/reminder/[id].tsx` — edit / enable-disable / delete.
- Expired medicines cannot create a normal reminder (Phase 7 rule).

**Notifications (Phase 10)**
- `expo-notifications`: permission request with the reason explained; if
  denied, a screen explaining why reminders need it, with a link to Settings.
- `NotificationService` schedules a local notification per reminder time:
  "Time for your medication — Paracetamol, 1 tablet", with **Taken** and
  **Missed** action buttons. Rescheduled on edit, cancelled on delete.
- Works inside Expo Go on iOS, so still no native build.

**Dose tracking (Phase 11)**
- Schedule tab becomes "Today": each dose with time and status —
  8:00 AM Taken · 2:00 PM Taken · 8:00 PM Upcoming — and buttons to mark Taken
  or Missed from inside the app too.
- History tab: past days grouped by date; medicine, scheduled time, status.
  Deliberately simple — no charts (Phase 11: "do not make the analytics
  unnecessarily complicated").
- Dashboard "Doses taken today" count becomes real.

**Missed dose (Phase 12)**
- A dose not marked within a grace window becomes MISSED and triggers one
  gentle follow-up notification: "You may have missed your 8:00 AM Paracetamol.
  Follow the instructions on the label, and ask a pharmacist if unsure." Never
  "take it now" and never "take two".

### Milestone 6 — Voice, settings, accessibility, security, hardening

Covers Phases 13, 15, 16, 17, 18 and the rest of 20.

**Voice alerts (Phase 13)** — `VoiceService` over `expo-speech`. Reminder:
"It is time for your medication." Safety: "Warning. This medication appears to
be expired. Please check the medication before using it." Honours the existing
`voiceAlertsEnabled` toggle; a "Test voice" button in Settings.

**Settings (Phase 15)** — Notifications screen (master switch, permission
status, test notification), Voice screen, Privacy screen (what is stored, where,
what the assistant is told, delete-my-data), Edit profile.

**Accessibility (Phase 16)** — VoiceOver pass on every screen, focus order on
forms, `accessibilityLiveRegion` on safety banners, Dynamic Type check with
Large text on.

**Error handling (Phase 17)** — the remaining cases from the brief, each with a
friendly message and a way forward: camera denied, notification denied, OCR /
AI failure, no internet during a scan, unclear label. No technical text ever
reaches the screen.

**Security (Phase 18)** — `SupabaseAuthService` behind the existing
`AuthService` interface; Postgres schema with **Row Level Security** policies
mirroring the on-device `user_id` scoping; optional cloud sync of medicines
and reminders through `SyncService` (local stays the source of truth).

**Testing (Phase 20)** — suites for scanner (success, failure, unclear,
incorrect OCR), safety (future / today / past / missing expiry), reminders
(create, edit, delete, enable/disable), dose tracking (taken, missed, upcoming),
offline (open saved medicine, view reminders, manual entry), and the existing
auth suite.

### Two deployment tasks outside the milestones

| Task | What it needs |
|---|---|
| Deploy to Vercel · Railway · Supabase | ✅ Live: web at medimind-medimind3.vercel.app, API on Railway, Postgres + Auth on Supabase (`docs/DEPLOYMENT.md`). The assistant answers through Google Gemini (free tier) — verified live. |
| Push to GitHub | ✅ Done — pushes are now automated from this environment |

---

## 14. Success criteria from the brief

| # | Criterion | Status |
|---|---|---|
| 1 | Install / run the app | ✅ Expo Go on iPhone, no native build |
| 2 | Create an account | ✅ |
| 3 | Log in | ✅ (plus one-tap demo account) |
| 4 | View the home dashboard | ✅ |
| 5 | Scan a medication label | ⬜ M4 |
| 6 | Extract medication information | ⬜ M4 |
| 7 | Review / edit the extracted information | ⬜ M4 (form already exists) |
| 8 | Check expiration / safety | ⬜ M4 |
| 9 | Receive a warning for an expired medication | ⬜ M4 |
| 10 | Add a safe medication | ✅ manually; via scan in M4 |
| 11 | Generate a reminder | ⬜ M5 (schedule derivation done) |
| 12 | Receive a notification | ⬜ M5 |
| 13 | Mark a dose as taken | ⬜ M5 |
| 14 | Mark / view missed doses | ⬜ M5 |
| 15 | View medication history | ⬜ M5 |
| 16 | Use manual medication entry | ✅ |
| 17 | Access saved medications offline | ✅ |
| 18 | Use voice alerts | ⬜ M6 |
| 19 | Manage notification / voice settings | ◐ toggles exist; screens in M6 |
| 20 | Demonstrate the complete workflow reliably | ◐ Everything built so far works in Airplane Mode; scanner and reminders complete the story |

**Beyond the brief:** the Ask MediMind assistant with dose scheduling, selectable
colour themes, a WCAG contrast checker, real-SQLite tests, structured manual
entry with a calendar picker, health conditions, and **Family profiles** (one
account managing several people's medicines with no extra logins).

---

## 15. The demonstration story (brief §23) — step by step

| Step | Action | Status |
|---|---|---|
| 1 | Open MediMind | ✅ |
| 2 | Go to Scan Medication | ⬜ M4 |
| 3 | Scan a medicine label | ⬜ M4 |
| 4 | Show AI / OCR extraction | ⬜ M4 (mock in demo mode, Claude when deployed) |
| 5 | Show medication details | ✅ detail screen exists |
| 6 | Show safety verification | ⬜ M4 |
| 7 | Demonstrate an expired-medication warning | ⬜ M4 (mock "Expired Demo Medicine") |
| 8 | Scan / use a safe medication | ⬜ M4 (mock "Demo Medicine") |
| 9 | Confirm the medication | ⬜ M4 |
| 10 | Show the automatically suggested reminder | ⬜ M5 (times from `domain/dosing.ts`) |
| 11 | Confirm the reminder | ⬜ M5 |
| 12 | Show the notification | ⬜ M5 |
| 13 | Mark the medication as taken | ⬜ M5 |
| 14 | Show the medication history | ⬜ M5 |

The demo runs on `MockMedicationScanner` and local notifications, so steps 2–14
will work with no internet and no API key — exactly as the brief requires.

---

## 16. Commit history

```
2026-09-13  Family: profiles under one account, per-member medicines and conditions, Family tab
2026-09-13  AGENTS: every step is committed and pushed immediately (Vercel deploys from main)
2026-09-13  Fix: log out and delete medicine did nothing in the browser
2026-09-13  PROJECT_SUMMARY: full audit; change log section; summary-per-step rule in AGENTS.md
2026-09-11  Structured manual entry form, date picker and health conditions
2026-09-06  PROJECT_SUMMARY: assistant live on Gemini free tier
2026-09-06  server: actually apply the gemini-3.6-flash default and bump to v1.2.1
2026-09-06  server: default Gemini model gemini-3.6-flash (2.5-flash retired for new accounts)
2026-09-06  Assistant server: free providers (Gemini, Groq) alongside Claude
2026-09-06  PROJECT_SUMMARY: tab bar behaviour
2026-09-06  Tab bar: icon-only in portrait, labels beside icons in landscape; explicit height with safe-area inset; allow rotation
2026-09-06  PROJECT_SUMMARY: deployment is live
2026-09-06  docs: note that the Anthropic account needs prepaid credit
2026-09-06  Web: size the app to the dynamic viewport (100dvh) so the tab bar is not cut off on iPhone
2026-09-06  App icon from the supplied square artwork; iPhone home-screen (PWA) fixes
2026-09-06  server: report the Anthropic error reason safely, retry on 400, expose version on /health
2026-09-06  Web: document title and meta via +html.tsx; Settings shows which backends this build is configured with
2026-09-06  Railway: root-level Dockerfile builds server/ regardless of the Root Directory setting
2026-09-06  server: build with an explicit Dockerfile on Railway; pin TypeScript 5 and @types/node 22
2026-09-06  server: pin Node 22 for Railway and declare a /health healthcheck
2026-09-06  env template: assistant endpoint now points at the Railway server
2026-09-06  Deployment: Vercel (web), Railway (API server), Supabase (database + accounts)
2026-09-06  PROJECT_SUMMARY: refresh commit count
2026-09-06  PROJECT_SUMMARY: phase-by-phase status, detailed remaining milestones, success criteria and demo story
2026-09-06  Add docs/PROJECT_SUMMARY.md — full record of features, decisions, tests and next steps
2026-09-06  Assistant: answer next-dose questions from the recorded label schedule
2026-09-06  Move the assistant into the tab bar as 'Ask' and remove the dashboard card
2026-09-06  Add one-click push helper script
2026-09-06  Document typed-routes generation quirk in AGENTS.md
2026-09-06  Add Ask MediMind assistant with offline and Claude-backed implementations
2026-09-03  Initial commit: MediMind Milestones 1-3
```

---

## 17. Where to look for each thing

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
| Form chips → stored text (dose, frequency, instructions) | `src/domain/medicationOptions.ts` |
| Expiry status (expired / expiring soon) | `src/domain/expiry.ts` |
| Health conditions (types, presets, validation) | `src/domain/healthCondition.ts` |
| Health-condition store and repositories | `src/stores/useHealthConditionStore.ts`, `src/db/repositories/*HealthConditionRepository.ts` |
| Family members (model, "Me", relationships, age) | `src/domain/familyMember.ts` |
| Family store (active member) and repositories | `src/stores/useFamilyStore.ts`, `src/db/repositories/*FamilyRepository.ts` |
| Family UI (avatar, context banner, switcher, form) | `src/components/family/` |
| The medicine form | `src/components/medication/MedicationForm.tsx` |
| Chips, date picker, collapsible, form section | `src/components/ui/ChoiceChips.tsx`, `DateField.tsx` + `DateField.web.tsx`, `Collapsible.tsx`, `FormSection.tsx` |
| Assistant safety screen and wording | `src/domain/assistant.ts` |
| Dose scheduling | `src/domain/dosing.ts` |
| Offline assistant | `src/services/assistant/OfflineAssistant.ts` |
| API server (Railway) | `server/src/index.ts` |
| AI providers (Gemini / Groq / Claude) | `server/src/providers.ts` |
| Web page shell, PWA metas, home-screen sizing | `src/app/+html.tsx`, `public/manifest.json` |
| Tab bar (icon-only portrait / labels landscape) | `src/app/(tabs)/_layout.tsx` |
| Cloud schema + RLS (Supabase) | `supabase/schema.sql` |
| Deployment guide | `docs/DEPLOYMENT.md` |
| Contrast checker | `scripts/check-contrast.js` |
| Icon generation | `scripts/generate-icons.ps1` |
| Real-SQLite test adapter | `__tests__/helpers/testDatabase.ts` |

---

## 18. Change log — one entry per step

Newest first. Every commit that changes the app adds an entry here **in the
same commit**, and updates the sections above that it touches (rule in
`AGENTS.md`, "Verify before claiming done").

### 2026-09-13 — Family: one account, many profiles
- **Schema v3**: `family_members` (relationship enum, custom wording, date of
  birth, avatar colour, `is_self` with a one-per-account unique index);
  `member_id` on `medications` and `health_conditions` with cascade delete.
  Supabase mirror with RLS.
- **Data kept**: `ensureSelf()` creates "Me" on first load and adopts every
  pre-v3 medicine and condition — nobody loses anything on upgrade.
- **Repositories / stores**: `FamilyRepository` (SQLite + JSON, shared suite);
  medicine and condition repositories read/write `member_id`;
  `useFamilyStore` with a persisted active member.
- **Screens**: **Family** tab (takes the History placeholder's slot; History
  folds into Schedule in M5), member dashboard, add / edit profile with a
  shared form (name, relationship chips, optional date of birth, avatar
  colour). Medicines tab, home dashboard, add / edit / detail, health
  conditions and the assistant are all scoped to the active member and show
  a **MemberContextBanner** naming whose data is on screen. Add screens carry
  the member id and refuse to render without one.
- **Removal**: confirmation lists the member's medicines and conditions;
  "Me" cannot be removed.
- **Tests**: +36 (2 new suites, v3 migration cases) → 259. Both bundles export.

### 2026-09-13 — Process: every step is pushed to GitHub straight away
- Rule added to `AGENTS.md`: each change is committed and pushed immediately,
  because the Vercel web build (the version used on the iPhone home screen)
  redeploys only from `main`. Together with the summary-per-step rule this is
  the definition of done: typecheck · tests · bundles · summary · pushed.

### 2026-09-13 — Fix: log out (and delete medicine) did nothing on the web
- Settings → Log out and the medicine Delete button called `Alert.alert`,
  which the browser build silently ignores, so neither worked on the web or
  the iPhone home-screen version. Both now use `confirmAction`
  (`src/lib/confirm.ts`), which shows the native alert on the phone and the
  browser's own confirm dialog on web. No `Alert.alert` calls remain in screens.

### 2026-09-13 — Summary audit and the summary-per-step rule
- Audited this document against every commit since 6 September and filled the
  gaps: provider-agnostic assistant server, deployment fixes, PWA / home-screen
  work, tab-bar behaviour, app icon, schema v2 data model, new test suites, new
  safety decisions, demo script steps for the new form and health conditions.
- Added this change-log section and the rule that every step updates the
  summary (`AGENTS.md`).

### 2026-09-11 — Structured manual entry, date picker, health conditions
- **Form** (`MedicationForm.tsx`) rebuilt as five numbered sections: about the
  medicine (name, type chips, form chips) · dose and how often (amount + unit
  chips, frequency chips incl. "every N hours" and custom) · expiry (calendar
  picker + live Expired / Expires in N days / In date badge and banners) ·
  instructions (multi-select chips + folded free text) · health conditions
  (link existing, add inline). Notes folded. Same form for Add and Edit;
  existing text is parsed back into chips and anything unrecognised is kept
  verbatim.
- **Domain**: `medicationOptions.ts` (compose / parse for dose, frequency,
  instructions), `expiry.ts` (30-day window, calendar days), `healthCondition.ts`
  (10 preset types + Other, reading as typed, Zod schema).
- **Schema v2**: `kind` and `form` columns; `health_conditions` and
  `medication_conditions` tables with cascade deletes; Supabase mirror with RLS.
- **Repositories / store**: `HealthConditionRepository` (SQLite + JSON),
  medicine repositories read/write `kind`, `form` and `conditionIds`
  (foreign or unknown ids are dropped, never stored); `useHealthConditionStore`.
- **Screens**: new **My health conditions** (`/health/conditions`, add / edit /
  remove, cross-platform confirm dialog); Settings → *My health* entry; detail
  screen shows Type, Form, expiry badge/banner and linked conditions; cards show
  a per-form icon.
- **UI kit**: `ChoiceChips` / `MultiChoiceChips`, `DateField` (native picker +
  `<input type="date">` web split), `Collapsible`, `FormSection`.
- **Dependency**: `@react-native-community/datetimepicker` (works in Expo Go).
- **Tests**: +52 (4 new suites) → 223. Both bundles export.

### 2026-09-06 (evening) — Free AI provider
- Assistant server made provider-agnostic (`server/src/providers.ts`): Gemini
  (free tier, default), Groq (free), Anthropic (paid), chosen by which key is
  set; `AI_PROVIDER` and `*_MODEL` overrides. Default model `gemini-3.6-flash`
  after `gemini-2.5-flash` was retired. `/health` shows provider + model.
  Verified live: correct next-dose answer, correct refusal of a double-dose
  question. Docs updated (README, DEPLOYMENT, AGENTS).

### 2026-09-06 (afternoon) — iPhone home-screen (PWA) and app icon
- App icon, favicon, manifest and apple-touch icons generated from the supplied
  square artwork; `app.json` `ios.icon` fixed.
- `+html.tsx`: document title, `viewport-fit=cover`, apple-mobile-web-app metas,
  `100dvh` root sizing so the tab bar is not cut off when added to the home
  screen; `orientation: default` to allow rotation.
- Tab bar: explicit height + safe-area inset; icon-only in portrait, labels
  beside icons in landscape.
- Settings "About" shows which backends the build was configured with.

### 2026-09-06 (midday) — Deployment: Vercel · Railway · Supabase
- `vercel.json` (static `expo export -p web`, auto-deploys on push);
  `server/` Dockerfile + root Dockerfile, Node 22, `/health` healthcheck,
  `PORT` 8080; `supabase/schema.sql` run (profiles, medications, reminders,
  doses with RLS). `docs/DEPLOYMENT.md` written; `.env.local` template points
  at the Railway endpoint. Secrets policy: AI key only in Railway variables.
- GitHub push automated from this environment (device-code sign-in, token in
  Windows Credential Manager).

### 2026-09-06 (morning) — Ask MediMind assistant
- `AssistantService` with `OfflineAssistant` (deterministic, tested) and
  `ProxyAssistant` (Railway server). Client-side safety screen
  (`screenQuestion`) before any model; acknowledgement gate; footer on every
  reply. `domain/dosing.ts` parses label frequency into clock times and the
  next dose. Assistant moved into the tab bar as **Ask**. First version of this
  summary written.

### 2026-09-03 — Milestones 1–3
- Foundation (Expo SDK 57, TypeScript strict, Expo Router, theme with selectable
  WCAG-checked palettes, large text, high contrast, contrast checker script).
- Onboarding, local auth with demo account, dashboard, settings.
- SQLite schema v1 with `PRAGMA user_version` migrations, `MedicationRepository`
  (SQLite + JSON web fallback, same test suite), medication list / search /
  detail / add / edit / delete, Zod validation with blank → `null`.
