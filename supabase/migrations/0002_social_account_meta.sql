-- Additive migration: extra fields needed by the real OAuth posting pipeline.
-- Safe to run on top of 0001_init.sql.

alter table public.social_accounts add column if not exists platform_account_id text;
-- e.g. Instagram's connected Business Account id (needed for every Graph API publish call,
-- distinct from the Autoviral user_id). Nullable — YouTube doesn't need it.

alter table public.social_accounts add column if not exists meta jsonb not null default '{}'::jsonb;
-- Free-form extra data per platform connection (e.g. linked Facebook Page id/name).
