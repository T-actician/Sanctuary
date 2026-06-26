-- ════════════════════════════════════════════════════════════════
-- SANCTUARY — SUPABASE SETUP (DATA + AUTH ONLY)
-- Paste this WHOLE file into Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: every statement is "create if not exists" or "drop + recreate"
--
-- NOTE: File storage (photos, music, documents) now lives in Cloudflare R2,
-- not Supabase Storage — see the separate R2 + Worker setup guide.
-- Supabase here only handles: user accounts (auth) and your app's data
-- (goals, notes, diary entries, etc.) in the sanctuary_data table below.
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. MAIN DATA TABLE (goals, notes, diary, etc. — everything except big binary files)
-- ─────────────────────────────────────────────
create table if not exists public.sanctuary_data (
  id uuid primary key references auth.users(id) on delete cascade,
  goals jsonb default '[]'::jsonb,
  notes jsonb default '[]'::jsonb,
  diary_entries jsonb default '[]'::jsonb,
  projects jsonb default '[]'::jsonb,
  breaks jsonb default '[]'::jsonb,
  aay jsonb default '{}'::jsonb,
  achievements jsonb default '[]'::jsonb,
  growth jsonb default '[]'::jsonb,
  milestones jsonb default '[]'::jsonb,
  places jsonb default '[]'::jsonb,
  gallery jsonb default '{}'::jsonb,
  alarms jsonb default '[]'::jsonb,
  reminders jsonb default '[]'::jsonb,
  past_reminders jsonb default '[]'::jsonb,
  trash jsonb default '[]'::jsonb,
  music_tracks jsonb default '[]'::jsonb,
  music_playlists jsonb default '[]'::jsonb,
  streak int default 0,
  profile jsonb default '{}'::jsonb,
  app_theme text default 'forest',
  hero_theme text default 'night',
  notes_layout text default 'grid',
  updated_at timestamptz default now()
);

alter table public.sanctuary_data enable row level security;

drop policy if exists "select own data" on public.sanctuary_data;
create policy "select own data" on public.sanctuary_data
  for select using (auth.uid() = id);

drop policy if exists "insert own data" on public.sanctuary_data;
create policy "insert own data" on public.sanctuary_data
  for insert with check (auth.uid() = id);

drop policy if exists "update own data" on public.sanctuary_data;
create policy "update own data" on public.sanctuary_data
  for update using (auth.uid() = id);

drop policy if exists "delete own data" on public.sanctuary_data;
create policy "delete own data" on public.sanctuary_data
  for delete using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- 2. PROFILES TABLE (used by avatar upload code — confirm/create it)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "upsert own profile" on public.profiles;
create policy "upsert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- DONE. No storage buckets needed here — R2 handles all files now.
-- If you previously created 'attachments', 'gallery', or 'music' buckets
-- in Supabase Storage from an earlier setup, you can leave them (harmless,
-- unused) or delete them from Supabase Dashboard → Storage to reclaim
-- your 1GB free quota for nothing-in-particular.
-- ─────────────────────────────────────────────

