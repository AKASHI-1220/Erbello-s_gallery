alter table public.geurim_members
  add column if not exists is_owner boolean not null default false;

alter table public.geurim_members
  add column if not exists left_at timestamptz;

-- A member who already left can never remain the active owner.
update public.geurim_members
set is_owner = false
where left_at is not null
  and is_owner;

-- Normalize only accidental duplicate active owners. A valid transferred owner
-- remains untouched when it is already the room's sole active owner.
with ranked_active_owners as (
  select
    id,
    row_number() over (
      partition by room_id
      order by joined_at asc, id asc
    ) as owner_rank
  from public.geurim_members
  where left_at is null
    and is_owner
)
update public.geurim_members as member
set is_owner = false
from ranked_active_owners as ranked
where member.id = ranked.id
  and ranked.owner_rank > 1;

-- Backfill only ownerless rooms. The first active joined_at/id member becomes
-- owner, preserving an ownership transfer performed by an earlier run.
with first_active_member as (
  select id, room_id
  from (
    select
      id,
      room_id,
      row_number() over (
        partition by room_id
        order by joined_at asc, id asc
      ) as member_rank
    from public.geurim_members
    where left_at is null
  ) as ranked
  where member_rank = 1
)
update public.geurim_members as member
set is_owner = true
from first_active_member as first_member
where member.id = first_member.id
  and not exists (
    select 1
    from public.geurim_members as owner
    where owner.room_id = first_member.room_id
      and owner.left_at is null
      and owner.is_owner
  );

create unique index if not exists geurim_members_one_active_owner_idx
  on public.geurim_members (room_id)
  where is_owner and left_at is null;

create index if not exists geurim_members_active_room_joined_idx
  on public.geurim_members (room_id, joined_at, id)
  where left_at is null;

create or replace function public.geurim_leave_room(
  p_code text,
  p_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_room_id uuid;
  target_member_id uuid;
  target_is_owner boolean;
  target_left_at timestamptz;
  next_owner_id uuid;
begin
  select room.id
  into target_room_id
  from public.geurim_rooms as room
  where room.code = p_code
  for update;

  if target_room_id is null then
    return jsonb_build_object('status', 'room_not_found');
  end if;

  select member.id, member.is_owner, member.left_at
  into target_member_id, target_is_owner, target_left_at
  from public.geurim_members as member
  where member.room_id = target_room_id
    and member.session_token_hash = p_token_hash
  for update;

  if target_member_id is null then
    return jsonb_build_object('status', 'session_required');
  end if;

  if target_left_at is not null then
    return jsonb_build_object(
      'status', 'already_left',
      'member_id', target_member_id
    );
  end if;

  if target_is_owner then
    select member.id
    into next_owner_id
    from public.geurim_members as member
    where member.room_id = target_room_id
      and member.id <> target_member_id
      and member.left_at is null
    order by member.joined_at asc, member.id asc
    limit 1
    for update;

    if next_owner_id is null then
      return jsonb_build_object('status', 'last_owner_must_delete');
    end if;
  end if;

  update public.geurim_members
  set
    is_owner = false,
    left_at = now()
  where id = target_member_id;

  if next_owner_id is not null then
    update public.geurim_members
    set is_owner = true
    where id = next_owner_id
      and room_id = target_room_id
      and left_at is null;
  end if;

  return jsonb_build_object(
    'status', 'left',
    'member_id', target_member_id,
    'ownership_transferred', next_owner_id is not null,
    'new_owner_member_id', next_owner_id
  );
end;
$function$;

create or replace function public.geurim_delete_room(
  p_code text,
  p_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  target_room_id uuid;
  target_member_id uuid;
  target_is_owner boolean;
begin
  select room.id
  into target_room_id
  from public.geurim_rooms as room
  where room.code = p_code
  for update;

  if target_room_id is null then
    return jsonb_build_object('status', 'room_not_found');
  end if;

  select member.id, member.is_owner
  into target_member_id, target_is_owner
  from public.geurim_members as member
  where member.room_id = target_room_id
    and member.session_token_hash = p_token_hash
    and member.left_at is null
  for update;

  if target_member_id is null then
    return jsonb_build_object('status', 'session_required');
  end if;

  if not target_is_owner then
    return jsonb_build_object('status', 'owner_required');
  end if;

  delete from public.geurim_rooms
  where id = target_room_id;

  return jsonb_build_object(
    'status', 'deleted',
    'room_id', target_room_id,
    'code', p_code
  );
end;
$function$;

revoke all
  on function public.geurim_leave_room(text, text)
  from public, anon, authenticated;
revoke all
  on function public.geurim_delete_room(text, text)
  from public, anon, authenticated;

grant execute
  on function public.geurim_leave_room(text, text)
  to service_role;
grant execute
  on function public.geurim_delete_room(text, text)
  to service_role;
