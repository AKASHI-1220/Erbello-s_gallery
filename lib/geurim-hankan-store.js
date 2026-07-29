const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const hasSupabase = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
);
let supabase = null;

if (hasSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

const DATA_FILE = path.join(__dirname, '..', 'data', 'geurim-hankan.json');
const MODE = hasSupabase ? 'supabase' : 'local-json';
const MAX_MEMBERS_PER_ROOM = 40;
const MAX_LATEST_ENTRIES = 60;
const REACTION_TYPES = ['heart', 'sparkle', 'laugh', 'tear', 'clap'];

let localQueue = Promise.resolve();

class GeurimStoreError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'GeurimStoreError';
    this.status = status;
    this.code = code;
  }
}

function storeError(status, code, message) {
  return new GeurimStoreError(status, code, message);
}

function defaultLocalState() {
  return {
    version: 1,
    rooms: [],
    members: [],
    entries: [],
    reactions: []
  };
}

function backfillLocalMembership(state) {
  let changed = false;
  for (const member of state.members) {
    if (typeof member.is_owner !== 'boolean') {
      member.is_owner = false;
      changed = true;
    }
    if (member.left_at === undefined) {
      member.left_at = null;
      changed = true;
    }
    if (member.left_at && member.is_owner) {
      member.is_owner = false;
      changed = true;
    }
  }

  for (const room of state.rooms) {
    const active = state.members
      .filter(member => member.room_id === room.id && !member.left_at)
      .sort((left, right) =>
        String(left.joined_at).localeCompare(String(right.joined_at)) ||
        String(left.id).localeCompare(String(right.id))
      );
    if (active.length === 0) continue;
    const existingOwners = active.filter(member => member.is_owner);
    const owner = existingOwners[0] || active[0];
    for (const member of active) {
      const shouldOwn = member.id === owner.id;
      if (member.is_owner !== shouldOwn) {
        member.is_owner = shouldOwn;
        changed = true;
      }
    }
  }
  return changed;
}

function withLocalLock(task) {
  const run = localQueue.then(task, task);
  localQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function readLocalState() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultLocalState();
    const state = {
      version: 1,
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      members: Array.isArray(parsed.members) ? parsed.members : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      reactions: Array.isArray(parsed.reactions) ? parsed.reactions : []
    };
    if (backfillLocalMembership(state)) await writeLocalState(state);
    return state;
  } catch (error) {
    if (error && error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
      throw error;
    }
    return defaultLocalState();
  }
}

async function writeLocalState(state) {
  const directory = path.dirname(DATA_FILE);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${DATA_FILE}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(temporary, DATA_FILE);
}

function isMissingRow(error) {
  return Boolean(error && error.code === 'PGRST116');
}

function isUniqueViolation(error) {
  return Boolean(
    error &&
    (
      error.code === '23505' ||
      String(error.message || '').toLowerCase().includes('duplicate key')
    )
  );
}

function publicMember(row) {
  return {
    id: String(row.id),
    memberId: String(row.id),
    nickname: String(row.nickname || ''),
    color: String(row.color || ''),
    joinedAt: String(row.joined_at || row.joinedAt || ''),
    isOwner: row.is_owner === true || row.isOwner === true
  };
}

function reactionSummary(rows, viewerMemberId) {
  const summary = new Map(
    REACTION_TYPES.map(type => [type, { type, count: 0, mine: false }])
  );
  for (const row of rows || []) {
    const type = String(row.type || '');
    const current = summary.get(type);
    if (!current) continue;
    current.count += 1;
    if (String(row.member_id || row.memberId) === String(viewerMemberId)) {
      current.mine = true;
    }
  }
  return [...summary.values()].filter(item => item.count > 0 || item.mine);
}

function publicEntry(row, membersById, reactions, viewerMemberId) {
  const memberId = String(row.member_id || row.memberId || '');
  const author = membersById && membersById.get(memberId);
  return {
    id: String(row.id),
    memberId,
    author: author ? publicMember(author) : null,
    caption: String(row.caption || ''),
    strokes: Array.isArray(row.strokes) ? row.strokes : [],
    createdAt: String(row.created_at || row.createdAt || ''),
    reactions: reactionSummary(reactions || [], viewerMemberId)
  };
}

function publicRoom(room, members, entries, reactions, viewerMemberId) {
  const allMembers = members || [];
  const membersById = new Map(
    allMembers.map(member => [String(member.id), member])
  );
  const activeMembers = allMembers.filter(member =>
    !(member.left_at || member.leftAt)
  );
  const owner = activeMembers.find(member =>
    member.is_owner === true || member.isOwner === true
  );
  const viewer = activeMembers.find(member =>
    String(member.id) === String(viewerMemberId)
  );
  const viewerIsOwner = Boolean(
    viewer && (viewer.is_owner === true || viewer.isOwner === true)
  );
  const reactionsByEntry = new Map();
  for (const reaction of reactions || []) {
    const entryId = String(reaction.entry_id || reaction.entryId || '');
    if (!reactionsByEntry.has(entryId)) reactionsByEntry.set(entryId, []);
    reactionsByEntry.get(entryId).push(reaction);
  }

  return {
    code: String(room.code),
    name: String(room.name || ''),
    schedule: room.schedule_kind === 'daily'
      ? { kind: 'daily', time: String(room.schedule_time || '21:00').slice(0, 5) }
      : { kind: 'hourly' },
    createdAt: String(room.created_at || room.createdAt || ''),
    members: activeMembers.map(publicMember),
    ownerMemberId: owner ? String(owner.id) : null,
    permissions: {
      canLeave: Boolean(
        viewer && (!viewerIsOwner || activeMembers.length > 1)
      ),
      canDeleteRoom: viewerIsOwner,
      leaveRequiresDelete: viewerIsOwner && activeMembers.length === 1
    },
    entries: (entries || []).map(entry =>
      publicEntry(
        entry,
        membersById,
        reactionsByEntry.get(String(entry.id)) || [],
        viewerMemberId
      )
    )
  };
}

async function getSupabaseRoom(code) {
  const { data, error } = await supabase
    .from('geurim_rooms')
    .select('id, code, name, schedule_kind, schedule_time, created_at')
    .eq('code', code)
    .maybeSingle();
  if (error && !isMissingRow(error)) throw error;
  return data || null;
}

async function getSupabaseMember(roomId, tokenHash) {
  const { data, error } = await supabase
    .from('geurim_members')
    .select('id, room_id, nickname, color, joined_at, is_owner, left_at')
    .eq('room_id', roomId)
    .eq('session_token_hash', tokenHash)
    .is('left_at', null)
    .maybeSingle();
  if (error && !isMissingRow(error)) throw error;
  return data || null;
}

async function authenticateSupabase(code, tokenHash) {
  const room = await getSupabaseRoom(code);
  if (!room) {
    throw storeError(404, 'ROOM_NOT_FOUND', '해당 초대코드의 방을 찾을 수 없어요.');
  }
  const member = await getSupabaseMember(room.id, tokenHash);
  if (!member) {
    throw storeError(401, 'SESSION_REQUIRED', '이 방에 다시 입장해 주세요.');
  }
  return { room, member };
}

function authenticateLocal(state, code, tokenHash) {
  const room = state.rooms.find(item => item.code === code);
  if (!room) {
    throw storeError(404, 'ROOM_NOT_FOUND', '해당 초대코드의 방을 찾을 수 없어요.');
  }
  const member = state.members.find(item =>
    item.room_id === room.id &&
    item.session_token_hash === tokenHash &&
    !item.left_at
  );
  if (!member) {
    throw storeError(401, 'SESSION_REQUIRED', '이 방에 다시 입장해 주세요.');
  }
  return { room, member };
}

async function loadSupabaseRoom(room, viewerMemberId) {
  const [memberResult, entryResult] = await Promise.all([
    supabase
      .from('geurim_members')
      .select('id, room_id, nickname, color, joined_at, is_owner, left_at')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('geurim_entries')
      .select('id, room_id, member_id, caption, strokes, created_at')
      .eq('room_id', room.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MAX_LATEST_ENTRIES)
  ]);
  if (memberResult.error) throw memberResult.error;
  if (entryResult.error) throw entryResult.error;

  const entries = entryResult.data || [];
  let reactions = [];
  if (entries.length > 0) {
    const reactionResult = await supabase
      .from('geurim_reactions')
      .select('entry_id, member_id, type')
      .in('entry_id', entries.map(entry => entry.id));
    if (reactionResult.error) throw reactionResult.error;
    reactions = reactionResult.data || [];
  }

  return publicRoom(
    room,
    memberResult.data || [],
    entries,
    reactions,
    viewerMemberId
  );
}

function loadLocalRoom(state, room, viewerMemberId) {
  const members = state.members
    .filter(item => item.room_id === room.id)
    .sort((left, right) =>
      String(left.joined_at).localeCompare(String(right.joined_at)) ||
      String(left.id).localeCompare(String(right.id))
    );
  const entries = state.entries
    .filter(item => item.room_id === room.id)
    .sort((left, right) =>
      String(right.created_at).localeCompare(String(left.created_at)) ||
      String(right.id).localeCompare(String(left.id))
    )
    .slice(0, MAX_LATEST_ENTRIES);
  const entryIds = new Set(entries.map(entry => entry.id));
  const reactions = state.reactions.filter(item => entryIds.has(item.entry_id));
  return publicRoom(room, members, entries, reactions, viewerMemberId);
}

async function createRoom(input) {
  if (supabase) {
    const now = new Date().toISOString();
    const roomId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const roomRow = {
      id: roomId,
      code: input.code,
      name: input.name,
      schedule_kind: input.schedule.kind,
      schedule_time: input.schedule.kind === 'daily' ? input.schedule.time : null,
      created_at: now
    };
    const roomInsert = await supabase.from('geurim_rooms').insert(roomRow);
    if (roomInsert.error) {
      if (isUniqueViolation(roomInsert.error)) {
        throw storeError(409, 'CODE_COLLISION', '초대코드가 겹쳤어요.');
      }
      throw roomInsert.error;
    }

    const memberRow = {
      id: memberId,
      room_id: roomId,
      nickname: input.nickname,
      color: input.color,
      session_token_hash: input.tokenHash,
      is_owner: true,
      left_at: null,
      joined_at: now
    };
    const memberInsert = await supabase.from('geurim_members').insert(memberRow);
    if (memberInsert.error) {
      await supabase.from('geurim_rooms').delete().eq('id', roomId);
      throw memberInsert.error;
    }

    const room = await loadSupabaseRoom(roomRow, memberId);
    return { room, memberId };
  }

  return withLocalLock(async () => {
    const state = await readLocalState();
    if (state.rooms.some(room => room.code === input.code)) {
      throw storeError(409, 'CODE_COLLISION', '초대코드가 겹쳤어요.');
    }
    const now = new Date().toISOString();
    const room = {
      id: crypto.randomUUID(),
      code: input.code,
      name: input.name,
      schedule_kind: input.schedule.kind,
      schedule_time: input.schedule.kind === 'daily' ? input.schedule.time : null,
      created_at: now
    };
    const member = {
      id: crypto.randomUUID(),
      room_id: room.id,
      nickname: input.nickname,
      color: input.color,
      session_token_hash: input.tokenHash,
      is_owner: true,
      left_at: null,
      joined_at: now
    };
    state.rooms.push(room);
    state.members.push(member);
    await writeLocalState(state);
    return {
      room: loadLocalRoom(state, room, member.id),
      memberId: member.id
    };
  });
}

async function joinRoom(input) {
  if (supabase) {
    const room = await getSupabaseRoom(input.code);
    if (!room) {
      throw storeError(404, 'ROOM_NOT_FOUND', '해당 초대코드의 방을 찾을 수 없어요.');
    }
    const countResult = await supabase
      .from('geurim_members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .is('left_at', null);
    if (countResult.error) throw countResult.error;
    if (Number(countResult.count || 0) >= MAX_MEMBERS_PER_ROOM) {
      throw storeError(409, 'ROOM_FULL', '이 방은 참여 인원이 가득 찼어요.');
    }

    const memberId = crypto.randomUUID();
    const memberInsert = await supabase.from('geurim_members').insert({
      id: memberId,
      room_id: room.id,
      nickname: input.nickname,
      color: input.color,
      session_token_hash: input.tokenHash,
      is_owner: false,
      left_at: null,
      joined_at: new Date().toISOString()
    });
    if (memberInsert.error) throw memberInsert.error;
    return {
      room: await loadSupabaseRoom(room, memberId),
      memberId
    };
  }

  return withLocalLock(async () => {
    const state = await readLocalState();
    const room = state.rooms.find(item => item.code === input.code);
    if (!room) {
      throw storeError(404, 'ROOM_NOT_FOUND', '해당 초대코드의 방을 찾을 수 없어요.');
    }
    const memberCount = state.members.filter(item =>
      item.room_id === room.id && !item.left_at
    ).length;
    if (memberCount >= MAX_MEMBERS_PER_ROOM) {
      throw storeError(409, 'ROOM_FULL', '이 방은 참여 인원이 가득 찼어요.');
    }
    const member = {
      id: crypto.randomUUID(),
      room_id: room.id,
      nickname: input.nickname,
      color: input.color,
      session_token_hash: input.tokenHash,
      is_owner: false,
      left_at: null,
      joined_at: new Date().toISOString()
    };
    state.members.push(member);
    await writeLocalState(state);
    return {
      room: loadLocalRoom(state, room, member.id),
      memberId: member.id
    };
  });
}

async function getRoom(input) {
  if (supabase) {
    const { room, member } = await authenticateSupabase(input.code, input.tokenHash);
    return loadSupabaseRoom(room, member.id);
  }
  return withLocalLock(async () => {
    const state = await readLocalState();
    const { room, member } = authenticateLocal(state, input.code, input.tokenHash);
    return loadLocalRoom(state, room, member.id);
  });
}

async function loadSupabaseEntry(roomId, entryId, viewerMemberId) {
  const entryResult = await supabase
    .from('geurim_entries')
    .select('id, room_id, member_id, caption, strokes, created_at')
    .eq('id', entryId)
    .eq('room_id', roomId)
    .maybeSingle();
  if (entryResult.error && !isMissingRow(entryResult.error)) throw entryResult.error;
  if (!entryResult.data) {
    throw storeError(404, 'ENTRY_NOT_FOUND', '그림을 찾을 수 없어요.');
  }

  const [memberResult, reactionResult] = await Promise.all([
    supabase
      .from('geurim_members')
      .select('id, room_id, nickname, color, joined_at, is_owner, left_at')
      .eq('id', entryResult.data.member_id)
      .maybeSingle(),
    supabase
      .from('geurim_reactions')
      .select('entry_id, member_id, type')
      .eq('entry_id', entryId)
  ]);
  if (memberResult.error && !isMissingRow(memberResult.error)) throw memberResult.error;
  if (reactionResult.error) throw reactionResult.error;
  const membersById = new Map();
  if (memberResult.data) {
    membersById.set(String(memberResult.data.id), memberResult.data);
  }
  return publicEntry(
    entryResult.data,
    membersById,
    reactionResult.data || [],
    viewerMemberId
  );
}

function loadLocalEntry(state, roomId, entryId, viewerMemberId) {
  const entry = state.entries.find(item =>
    item.id === entryId && item.room_id === roomId
  );
  if (!entry) {
    throw storeError(404, 'ENTRY_NOT_FOUND', '그림을 찾을 수 없어요.');
  }
  const member = state.members.find(item => item.id === entry.member_id);
  const membersById = new Map();
  if (member) membersById.set(String(member.id), member);
  return publicEntry(
    entry,
    membersById,
    state.reactions.filter(item => item.entry_id === entryId),
    viewerMemberId
  );
}

async function createEntry(input) {
  if (supabase) {
    const { room, member } = await authenticateSupabase(input.code, input.tokenHash);
    const row = {
      id: crypto.randomUUID(),
      room_id: room.id,
      member_id: member.id,
      caption: input.caption,
      strokes: input.strokes,
      created_at: new Date().toISOString()
    };
    const { error } = await supabase.from('geurim_entries').insert(row);
    if (error) throw error;
    return loadSupabaseEntry(room.id, row.id, member.id);
  }

  return withLocalLock(async () => {
    const state = await readLocalState();
    const { room, member } = authenticateLocal(state, input.code, input.tokenHash);
    const entry = {
      id: crypto.randomUUID(),
      room_id: room.id,
      member_id: member.id,
      caption: input.caption,
      strokes: input.strokes,
      created_at: new Date().toISOString()
    };
    state.entries.push(entry);
    await writeLocalState(state);
    return loadLocalEntry(state, room.id, entry.id, member.id);
  });
}

async function setReaction(input) {
  if (supabase) {
    const { room, member } = await authenticateSupabase(input.code, input.tokenHash);
    const entryResult = await supabase
      .from('geurim_entries')
      .select('id')
      .eq('id', input.entryId)
      .eq('room_id', room.id)
      .maybeSingle();
    if (entryResult.error && !isMissingRow(entryResult.error)) {
      throw entryResult.error;
    }
    if (!entryResult.data) {
      throw storeError(404, 'ENTRY_NOT_FOUND', '그림을 찾을 수 없어요.');
    }

    if (input.active) {
      const result = await supabase
        .from('geurim_reactions')
        .upsert(
          {
            entry_id: input.entryId,
            room_id: room.id,
            member_id: member.id,
            type: input.type,
            created_at: new Date().toISOString()
          },
          {
            onConflict: 'entry_id,member_id,type',
            ignoreDuplicates: true
          }
        );
      if (result.error) throw result.error;
    } else {
      const result = await supabase
        .from('geurim_reactions')
        .delete()
        .eq('entry_id', input.entryId)
        .eq('member_id', member.id)
        .eq('type', input.type);
      if (result.error) throw result.error;
    }
    return loadSupabaseEntry(room.id, input.entryId, member.id);
  }

  return withLocalLock(async () => {
    const state = await readLocalState();
    const { room, member } = authenticateLocal(state, input.code, input.tokenHash);
    const entry = state.entries.find(item =>
      item.id === input.entryId && item.room_id === room.id
    );
    if (!entry) {
      throw storeError(404, 'ENTRY_NOT_FOUND', '그림을 찾을 수 없어요.');
    }

    const matches = item =>
      item.entry_id === input.entryId &&
      item.member_id === member.id &&
      item.type === input.type;
    if (input.active && !state.reactions.some(matches)) {
      state.reactions.push({
        entry_id: input.entryId,
        room_id: room.id,
        member_id: member.id,
        type: input.type,
        created_at: new Date().toISOString()
      });
    } else if (!input.active) {
      state.reactions = state.reactions.filter(item => !matches(item));
    }
    await writeLocalState(state);
    return loadLocalEntry(state, room.id, input.entryId, member.id);
  });
}

function rpcPayload(data) {
  if (Array.isArray(data)) return data[0] || {};
  return data && typeof data === 'object' ? data : {};
}

function membershipStatusError(status) {
  if (status === 'room_not_found') {
    return storeError(404, 'ROOM_NOT_FOUND', '해당 초대코드의 방을 찾을 수 없어요.');
  }
  if (status === 'session_required') {
    return storeError(401, 'SESSION_REQUIRED', '이 방에 다시 입장해 주세요.');
  }
  if (status === 'last_owner_must_delete') {
    return storeError(
      409,
      'LAST_OWNER_MUST_DELETE',
      '마지막 방장은 방 나가기 대신 방을 완전히 삭제해야 해요.'
    );
  }
  if (status === 'owner_required') {
    return storeError(403, 'OWNER_REQUIRED', '방장만 이 방을 완전히 삭제할 수 있어요.');
  }
  return storeError(
    500,
    'MEMBERSHIP_REQUEST_FAILED',
    '멤버 정보를 변경하지 못했어요.'
  );
}

async function leaveRoom(input) {
  if (supabase) {
    const { data, error } = await supabase.rpc('geurim_leave_room', {
      p_code: input.code,
      p_token_hash: input.tokenHash
    });
    if (error) throw error;
    const result = rpcPayload(data);
    if (result.status === 'left' || result.status === 'already_left') {
      return {
        left: true,
        alreadyLeft: result.status === 'already_left',
        ownershipTransferred: Boolean(result.ownership_transferred),
        newOwnerMemberId: result.new_owner_member_id
          ? String(result.new_owner_member_id)
          : null
      };
    }
    throw membershipStatusError(result.status);
  }

  return withLocalLock(async () => {
    const state = await readLocalState();
    const room = state.rooms.find(item => item.code === input.code);
    if (!room) throw membershipStatusError('room_not_found');
    const member = state.members.find(item =>
      item.room_id === room.id && item.session_token_hash === input.tokenHash
    );
    if (!member) throw membershipStatusError('session_required');
    if (member.left_at) {
      return {
        left: true,
        alreadyLeft: true,
        ownershipTransferred: false,
        newOwnerMemberId: null
      };
    }

    let nextOwner = null;
    if (member.is_owner) {
      nextOwner = state.members
        .filter(item =>
          item.room_id === room.id &&
          item.id !== member.id &&
          !item.left_at
        )
        .sort((left, right) =>
          String(left.joined_at).localeCompare(String(right.joined_at)) ||
          String(left.id).localeCompare(String(right.id))
        )[0] || null;
      if (!nextOwner) throw membershipStatusError('last_owner_must_delete');
    }

    member.is_owner = false;
    member.left_at = new Date().toISOString();
    if (nextOwner) nextOwner.is_owner = true;
    await writeLocalState(state);
    return {
      left: true,
      alreadyLeft: false,
      ownershipTransferred: Boolean(nextOwner),
      newOwnerMemberId: nextOwner ? String(nextOwner.id) : null
    };
  });
}

async function deleteRoom(input) {
  if (supabase) {
    const { data, error } = await supabase.rpc('geurim_delete_room', {
      p_code: input.code,
      p_token_hash: input.tokenHash
    });
    if (error) throw error;
    const result = rpcPayload(data);
    if (result.status === 'deleted') {
      return { deleted: true, code: input.code };
    }
    throw membershipStatusError(result.status);
  }

  return withLocalLock(async () => {
    const state = await readLocalState();
    const room = state.rooms.find(item => item.code === input.code);
    if (!room) throw membershipStatusError('room_not_found');
    const member = state.members.find(item =>
      item.room_id === room.id &&
      item.session_token_hash === input.tokenHash &&
      !item.left_at
    );
    if (!member) throw membershipStatusError('session_required');
    if (!member.is_owner) throw membershipStatusError('owner_required');

    const memberIds = new Set(
      state.members
        .filter(item => item.room_id === room.id)
        .map(item => item.id)
    );
    const entryIds = new Set(
      state.entries
        .filter(item => item.room_id === room.id)
        .map(item => item.id)
    );
    state.reactions = state.reactions.filter(item =>
      item.room_id !== room.id &&
      !entryIds.has(item.entry_id) &&
      !memberIds.has(item.member_id)
    );
    state.entries = state.entries.filter(item => item.room_id !== room.id);
    state.members = state.members.filter(item => item.room_id !== room.id);
    state.rooms = state.rooms.filter(item => item.id !== room.id);
    await writeLocalState(state);
    return { deleted: true, code: input.code };
  });
}

module.exports = {
  mode: MODE,
  REACTION_TYPES,
  GeurimStoreError,
  createRoom,
  joinRoom,
  getRoom,
  createEntry,
  setReaction,
  leaveRoom,
  deleteRoom
};
