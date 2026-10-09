-- Additive migration: in-app notifications, starting with the "your video
-- failed and was refunded" case. Safe to run on top of 0001-0004.

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Nullable + ON DELETE SET NULL: a notification should survive its video
  -- being deleted (same "don't block on a dangling reference" reasoning as
  -- videos.voice_profile_id in 0004_voice_profiles.sql).
  video_id uuid references public.videos(id) on delete set null,
  -- 'video_failed' today; free-text so future notification kinds (e.g.
  -- 'video_posted', 'low_credits') don't need a migration to add.
  type text not null default 'info',
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_user_id_read_idx on public.notifications(user_id, read);

alter table public.notifications enable row level security;

-- Read-only for the owning user (or admin) — rows are only ever created by
-- the backend via the service-role key (see server/src/services/notifications.ts),
-- which bypasses RLS entirely, so there is deliberately no INSERT policy for
-- regular users here.
create policy "notifications_select_own_or_admin" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());

-- Users can mark their own notifications read (or admins can moderate any).
create policy "notifications_update_own_or_admin" on public.notifications
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Users can dismiss (delete) their own notifications.
create policy "notifications_delete_own_or_admin" on public.notifications
  for delete using (user_id = auth.uid() or public.is_admin());
