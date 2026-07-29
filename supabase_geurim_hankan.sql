create extension if not exists pgcrypto;

create table if not exists public.geurim_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  schedule_kind text not null,
  schedule_time time without time zone,
  created_at timestamptz not null default now(),
  constraint geurim_rooms_code_format
    check (code ~ '^[A-Z0-9]{6}$'),
  constraint geurim_rooms_name_length
    check (char_length(btrim(name)) between 1 and 30),
  constraint geurim_rooms_schedule_kind
    check (schedule_kind in ('hourly', 'daily')),
  constraint geurim_rooms_schedule_value
    check (
      (schedule_kind = 'hourly' and schedule_time is null)
      or
      (schedule_kind = 'daily' and schedule_time is not null)
    )
);

create table if not exists public.geurim_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.geurim_rooms(id) on delete cascade,
  nickname text not null,
  color text not null,
  session_token_hash text not null unique,
  joined_at timestamptz not null default now(),
  constraint geurim_members_room_id_id_unique
    unique (room_id, id),
  constraint geurim_members_nickname_length
    check (char_length(btrim(nickname)) between 2 and 12),
  constraint geurim_members_color_format
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint geurim_members_token_hash_format
    check (session_token_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.geurim_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  member_id uuid not null,
  caption text not null default '',
  strokes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint geurim_entries_room_id_id_unique
    unique (room_id, id),
  constraint geurim_entries_member_fk
    foreign key (room_id, member_id)
    references public.geurim_members(room_id, id)
    on delete cascade,
  constraint geurim_entries_caption_length
    check (char_length(caption) <= 300),
  constraint geurim_entries_strokes_array
    check (jsonb_typeof(strokes) = 'array'),
  constraint geurim_entries_not_empty
    check (
      char_length(btrim(caption)) > 0
      or jsonb_array_length(strokes) > 0
    )
);

create table if not exists public.geurim_reactions (
  entry_id uuid not null,
  room_id uuid not null,
  member_id uuid not null,
  type text not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, member_id, type),
  constraint geurim_reactions_entry_fk
    foreign key (room_id, entry_id)
    references public.geurim_entries(room_id, id)
    on delete cascade,
  constraint geurim_reactions_member_fk
    foreign key (room_id, member_id)
    references public.geurim_members(room_id, id)
    on delete cascade,
  constraint geurim_reactions_type
    check (type in ('heart', 'sparkle', 'laugh', 'tear', 'clap'))
);

create index if not exists geurim_members_room_joined_idx
  on public.geurim_members (room_id, joined_at, id);

create index if not exists geurim_entries_room_created_idx
  on public.geurim_entries (room_id, created_at desc, id desc);

create index if not exists geurim_entries_room_member_idx
  on public.geurim_entries (room_id, member_id);

create index if not exists geurim_reactions_room_member_idx
  on public.geurim_reactions (room_id, member_id);

create index if not exists geurim_reactions_room_entry_idx
  on public.geurim_reactions (room_id, entry_id);

alter table public.geurim_rooms enable row level security;
alter table public.geurim_members enable row level security;
alter table public.geurim_entries enable row level security;
alter table public.geurim_reactions enable row level security;

revoke all on table public.geurim_rooms from public, anon, authenticated;
revoke all on table public.geurim_members from public, anon, authenticated;
revoke all on table public.geurim_entries from public, anon, authenticated;
revoke all on table public.geurim_reactions from public, anon, authenticated;

grant select, insert, update, delete
  on table public.geurim_rooms
  to service_role;
grant select, insert, update, delete
  on table public.geurim_members
  to service_role;
grant select, insert, update, delete
  on table public.geurim_entries
  to service_role;
grant select, insert, update, delete
  on table public.geurim_reactions
  to service_role;
