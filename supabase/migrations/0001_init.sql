-- ============================================================================
-- CFM Credit & Tier Management — Schema (PRD §3)
-- Multi-tenant: every domain table carries org_id.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────────────
create type user_role as enum ('management', 'pm', 'executive');
create type tier_level as enum ('D', 'C', 'B', 'A', 'S');
create type credit_category as enum ('production', 'bonus', 'penalty', 'attendance', 'adjustment');
create type flag_type as enum ('yellow', 'red');
create type tier_reason as enum ('promotion', 'demotion', 'initial');

-- ── organizations (tenants) ──────────────────────────────────────────────────
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- ── users (profiles) — id === auth.users.id ──────────────────────────────────
create table users (
  id                uuid primary key references auth.users (id) on delete cascade,
  org_id            uuid not null references organizations (id) on delete restrict,
  name              text not null,
  email             text not null,
  role              user_role not null default 'executive',
  pm_id             uuid references users (id) on delete set null,
  join_date         date not null default current_date,
  current_tier      tier_level not null default 'D',
  active            boolean not null default true,
  -- Management-controlled manual flags for Tier S eligibility (§4.5)
  mentoring_capable boolean not null default false,
  moral_conduct     boolean not null default false,
  created_at        timestamptz not null default now()
);

create index users_org_idx on users (org_id);
create index users_pm_idx on users (pm_id);

-- ── credit_entries — immutable ledger (§3, §6) ───────────────────────────────
create table credit_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete restrict,
  user_id     uuid not null references users (id) on delete cascade,
  month       date not null,                 -- first-of-month
  category    credit_category not null,
  subcategory text,                            -- e.g. production type key, penalty key
  credits     integer not null,               -- may be negative
  note        text,
  created_by  uuid not null references users (id),
  created_at  timestamptz not null default now(),
  constraint credit_entries_month_is_first check (extract(day from month) = 1)
);

create index credit_entries_user_month_idx on credit_entries (user_id, month);
create index credit_entries_org_idx on credit_entries (org_id);

-- ── flags (§3, §4.3 auto-deduct handled by trigger) ──────────────────────────
create table flags (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations (id) on delete restrict,
  user_id         uuid not null references users (id) on delete cascade,
  type            flag_type not null,
  reason          text not null,
  video_reference text,
  issued_by       uuid not null references users (id),
  issued_at       timestamptz not null default now()
);

create index flags_user_idx on flags (user_id);
create index flags_org_idx on flags (org_id);

-- ── attendance_records (§3, §4.4 credit auto-computed by trigger) ─────────────
create table attendance_records (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations (id) on delete restrict,
  user_id            uuid not null references users (id) on delete cascade,
  month              date not null,
  late_days          integer not null default 0 check (late_days >= 0),
  unexcused_absences integer not null default 0 check (unexcused_absences >= 0),
  credit_awarded     integer not null default 0,  -- computed §4.4
  created_by         uuid not null references users (id),
  created_at         timestamptz not null default now(),
  unique (user_id, month),
  constraint attendance_month_is_first check (extract(day from month) = 1)
);

create index attendance_org_idx on attendance_records (org_id);

-- ── pm_bonus_log (§3, §4.7 amounts auto-computed by trigger) ──────────────────
create table pm_bonus_log (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete restrict,
  pm_id          uuid not null references users (id) on delete cascade,
  month          date not null,
  perfect_videos integer not null default 0 check (perfect_videos >= 0),
  mistake_videos integer not null default 0 check (mistake_videos >= 0),
  gross_bonus    integer not null default 0,
  deduction      integer not null default 0,
  net_bonus      integer not null default 0,
  created_by     uuid not null references users (id),
  created_at     timestamptz not null default now(),
  unique (pm_id, month),
  constraint pm_bonus_month_is_first check (extract(day from month) = 1)
);

create index pm_bonus_org_idx on pm_bonus_log (org_id);

-- ── tier_history — append-only audit of tier changes (§6) ─────────────────────
create table tier_history (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete restrict,
  user_id        uuid not null references users (id) on delete cascade,
  tier           tier_level not null,
  effective_date date not null default current_date,
  reason         tier_reason not null,
  created_by     uuid references users (id),
  created_at     timestamptz not null default now()
);

create index tier_history_user_idx on tier_history (user_id, effective_date);
create index tier_history_org_idx on tier_history (org_id);
