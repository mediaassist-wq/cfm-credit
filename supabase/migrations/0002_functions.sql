-- ============================================================================
-- Functions & triggers — business logic enforced in the DB (PRD §4, §6)
-- ============================================================================

-- ── RLS helper: current user's org / role (SECURITY DEFINER avoids RLS
--    recursion when policies on `users` need to read `users`) ─────────────────
create or replace function auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from users where id = auth.uid();
$$;

create or replace function auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from users where id = auth.uid();
$$;

-- True if current user is management.
create or replace function is_management()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'management' from users where id = auth.uid()), false);
$$;

-- True if current user may manage `target` (management in same org, OR the
-- PM to whom target reports).
create or replace function manages_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from users me, users t
    where me.id = auth.uid()
      and t.id = target
      and me.org_id = t.org_id
      and (
        me.role = 'management'
        or (me.role = 'pm' and t.pm_id = me.id)
      )
  );
$$;

-- ── §4.4 Attendance credit scale ─────────────────────────────────────────────
create or replace function attendance_credit(late_days int, unexcused int)
returns int
language sql
immutable
as $$
  select case
    when late_days = 0 and unexcused = 0 then 5
    when late_days between 1 and 5 then 2
    else 0
  end;
$$;

-- On attendance insert: compute credit_awarded, mirror it into the ledger,
-- and (if any) auto-deduct −3 per unexcused absence (§4.3).
create or replace function on_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.credit_awarded := attendance_credit(new.late_days, new.unexcused_absences);

  insert into credit_entries (org_id, user_id, month, category, subcategory, credits, note, created_by)
  values (new.org_id, new.user_id, new.month, 'attendance', 'attendance_scale',
          new.credit_awarded,
          format('Attendance: %s late, %s unexcused', new.late_days, new.unexcused_absences),
          new.created_by);

  if new.unexcused_absences > 0 then
    insert into credit_entries (org_id, user_id, month, category, subcategory, credits, note, created_by)
    values (new.org_id, new.user_id, new.month, 'penalty', 'unexcused_absence',
            -3 * new.unexcused_absences,
            format('%s unexcused absence(s) @ -3', new.unexcused_absences),
            new.created_by);
  end if;

  return new;
end;
$$;

create trigger trg_attendance_insert
before insert on attendance_records
for each row execute function on_attendance_insert();

-- ── §4.3 Flag auto-deduct ─────────────────────────────────────────────────────
create or replace function on_flag_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  penalty int;
begin
  penalty := case new.type when 'yellow' then -3 when 'red' then -6 end;

  insert into credit_entries (org_id, user_id, month, category, subcategory, credits, note, created_by)
  values (new.org_id, new.user_id, date_trunc('month', new.issued_at)::date,
          'penalty', new.type || '_flag', penalty,
          format('%s flag: %s', new.type, new.reason), new.issued_by);

  return new;
end;
$$;

create trigger trg_flag_insert
after insert on flags
for each row execute function on_flag_insert();

-- ── §4.7 PM monthly bonus ─────────────────────────────────────────────────────
-- net_bonus = max(0, floor(perfect/6) * 4000 − mistake * 4000)
create or replace function on_pm_bonus_write()
returns trigger
language plpgsql
as $$
begin
  new.gross_bonus := (new.perfect_videos / 6) * 4000;      -- integer division
  new.deduction   := new.mistake_videos * 4000;
  new.net_bonus   := greatest(0, new.gross_bonus - new.deduction);
  return new;
end;
$$;

create trigger trg_pm_bonus_write
before insert or update on pm_bonus_log
for each row execute function on_pm_bonus_write();

-- ── §6 Tier changes: history row drives users.current_tier ────────────────────
-- Never silently overwrite current_tier — it is only updated via a
-- tier_history insert.
create or replace function on_tier_history_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update users set current_tier = new.tier where id = new.user_id;
  return new;
end;
$$;

create trigger trg_tier_history_insert
after insert on tier_history
for each row execute function on_tier_history_insert();

-- ── Immutability guards (§6): block UPDATE/DELETE on the ledger & flags ───────
create or replace function block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Rows in % are immutable; append an offsetting entry instead.', tg_table_name;
end;
$$;

create trigger trg_credit_entries_immutable
before update or delete on credit_entries
for each row execute function block_mutation();

create trigger trg_flags_immutable
before update or delete on flags
for each row execute function block_mutation();

create trigger trg_tier_history_immutable
before update or delete on tier_history
for each row execute function block_mutation();
