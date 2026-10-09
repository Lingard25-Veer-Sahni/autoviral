-- Additive migration: live generation-progress reporting for the `videos` table.
-- Safe to run on top of 0001_init.sql + 0002_social_account_meta.sql.

alter table public.videos add column if not exists progress integer not null default 0 check (progress >= 0 and progress <= 100);
-- Real (non-simulated) 0-100 percentage of how far a `generating` video's
-- pipeline has actually progressed -- written by the backend at genuine
-- stage boundaries (script generation, per-scene rendering, compositing,
-- upload), not a fake time-based animation.

alter table public.videos add column if not exists progress_stage text;
-- Human-readable label for whatever real stage `progress` currently reflects,
-- e.g. "Generating script", "Rendering scene 2 of 5", "Uploading video".
