-- ============================================================================
-- Allow permanent user deletion to cascade. The DELETE-immutability triggers on
-- tier_history and flags blocked the cascade (raising "rows are immutable").
-- App users still can't delete these directly (no RLS delete policy exists);
-- only an owner-level cascade (deleting the parent user) reaches them.
-- ============================================================================

drop trigger if exists trg_tier_history_immutable on tier_history;
drop trigger if exists trg_flags_immutable on flags;
