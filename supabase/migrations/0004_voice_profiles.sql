-- Additive migration: custom cloned-voice profiles (Voicebox integration).
-- Safe to run on top of 0001_init.sql + 0002_social_account_meta.sql + 0003_video_progress.sql.

create table if not exists public.voice_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  -- The profile_id Voicebox itself assigned when we called POST /profiles on
  -- its API (see server/src/services/voiceboxTts.ts) -- this is what we pass
  -- back as `profile_id` on every POST /generate/stream call to narrate with
  -- this specific cloned voice. Voicebox is a self-hosted service (Docker),
  -- so this ID only resolves against whichever Voicebox instance created it.
  voicebox_profile_id text not null,
  -- 'pending' while the sample is being uploaded/transcribed, 'ready' once at
  -- least one sample has been attached and the profile can be used for
  -- narration, 'failed' if sample upload/transcription errored out.
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  error_message text,
  sample_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_profiles_user_id_idx on public.voice_profiles(user_id);

drop trigger if exists set_updated_at on public.voice_profiles;
create trigger set_updated_at before update on public.voice_profiles
  for each row execute procedure public.set_updated_at();

alter table public.voice_profiles enable row level security;

create policy "voice_profiles_all_own_or_admin" on public.voice_profiles
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Referenced by name (not FK, since Voicebox's own profile can be deleted
-- independently and a generation should degrade gracefully rather than be
-- blocked by a dangling reference) from videos.voice_profile_id below.
alter table public.videos add column if not exists voice_profile_id uuid references public.voice_profiles(id) on delete set null;
-- When set, this video's narration was (or was attempted to be) synthesized
-- with this specific cloned voice via Voicebox, instead of the normal
-- ElevenLabs/Azure/`say` engine chain -- see render.ts's synthesizeNarration().
