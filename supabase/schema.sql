-- ============================================================
-- REPOMOVA DATABASE SCHEMA (PostgreSQL / Supabase)
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- 1. PROFILES (Extends Supabase auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  github_username text,
  github_access_token text, -- encrypted token or managed via OAuth
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. CONNECTED APPS
-- ------------------------------------------------------------
create table if not exists public.connected_apps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  repo_owner text not null,
  repo_name text not null,
  repo_full_name text not null,
  repo_url text not null,
  default_branch text default 'main' not null,
  clone_status text default 'pending' check (clone_status in ('pending', 'cloning', 'cloned', 'failed')),
  runtime_type text default 'unknown' not null,
  status text default 'connected' check (status in (
    'connected',
    'preparing',
    'requires_configuration',
    'installing_dependencies',
    'building',
    'starting',
    'running',
    'stopped',
    'failed',
    'unsupported'
  )),
  port integer,
  env_vars jsonb default '{}'::jsonb,
  is_starred boolean default false,
  last_opened timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.connected_apps enable row level security;

create policy "Users can view own connected apps"
  on public.connected_apps for select
  using (auth.uid() = user_id);

create policy "Users can insert own connected apps"
  on public.connected_apps for insert
  with check (auth.uid() = user_id);

create policy "Users can update own connected apps"
  on public.connected_apps for update
  using (auth.uid() = user_id);

create policy "Users can delete own connected apps"
  on public.connected_apps for delete
  using (auth.uid() = user_id);

-- Index for quick lookups
create index if not exists idx_connected_apps_user on public.connected_apps (user_id);
create index if not exists idx_connected_apps_status on public.connected_apps (status);

-- ------------------------------------------------------------
-- 3. WORKSPACE TABS (State persistence across sessions)
-- ------------------------------------------------------------
create table if not exists public.workspace_tabs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  app_id uuid references public.connected_apps(id) on delete cascade not null,
  title text not null,
  preview_url text,
  status text not null,
  position integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.workspace_tabs enable row level security;

create policy "Users can manage own workspace tabs"
  on public.workspace_tabs for all
  using (auth.uid() = user_id);

create index if not exists idx_workspace_tabs_user on public.workspace_tabs (user_id);

-- ------------------------------------------------------------
-- 4. APPLICATION RUNTIME LOGS / EVENTS
-- ------------------------------------------------------------
create table if not exists public.app_logs (
  id bigint generated always as identity primary key,
  app_id uuid references public.connected_apps(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  log_level text check (log_level in ('info', 'warn', 'error', 'debug')) default 'info',
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.app_logs enable row level security;

create policy "Users can view own app logs"
  on public.app_logs for select
  using (auth.uid() = user_id);

create index if not exists idx_app_logs_app on public.app_logs (app_id, created_at desc);
