-- ════════════════════════════════════════════════════════════════
-- SANCTUARY — FULL SUPABASE SETUP
-- Paste this WHOLE file into Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: every statement is "create if not exists" or "drop + recreate"
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
-- 3. STORAGE BUCKETS
--    attachments → avatars + note attachments (pdf/word/excel/images)
--    gallery     → memories + vision board photos + place photos
--    music       → audio tracks  ← THIS WAS MISSING, music never synced
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 4. STORAGE POLICIES
--    Files are stored under a path like  <user_id>/filename.ext
--    so each user can only touch their own folder.
-- ─────────────────────────────────────────────

-- ATTACHMENTS bucket
drop policy if exists "attachments read own" on storage.objects;
create policy "attachments read own" on storage.objects
  for select using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments insert own" on storage.objects;
create policy "attachments insert own" on storage.objects
  for insert with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments update own" on storage.objects;
create policy "attachments update own" on storage.objects
  for update using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "attachments delete own" on storage.objects;
create policy "attachments delete own" on storage.objects
  for delete using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- GALLERY bucket
drop policy if exists "gallery read own" on storage.objects;
create policy "gallery read own" on storage.objects
  for select using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gallery insert own" on storage.objects;
create policy "gallery insert own" on storage.objects
  for insert with check (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gallery update own" on storage.objects;
create policy "gallery update own" on storage.objects
  for update using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "gallery delete own" on storage.objects;
create policy "gallery delete own" on storage.objects
  for delete using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text);

-- MUSIC bucket
drop policy if exists "music read own" on storage.objects;
create policy "music read own" on storage.objects
  for select using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "music insert own" on storage.objects;
create policy "music insert own" on storage.objects
  for insert with check (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "music update own" on storage.objects;
create policy "music update own" on storage.objects
  for update using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "music delete own" on storage.objects;
create policy "music delete own" on storage.objects
  for delete using (bucket_id = 'music' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────
-- DONE.
-- After running this, also raise file-size limits in:
-- Supabase Dashboard → Storage → (each bucket) → ⚙️ → File size limit
-- music files in particular can be 5-10MB+ each; default cap may be too low.
-- ─────────────────────────────────────────────
