-- ============================================================================
-- Row Level Security (PRD §2 roles, multi-tenant org isolation)
--
-- Every policy is scoped to the caller's org via auth_org_id(). The service
-- role (used by admin/seed scripts) bypasses RLS entirely.
-- ============================================================================

alter table organizations     enable row level security;
alter table users             enable row level security;
alter table credit_entries    enable row level security;
alter table flags             enable row level security;
alter table attendance_records enable row level security;
alter table pm_bonus_log      enable row level security;
alter table tier_history      enable row level security;

-- ── organizations ─────────────────────────────────────────────────────────────
create policy org_select_own on organizations
  for select using (id = auth_org_id());

-- ── users ─────────────────────────────────────────────────────────────────────
-- Read: yourself, anyone you manage, or (management) everyone in your org.
create policy users_select on users
  for select using (
    org_id = auth_org_id()
    and (id = auth.uid() or is_management() or manages_user(id))
  );

-- Management may provision/update anyone in the org; a PM may update the
-- executives they manage. (Tier changes still go through tier_history.)
create policy users_insert on users
  for insert with check (org_id = auth_org_id() and is_management());

create policy users_update on users
  for update using (
    org_id = auth_org_id() and (is_management() or manages_user(id))
  )
  with check (org_id = auth_org_id());

-- ── credit_entries (append-only; no update/delete policies) ────────────────────
create policy credit_select on credit_entries
  for select using (
    org_id = auth_org_id()
    and (user_id = auth.uid() or is_management() or manages_user(user_id))
  );

create policy credit_insert on credit_entries
  for insert with check (
    org_id = auth_org_id()
    and created_by = auth.uid()
    and manages_user(user_id)
  );

-- ── flags (append-only) ────────────────────────────────────────────────────────
create policy flags_select on flags
  for select using (
    org_id = auth_org_id()
    and (user_id = auth.uid() or is_management() or manages_user(user_id))
  );

create policy flags_insert on flags
  for insert with check (
    org_id = auth_org_id()
    and issued_by = auth.uid()
    and manages_user(user_id)
  );

-- ── attendance_records ──────────────────────────────────────────────────────────
create policy attendance_select on attendance_records
  for select using (
    org_id = auth_org_id()
    and (user_id = auth.uid() or is_management() or manages_user(user_id))
  );

create policy attendance_insert on attendance_records
  for insert with check (
    org_id = auth_org_id()
    and created_by = auth.uid()
    and manages_user(user_id)
  );

-- ── pm_bonus_log ──────────────────────────────────────────────────────────────
create policy pm_bonus_select on pm_bonus_log
  for select using (
    org_id = auth_org_id() and (pm_id = auth.uid() or is_management())
  );

create policy pm_bonus_insert on pm_bonus_log
  for insert with check (
    org_id = auth_org_id()
    and created_by = auth.uid()
    and (pm_id = auth.uid() or is_management())
  );

create policy pm_bonus_update on pm_bonus_log
  for update using (
    org_id = auth_org_id() and (pm_id = auth.uid() or is_management())
  )
  with check (org_id = auth_org_id());

-- ── tier_history (append-only) ────────────────────────────────────────────────
create policy tier_history_select on tier_history
  for select using (
    org_id = auth_org_id()
    and (user_id = auth.uid() or is_management() or manages_user(user_id))
  );

-- Anyone who manages the user may record a tier change — EXCEPT promotion to
-- Tier S, which only Management may write (§4.5 / §6: never auto-promote to S).
create policy tier_history_insert on tier_history
  for insert with check (
    org_id = auth_org_id()
    and manages_user(user_id)
    and (tier <> 'S' or is_management())
  );
