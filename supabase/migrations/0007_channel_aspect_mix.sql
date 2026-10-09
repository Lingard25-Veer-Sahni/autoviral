-- Additive migration: lets an autopilot channel request a mix of output
-- sizes per day (e.g. 4 reels + 2 landscape videos) instead of always
-- generating 9:16. `aspect_ratio_mix` maps aspect ratio -> how many of that
-- size to generate per day; `videos_per_day` stays the sum of those counts
-- (kept in sync by the app, still the single source of truth the scheduler's
-- pacing math reads). `aspect_ratio_cursor` is an internal round-robin
-- pointer (see videoPipeline.ts's pickNextAspectRatio) that cycles through
-- the flattened mix so consecutive generations rotate through every
-- requested size rather than clustering.
-- Safe to run on top of 0001-0006.

alter table public.channels
  add column if not exists aspect_ratio_mix jsonb not null default '{"9:16": 1}'::jsonb;

alter table public.channels
  add column if not exists aspect_ratio_cursor integer not null default 0;
