# CFM Credit & Tier Management System

Internal web app for **Core Frame Media** to track Executive (Editor) and Project
Manager performance via the credit/tier system in CFM-SOP-EXEC-001 (v4.0).

Stack: **Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Recharts**.
Multi-tenant (CFM Wing + OBM Wing) with org-scoped Row Level Security.

---

## Status

- ✅ Project scaffold, config, Tailwind
- ✅ Supabase auth (login, session middleware, role-based routing)
- ✅ Database schema + business-logic triggers + RLS (`supabase/migrations/`)
- ✅ Executive Dashboard (tier badge, progress, credit breakdown, attendance, flags, 6-month trend)
- ✅ PM Dashboard (team roster, credit/flag/attendance/negative-review forms, PM bonus calculator)
- ✅ Management Dashboard (leaderboard, tier distribution, Tier S approvals queue, flag audit log)
- ✅ Executive Profile Detail (full ledger, tier-history timeline, attendance/flags, tier + eligibility controls)
- ✅ Policy Reference page (searchable, read-only SOP rules)

---

## Prerequisites

**Node.js is not currently installed on this machine.** Install the LTS build first:

- Download from https://nodejs.org (LTS 20+), or
- `winget install OpenJS.NodeJS.LTS`

Then reopen the terminal so `node` and `npm` are on PATH.

## 1. Install dependencies

```bash
npm install
```

## 2. Create a Supabase project

1. Create a project at https://supabase.com.
2. Copy `.env.local.example` to `.env.local` and fill in the values from
   **Project Settings → API** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   and `SUPABASE_SERVICE_ROLE_KEY`).

## 3. Apply the database schema

Run the SQL files **in order** in the Supabase SQL editor (or via the Supabase CLI):

```
supabase/migrations/0001_init.sql       -- tables + enums
supabase/migrations/0002_functions.sql  -- triggers (auto-deduct, attendance, PM bonus, tier sync)
supabase/migrations/0003_rls.sql        -- Row Level Security policies
supabase/seed.sql                        -- organizations (CFM Wing, OBM Wing)
```

## 4. Seed demo users (optional, for local dev)

```bash
node --env-file=.env.local scripts/seed.mjs
```

Creates a founder, a PM, and two editors (password `cfm-demo-1234`) plus sample
credit/attendance/flag data. Sign in as `editor1@cfm.test` to see the Executive
Dashboard populated.

## 5. Run

```bash
npm run dev
```

Open http://localhost:3000 — you'll be routed to your role's dashboard.

---

## Business logic

All credit/tier rules from PRD §4 are hard-coded in two places that must stay in sync:

- **App layer:** `src/lib/credit-rules.ts` (production/bonus/penalty values, attendance scale)
  and `src/lib/tier-logic.ts` (tier thresholds, 2-month cycle evaluation, PM bonus).
- **Database layer:** `supabase/migrations/0002_functions.sql` (triggers enforce the same
  numbers so the ledger is correct regardless of client).

Key policy guarantees:

- **Ledger is immutable** — `credit_entries`, `flags`, and `tier_history` block UPDATE/DELETE;
  corrections are appended as offsetting entries (PRD §6).
- **Tier changes are audited** — `users.current_tier` is only ever changed by inserting a
  `tier_history` row (a trigger syncs it). Never overwritten silently.
- **Tier S is never auto-promoted** — the cycle evaluator returns an `s_candidate` status;
  only Management may insert a `tier` = `'S'` history row (enforced in RLS).
- **2-month cycle** — both months must *individually* meet a threshold; averages don't count
  (PRD §4.6).

## Roles (RLS)

| Role | Access |
|---|---|
| Management | Full access within their org; only role that can promote to Tier S |
| PM | Manage assigned executives (log credits, issue flags, allocate bonus); own PM bonus log |
| Executive | Read-only self view |

---

## ⚠️ Open item to confirm (from PRD §4.3/§4.4)

The attendance trigger currently auto-deducts **−3 per unexcused absence** at the moment an
attendance record is created (treating the record as the "event" in §4.3). Confirm this is the
intended behavior, vs. logging unexcused-absence penalties separately.
