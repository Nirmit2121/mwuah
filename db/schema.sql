-- Mwuah 💋 — Supabase schema.
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- Both of you sign into ONE shared account, so RLS just allows any authenticated user.

-- ---------- tables ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  author text not null,                 -- 'nirmit' | 'akkshita'
  amount numeric not null,
  category text,
  note text,
  spent_on date not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date,
  flow text,
  symptoms text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  body text not null,
  color text default 'yellow',
  created_at timestamptz not null default now()
);

create table if not exists public.bucket (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  title text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.moods (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  mood text not null,
  note text,
  day date not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.taps (
  id uuid primary key default gen_random_uuid(),
  author text not null,                 -- who sent the love tap
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  author text not null,
  title text not null,
  photo_url text,
  taken_on date,
  note text,
  is_milestone boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  kind text default 'event',            -- birthday | anniversary | event | trip
  recurring boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target numeric not null,
  emoji text default '🐷',
  author text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references public.goals(id) on delete cascade,
  author text not null,
  amount numeric not null,
  note text,
  saved_on date not null default now(),
  created_at timestamptz not null default now()
);

-- helpful indexes for list views
create index if not exists expenses_spent_idx on public.expenses(spent_on desc);
create index if not exists cycles_start_idx   on public.cycles(start_date);
create index if not exists notes_created_idx   on public.notes(created_at desc);
create index if not exists memories_taken_idx  on public.memories(taken_on desc);
create index if not exists events_date_idx     on public.events(date);
create index if not exists savings_goal_idx    on public.savings(goal_id);

-- ---------- row level security ----------
-- Private 2-person app behind one shared login: any signed-in user can read/write.
do $$
declare t text;
begin
  foreach t in array array['expenses','cycles','notes','bucket','moods','taps','memories','events','goals','savings']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_authed_rw" on public.%I;', t, t);
    execute format($f$create policy "%s_authed_rw" on public.%I
      for all to authenticated using (true) with check (true);$f$, t, t);
  end loop;
end $$;

-- ---------- storage bucket for memory photos ----------
insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;

drop policy if exists "memories_read" on storage.objects;
create policy "memories_read" on storage.objects
  for select using (bucket_id = 'memories');

drop policy if exists "memories_write" on storage.objects;
create policy "memories_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'memories');

drop policy if exists "memories_delete" on storage.objects;
create policy "memories_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'memories');
