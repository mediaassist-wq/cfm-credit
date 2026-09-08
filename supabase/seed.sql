-- ============================================================================
-- Seed: organizations (tenants). Run this after the migrations.
--
-- User PROFILES are created by scripts/seed.mjs (it also creates the matching
-- Supabase Auth users), because public.users.id must reference auth.users.id.
-- ============================================================================

insert into organizations (name, slug) values
  ('CFM Wing', 'cfm'),
  ('OBM Wing', 'obm')
on conflict (slug) do nothing;
