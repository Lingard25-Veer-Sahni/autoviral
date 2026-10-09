-- Additive migration: lets a user mark one of their cloned voices as the
-- account-wide default, so it's used automatically for narration without
-- having to pick it every time -- both in the manual Create Video flow and
-- in Channel Autopilot generations (see server/src/routes/voices.ts's new
-- PATCH /api/voices/:id/default, and scheduler.ts's runAutopilotTick()).
-- Safe to run on top of 0001-0005.

alter table public.voice_profiles add column if not exists is_default boolean not null default false;

-- Enforce at most one default voice profile per user. A partial unique index
-- (rather than a plain unique constraint) only applies to rows where
-- is_default is true, so every non-default row (the common case) is
-- unconstrained.
create unique index if not exists voice_profiles_one_default_per_user
  on public.voice_profiles(user_id) where is_default;
