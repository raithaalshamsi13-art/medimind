-- ============================================================================
-- MediMind — Supabase (PostgreSQL) schema
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- This is the cloud mirror of the on-device SQLite schema in
-- src/db/migrations.ts. Same tables, same columns, same enums — plus
-- Row Level Security, which is what guarantees on the server that a user can
-- only ever read or write their OWN rows. The app enforces the same rule
-- on-device by scoping every query with user_id; here the database enforces it
-- for every client, however it connects.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on sign-up
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own row"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Create the profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- medications
-- ---------------------------------------------------------------------------
create table if not exists public.medications (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  dosage          text,
  instructions    text,
  expiration_date date,
  frequency       text,

  -- Enums enforced by the database, mirroring the SQLite CHECK constraints.
  safety_status   text not null default 'UNKNOWN'
                  check (safety_status in ('SAFE','EXPIRING_SOON','EXPIRED','NEEDS_REVIEW','UNKNOWN')),
  source          text not null default 'MANUAL'
                  check (source in ('SCAN','MANUAL')),

  scan_confidence real,
  notes           text,
  image_uri       text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Schema v2: chosen-from-a-list fields (nullable — a label may not say).
  kind            text check (kind is null or kind in ('PRESCRIPTION','OTC','SUPPLEMENT')),
  form            text check (form is null or form in
                    ('TABLET','CAPSULE','LIQUID','INHALER','INJECTION','CREAM','DROPS','PATCH','SPRAY','OTHER'))
);

-- Re-running on a project created before v2: add the columns if missing.
alter table public.medications add column if not exists kind text
  check (kind is null or kind in ('PRESCRIPTION','OTC','SUPPLEMENT'));
alter table public.medications add column if not exists form text
  check (form is null or form in
    ('TABLET','CAPSULE','LIQUID','INHALER','INJECTION','CREAM','DROPS','PATCH','SPRAY','OTHER'));

create index if not exists idx_medications_user   on public.medications (user_id, archived);
create index if not exists idx_medications_name   on public.medications (user_id, name);
create index if not exists idx_medications_expiry on public.medications (user_id, expiration_date);

alter table public.medications enable row level security;

create policy "medications: own rows"
  on public.medications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- health_conditions (schema v2)
--
-- The user's own notes on long-term conditions. Stored as typed, never
-- interpreted — see src/domain/healthCondition.ts.
-- ---------------------------------------------------------------------------
create table if not exists public.health_conditions (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null
              check (type in ('HIGH_BLOOD_PRESSURE','DIABETES','LOW_BLOOD_SUGAR','ASTHMA',
                'HIGH_CHOLESTEROL','HEART','THYROID','KIDNEY','ARTHRITIS','OTHER')),
  custom_name text,
  reading     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_health_conditions_user on public.health_conditions (user_id, created_at);

alter table public.health_conditions enable row level security;

create policy "health_conditions: own rows"
  on public.health_conditions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Which medicines the user linked to which conditions.
create table if not exists public.medication_conditions (
  medication_id uuid not null references public.medications (id) on delete cascade,
  condition_id  uuid not null references public.health_conditions (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  primary key (medication_id, condition_id)
);

create index if not exists idx_medication_conditions_user on public.medication_conditions (user_id, condition_id);

alter table public.medication_conditions enable row level security;

create policy "medication_conditions: own rows"
  on public.medication_conditions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reminders (Milestone 5)
-- ---------------------------------------------------------------------------
create table if not exists public.reminders (
  id            uuid primary key,
  medication_id uuid not null references public.medications (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  dose          text,
  time          text not null,                 -- "HH:mm"
  frequency     text not null default 'DAILY'
                check (frequency in ('DAILY','SPECIFIC_DAYS','INTERVAL_HOURS','AS_NEEDED')),
  days          jsonb,                         -- e.g. [1,3,5] (0 = Sunday)
  start_date    date,
  end_date      date,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_reminders_user on public.reminders (user_id, enabled);
create index if not exists idx_reminders_medication on public.reminders (medication_id);

alter table public.reminders enable row level security;

create policy "reminders: own rows"
  on public.reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- doses (Milestone 5)
-- ---------------------------------------------------------------------------
create table if not exists public.doses (
  id              uuid primary key,
  medication_id   uuid not null references public.medications (id) on delete cascade,
  reminder_id     uuid references public.reminders (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  scheduled_time  timestamptz not null,
  status          text not null default 'UPCOMING'
                  check (status in ('UPCOMING','TAKEN','MISSED','SKIPPED')),
  taken_at        timestamptz,
  notification_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (reminder_id, scheduled_time)
);

create index if not exists idx_doses_user_time on public.doses (user_id, scheduled_time);

alter table public.doses enable row level security;

create policy "doses: own rows"
  on public.doses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists medications_touch on public.medications;
create trigger medications_touch before update on public.medications
  for each row execute procedure public.touch_updated_at();

drop trigger if exists health_conditions_touch on public.health_conditions;
create trigger health_conditions_touch before update on public.health_conditions
  for each row execute procedure public.touch_updated_at();

drop trigger if exists reminders_touch on public.reminders;
create trigger reminders_touch before update on public.reminders
  for each row execute procedure public.touch_updated_at();

drop trigger if exists doses_touch on public.doses;
create trigger doses_touch before update on public.doses
  for each row execute procedure public.touch_updated_at();
