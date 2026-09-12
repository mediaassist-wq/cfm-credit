-- ============================================================================
-- Allow a flag to be removed (voided) by a manager. The flag row is kept for
-- audit but marked voided; the penalty it caused is reversed with an offsetting
-- credit entry (mirrors §6 "append offsetting entries" instead of deleting).
-- ============================================================================

alter table flags add column if not exists voided boolean not null default false;
alter table flags add column if not exists voided_at timestamptz;
alter table flags add column if not exists voided_by uuid references users (id);

-- Flags stay DELETE-immutable, but UPDATE is now allowed (only to set voided,
-- gated by the RLS policy below).
drop trigger if exists trg_flags_immutable on flags;
create trigger trg_flags_immutable
  before delete on flags
  for each row execute function block_mutation();

-- Managers (management, or the owning PM) may update flags in their org.
drop policy if exists flags_update on flags;
create policy flags_update on flags
  for update
  using (org_id = auth_org_id() and manages_user(user_id))
  with check (org_id = auth_org_id());
