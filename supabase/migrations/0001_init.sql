-- Autoviral core schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "uuid-ossp";

-- ========== PROFILES ==========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  credits integer not null default 10,
  plan text not null default 'starter' check (plan in ('starter', 'creator', 'studio', 'agency')),
  onboarding_complete boolean not null default false,
  onboarding_step text default 'mode', -- mode | channel | connect | credits | done
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== CHANNELS (autopilot config) ==========
create table if not exists public.channels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  niche_description text not null,
  mode text not null default 'autopilot' check (mode in ('autopilot', 'manual')),
  videos_per_day integer not null default 1,
  platforms text[] not null default array['youtube']::text[],
  voice_style text not null default 'energetic',
  status text not null default 'active' check (status in ('active', 'paused')),
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== VIDEOS ==========
create table if not exists public.videos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  mode text not null default 'manual' check (mode in ('autopilot', 'manual')),
  prompt text not null,
  script jsonb,
  title text,
  description text,
  hashtags text[] default array[]::text[],
  status text not null default 'queued' check (
    status in ('queued', 'generating', 'ready', 'scheduled', 'posting', 'posted', 'failed')
  ),
  error_message text,
  video_url text,
  thumbnail_url text,
  duration_seconds numeric,
  aspect_ratio text default '9:16',
  scheduled_at timestamptz,
  posted_at timestamptz,
  platform_targets jsonb not null default '{}'::jsonb,
  -- e.g. {"youtube": {"enabled": true, "status": "posted", "url": "..."}, "instagram": {...}}
  credits_cost integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists videos_user_id_idx on public.videos(user_id);
create index if not exists videos_status_idx on public.videos(status);
create index if not exists videos_scheduled_at_idx on public.videos(scheduled_at);

-- ========== SOCIAL ACCOUNTS ==========
create table if not exists public.social_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'instagram')),
  account_name text,
  avatar_url text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[],
  connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform)
);

-- ========== CREDIT TRANSACTIONS ==========
create table if not exists public.credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null, -- positive = purchase/grant, negative = spend
  reason text not null, -- 'purchase' | 'video_generation' | 'signup_bonus' | 'admin_adjustment'
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ========== helper: is_admin() ==========
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ========== trigger: auto-create profile on signup ==========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, credits)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    15 -- signup bonus credits
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, amount, reason)
  values (new.id, 15, 'signup_bonus');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========== updated_at triggers ==========
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.channels;
create trigger set_updated_at before update on public.channels
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.videos;
create trigger set_updated_at before update on public.videos
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_updated_at on public.social_accounts;
create trigger set_updated_at before update on public.social_accounts
  for each row execute procedure public.set_updated_at();

-- ========== ROW LEVEL SECURITY ==========
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.social_accounts enable row level security;
alter table public.credit_transactions enable row level security;

-- profiles
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin());

-- channels
create policy "channels_all_own_or_admin" on public.channels
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- videos
create policy "videos_all_own_or_admin" on public.videos
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- social_accounts
create policy "social_accounts_all_own_or_admin" on public.social_accounts
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- credit_transactions
create policy "credit_tx_select_own_or_admin" on public.credit_transactions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "credit_tx_insert_own_or_admin" on public.credit_transactions
  for insert with check (user_id = auth.uid() or public.is_admin());

-- ========== STORAGE ==========
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

create policy "public read videos" on storage.objects
  for select using (bucket_id = 'videos');
create policy "public read thumbnails" on storage.objects
  for select using (bucket_id = 'thumbnails');
create policy "authenticated upload videos" on storage.objects
  for insert with check (bucket_id = 'videos' and auth.role() = 'authenticated');
create policy "authenticated upload thumbnails" on storage.objects
  for insert with check (bucket_id = 'thumbnails' and auth.role() = 'authenticated');

-- ========== NOTE ==========
-- To make yourself an admin after signing up, run:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
