-- GIclock Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profile table (stores user state)
create table profile (
  id bigint primary key generated always as identity,
  user_id text not null unique default 'self',
  gems bigint not null default 0,
  fates bigint not null default 0,
  sessions_completed bigint not null default 0,
  total_study_time double precision not null default 0,
  streak bigint not null default 0,
  last_study_date date,
  equipped_character text,
  pity_5star bigint not null default 0,
  pity_4star bigint not null default 0,
  roster_data jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{"pomodoroDuration":25,"shortBreak":5,"longBreak":15,"gemsPerMinute":1}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Sessions table (study sessions)
create table sessions (
  id bigint primary key generated always as identity,
  user_id text not null default 'self',
  start_time timestamp with time zone not null default now(),
  end_time timestamp with time zone,
  duration_minutes double precision not null,
  mode text not null default 'pomodoro',
  gems_earned bigint not null default 0,
  companion_id text,
  created_at timestamp with time zone not null default now()
);

-- Unlocks table (character rewards)
create table unlocks (
  id bigint primary key generated always as identity,
  user_id text not null default 'self',
  character_id text not null,
  reward_type text not null,
  reward_level bigint not null,
  unlocked_at timestamp with time zone not null default now(),
  unique(user_id, character_id, reward_type)
);

-- Pulls history table
create table pulls (
  id bigint primary key generated always as identity,
  user_id text not null default 'self',
  pull_time timestamp with time zone not null default now(),
  count bigint not null,
  gems_spent bigint not null,
  results jsonb not null default '[]'::jsonb,
  pity_5star_after bigint not null default 0,
  pity_4star_after bigint not null default 0
);

-- Enable RLS
alter table profile enable row level security;
alter table sessions enable row level security;
alter table unlocks enable row level security;
alter table pulls enable row level security;

-- RLS policies (open for single-user app)
create policy "Allow all for self" on profile for all using (user_id = 'self') with check (user_id = 'self');
create policy "Allow all for self" on sessions for all using (user_id = 'self') with check (user_id = 'self');
create policy "Allow all for self" on unlocks for all using (user_id = 'self') with check (user_id = 'self');
create policy "Allow all for self" on pulls for all using (user_id = 'self') with check (user_id = 'self');

-- Create updated_at trigger
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profile_updated_at
  before update on profile
  for each row execute procedure update_updated_at_column();

-- Insert initial profile
insert into profile (user_id, gems, fates) values ('self', 0, 0);
