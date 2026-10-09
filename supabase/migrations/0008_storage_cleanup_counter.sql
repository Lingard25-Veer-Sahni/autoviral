-- Tracks successful video generations since the last storage cleanup, per
-- account. Drives the automatic storage-cleanup feature in
-- server/src/services/videoPipeline.ts: every 10 counts, the user is asked
-- (via a notification) to free up storage; every 15 counts, old videos are
-- pruned automatically and the counter resets to 0.
alter table public.profiles
  add column if not exists videos_since_cleanup integer not null default 0;
