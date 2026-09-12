-- ============================================================================
-- Make the credit ledger editable by managers (PM / Management).
-- Removes the append-only immutability on credit_entries and adds RLS
-- update/delete policies. (tier_history and flags-delete stay immutable.)
-- ============================================================================

drop trigger if exists trg_credit_entries_immutable on credit_entries;

drop policy if exists credit_update on credit_entries;
create policy credit_update on credit_entries
  for update
  using (org_id = auth_org_id() and manages_user(user_id))
  with check (org_id = auth_org_id() and manages_user(user_id));

drop policy if exists credit_delete on credit_entries;
create policy credit_delete on credit_entries
  for delete
  using (org_id = auth_org_id() and manages_user(user_id));
