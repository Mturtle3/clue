-- Clue Nexus database setup
-- Run this file once in Supabase Dashboard -> SQL Editor.
-- The browser never receives the secret solution or another player's hand.

create extension if not exists pgcrypto;

create table if not exists public.clue_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  room_name text not null default 'The Unnamed Estate',
  host_id uuid not null,
  phase text not null default 'lobby' check (phase in ('lobby', 'playing', 'won', 'ended')),
  public_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clue_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.clue_rooms(id) on delete cascade,
  user_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 22),
  color text not null,
  is_host boolean not null default false,
  ready boolean not null default false,
  eliminated boolean not null default false,
  position jsonb not null default '{"roomId":"study","step":0}'::jsonb,
  created_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, display_name)
);

-- Hands are kept in a separate table with an owner-only read policy.
create table if not exists public.clue_player_cards (
  room_id uuid not null references public.clue_rooms(id) on delete cascade,
  user_id uuid not null,
  card_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- The solution and authoritative full state are service-role-only.
create table if not exists public.clue_room_secrets (
  room_id uuid primary key references public.clue_rooms(id) on delete cascade,
  solution_ids text[] not null default '{}',
  engine_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- The Edge Function uses service_role and needs explicit table privileges.
grant select, insert, update, delete on table
  public.clue_rooms,
  public.clue_players,
  public.clue_player_cards,
  public.clue_room_secrets
to service_role;

grant usage, select on all sequences in schema public to service_role;

create index if not exists clue_players_room_id_idx on public.clue_players(room_id);
create index if not exists clue_rooms_code_idx on public.clue_rooms(code);

alter table public.clue_rooms enable row level security;
alter table public.clue_players enable row level security;
alter table public.clue_player_cards enable row level security;
alter table public.clue_room_secrets enable row level security;

drop policy if exists "members can read room state" on public.clue_rooms;
create policy "members can read room state"
  on public.clue_rooms for select to authenticated
  using (exists (
    select 1 from public.clue_players p
    where p.room_id = clue_rooms.id and p.user_id = auth.uid()
  ));

drop policy if exists "members can read player list" on public.clue_players;
create policy "members can read player list"
  on public.clue_players for select to authenticated
  using (exists (
    select 1 from public.clue_players member
    where member.room_id = clue_players.room_id and member.user_id = auth.uid()
  ));

drop policy if exists "players can read their own cards" on public.clue_player_cards;
create policy "players can read their own cards"
  on public.clue_player_cards for select to authenticated
  using (user_id = auth.uid());

-- No client policy exists for clue_room_secrets. Only the service role used by
-- the Edge Function can read or write the solution and authoritative state.

create or replace function public.set_clue_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clue_rooms_updated_at on public.clue_rooms;
create trigger clue_rooms_updated_at
before update on public.clue_rooms
for each row execute function public.set_clue_updated_at();

do $$
begin
  begin
    alter publication supabase_realtime add table public.clue_rooms;
  exception when duplicate_object then
    null;
  end;
end;
$$;
