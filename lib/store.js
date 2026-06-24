const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
let supabase = null;

if (hasSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'artifacts.json');
const PAGES_FILE = path.join(DATA_DIR, 'site_pages.json');
const POST_INTERACTIONS_FILE = path.join(DATA_DIR, 'post_interactions.json');
const TAROT_PUBLIC_FILE = path.join(DATA_DIR, 'tarot_public_settings.json');
const TAROT_INVITES_FILE = path.join(DATA_DIR, 'tarot_invites.json');
const TAROT_SUBMISSIONS_FILE = path.join(DATA_DIR, 'tarot_submissions.json');
const mode = hasSupabase ? 'supabase' : 'local-json';
const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'erbello-media';
const ARTIFACT_BUCKET = process.env.SUPABASE_ARTIFACT_BUCKET || 'erbello-artifacts';
const PROJECT_STATUSES = new Set(['public', 'private', 'draft']);
const POST_INTERACTION_KINDS = new Set(['message', 'vote']);
const POST_INTERACTION_VISIBILITIES = new Set(['public', 'private']);

async function ensureJsonFile(file, fallback) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(file); }
  catch (_) { await fs.writeFile(file, JSON.stringify(fallback, null, 2), 'utf8'); }
}

async function readJson(file, fallback) {
  await ensureJsonFile(file, fallback);
  const raw = await fs.readFile(file, 'utf8');
  try { return JSON.parse(raw); }
  catch (_) { return fallback; }
}

async function writeJson(file, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

function byUpdatedDesc(a, b) {
  return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
}

function normalizeTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[\n,#，、]+/);
  const seen = new Set();
  const tags = [];
  for (const item of raw) {
    const tag = String(item || '').replace(/^#+/, '').trim().replace(/\s+/g, ' ').slice(0, 28);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 14) break;
  }
  return tags;
}

function normalizeSourceKind(value, isJsx = false) {
  const kind = String(value || '').toLowerCase();
  if (['html', 'jsx', 'zip', 'post', 'other'].includes(kind)) return kind;
  return isJsx ? 'jsx' : 'html';
}

function normalizeStatus(value, isPrivate = false) {
  const status = String(value || '').toLowerCase().trim();
  if (PROJECT_STATUSES.has(status)) return status;
  return isPrivate ? 'private' : 'public';
}

function normalizeGalleryImages(value) {
  if (Array.isArray(value)) return value.filter(Boolean).slice(0, 8);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 8) : [];
    } catch (_) { return []; }
  }
  return [];
}

function normalizeInteraction(row) {
  const item = row || {};
  const kind = POST_INTERACTION_KINDS.has(String(item.kind || '').toLowerCase()) ? String(item.kind).toLowerCase() : 'message';
  const visibility = POST_INTERACTION_VISIBILITIES.has(String(item.visibility || '').toLowerCase()) ? String(item.visibility).toLowerCase() : 'private';
  return {
    id: String(item.id || ''),
    post_id: String(item.post_id || item.postId || ''),
    kind,
    visibility,
    name: String(item.name || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    body: String(item.body || '').replace(/\r\n/g, '\n').trim().slice(0, 1000),
    option_key: String(item.option_key || item.optionKey || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    vote_key: (item.vote_key || item.voteKey) ? String(item.vote_key || item.voteKey).replace(/\s+/g, ' ').trim().slice(0, 160) : null,
    created_at: item.created_at || new Date().toISOString()
  };
}

function normalizeArtifact(item) {
  const row = item || {};
  return {
    ...row,
    view_count: Number(row.view_count || 0),
    tags: normalizeTags(row.tags),
    source_kind: normalizeSourceKind(row.source_kind, row.is_jsx),
    cover_image: String(row.cover_image || ''),
    gallery_images: normalizeGalleryImages(row.gallery_images),
    detail_text: String(row.detail_text || ''),
    status: normalizeStatus(row.status, row.is_private),
    is_private: Boolean(row.is_private) || normalizeStatus(row.status, row.is_private) === 'private',
    private_password_hash: String(row.private_password_hash || ''),
    private_password_salt: String(row.private_password_salt || ''),
    code_storage_bucket: String(row.code_storage_bucket || ''),
    code_storage_path: String(row.code_storage_path || ''),
    code_storage_mime: String(row.code_storage_mime || ''),
    source_filename: String(row.source_filename || '')
  };
}

function maskPrivateArtifact(item) {
  const row = normalizeArtifact(item);
  if (row.status === 'draft') {
    return {
      id: row.id,
      title: row.title,
      description: '',
      type: 'other',
      tags: [],
      source_kind: 'other',
      source_filename: '',
      status: 'draft',
      is_jsx: false,
      is_private: false,
      view_count: 0,
      cover_image: '',
      gallery_images: [],
      detail_text: '',
      created_at: '',
      updated_at: ''
    };
  }
  if (!row.is_private) {
    const { private_password_hash, private_password_salt, code_storage_bucket, code_storage_path, ...safe } = row;
    return safe;
  }
  return {
    id: row.id,
    title: row.title,
    description: '',
    type: 'other',
    tags: [],
    source_kind: 'other',
    source_filename: '',
    is_jsx: false,
    is_private: true,
    view_count: 0,
    cover_image: '',
    gallery_images: [],
    detail_text: '',
    created_at: '',
    updated_at: ''
  };
}

function stripSecrets(row) {
  const { private_password_hash, private_password_salt, ...safe } = normalizeArtifact(row);
  return safe;
}

function isMissingColumnOrTable(error) {
  const text = `${error && (error.message || error.details || error.hint || error.code)}`.toLowerCase();
  return text.includes('does not exist') || text.includes('schema cache') || text.includes('column') || text.includes('relation');
}

function isMissingRpc(error) {
  const text = `${error && (error.message || error.details || error.hint || error.code)}`.toLowerCase();
  return text.includes('pgrst202')
    || text.includes('schema cache')
    || text.includes('could not find the function')
    || (text.includes('function') && text.includes('does not exist'));
}

const LIST_COLUMNS = 'id, title, description, type, tags, source_kind, source_filename, status, is_jsx, created_at, updated_at, view_count, cover_image, gallery_images, detail_text, is_private';

async function listArtifacts(options = {}) {
  const includePrivateDetails = Boolean(options && options.includePrivateDetails);
  if (supabase) {
    let { data, error } = await supabase.from('artifacts').select(LIST_COLUMNS).order('updated_at', { ascending: false });
    if (error && isMissingColumnOrTable(error)) {
      const fallback = await supabase.from('artifacts').select('id, title, description, type, tags, source_kind, is_jsx, created_at, updated_at, view_count, cover_image, gallery_images, detail_text, is_private').order('updated_at', { ascending: false });
      data = fallback.data; error = fallback.error;
    }
    if (error && isMissingColumnOrTable(error)) {
      const fallback = await supabase.from('artifacts').select('id, title, description, type, is_jsx, created_at, updated_at').order('updated_at', { ascending: false });
      data = fallback.data; error = fallback.error;
    }
    if (error) throw error;
    return (data || [])
      .map(normalizeArtifact)
      .filter(item => includePrivateDetails || item.status !== 'draft')
      .map(item => includePrivateDetails ? item : maskPrivateArtifact(item));
  }

  const items = await readJson(DATA_FILE, []);
  return (Array.isArray(items) ? items : [])
    .map(({ code, private_password_hash, private_password_salt, code_storage_bucket, code_storage_path, ...rest }) => normalizeArtifact(rest))
    .filter(item => includePrivateDetails || item.status !== 'draft')
    .map(item => includePrivateDetails ? item : maskPrivateArtifact(item))
    .sort(byUpdatedDesc);
}

async function getArtifact(id) {
  if (supabase) {
    const { data, error } = await supabase.from('artifacts').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? normalizeArtifact(data) : null;
  }

  const items = await readJson(DATA_FILE, []);
  const found = (Array.isArray(items) ? items : []).find(item => String(item.id) === String(id));
  return found ? normalizeArtifact(found) : null;
}

function recordFromPayload(payload, existing = {}) {
  return normalizeArtifact({
    ...existing,
    title: payload.title,
    description: payload.description || '',
    type: payload.type || 'other',
    tags: payload.tags || [],
    source_kind: payload.source_kind || (payload.is_jsx ? 'jsx' : 'html'),
    cover_image: payload.cover_image || '',
    gallery_images: normalizeGalleryImages(payload.gallery_images),
    detail_text: payload.detail_text || '',
    status: normalizeStatus(payload.status, payload.is_private),
    is_private: Boolean(payload.is_private) || normalizeStatus(payload.status, payload.is_private) === 'private',
    private_password_hash: payload.private_password_hash || '',
    private_password_salt: payload.private_password_salt || '',
    code: payload.code,
    is_jsx: Boolean(payload.is_jsx),
    code_storage_bucket: payload.code_storage_bucket || '',
    code_storage_path: payload.code_storage_path || '',
    code_storage_mime: payload.code_storage_mime || '',
    source_filename: payload.source_filename || ''
  });
}

function dbPayload(record, forUpdate = false) {
  const data = {
    title: record.title,
    description: record.description,
    type: record.type,
    tags: record.tags,
    source_kind: record.source_kind,
    status: record.status,
    source_filename: record.source_filename,
    cover_image: record.cover_image,
    gallery_images: record.gallery_images,
    detail_text: record.detail_text,
    is_private: record.is_private,
    private_password_hash: record.private_password_hash,
    private_password_salt: record.private_password_salt,
    code: record.code || '',
    is_jsx: record.is_jsx,
    code_storage_bucket: record.code_storage_bucket,
    code_storage_path: record.code_storage_path,
    code_storage_mime: record.code_storage_mime
  };
  if (!forUpdate) data.view_count = 0;
  return data;
}

async function createArtifact(payload) {
  const now = new Date().toISOString();
  const record = normalizeArtifact({
    id: crypto.randomUUID(),
    ...recordFromPayload(payload),
    view_count: 0,
    created_at: now,
    updated_at: now
  });

  if (supabase) {
    let { data, error } = await supabase.from('artifacts').insert(dbPayload(record)).select('*').single();
    if (error && isMissingColumnOrTable(error)) {
      const fallbackPayload = dbPayload(record);
      delete fallbackPayload.code_storage_bucket;
      delete fallbackPayload.code_storage_path;
      delete fallbackPayload.code_storage_mime;
      delete fallbackPayload.source_filename;
      delete fallbackPayload.status;
      const fallback = await supabase.from('artifacts').insert(fallbackPayload).select('*').single();
      data = fallback.data; error = fallback.error;
    }
    if (error) throw error;
    return normalizeArtifact(data);
  }

  const items = await readJson(DATA_FILE, []);
  const nextItems = Array.isArray(items) ? items : [];
  nextItems.unshift(record);
  await writeJson(DATA_FILE, nextItems);
  return record;
}

async function updateArtifact(id, payload) {
  const patch = {
    ...recordFromPayload(payload),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    let { data, error } = await supabase.from('artifacts').update(dbPayload(patch, true)).eq('id', id).select('*').single();
    if (error && isMissingColumnOrTable(error)) {
      const fallbackPatch = dbPayload(patch, true);
      delete fallbackPatch.code_storage_bucket;
      delete fallbackPatch.code_storage_path;
      delete fallbackPatch.code_storage_mime;
      delete fallbackPatch.source_filename;
      delete fallbackPatch.status;
      const fallback = await supabase.from('artifacts').update(fallbackPatch).eq('id', id).select('*').single();
      data = fallback.data; error = fallback.error;
    }
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? normalizeArtifact(data) : null;
  }

  const items = await readJson(DATA_FILE, []);
  const nextItems = Array.isArray(items) ? items : [];
  const index = nextItems.findIndex(item => String(item.id) === String(id));
  if (index === -1) return null;
  nextItems[index] = { ...nextItems[index], ...patch };
  await writeJson(DATA_FILE, nextItems);
  return normalizeArtifact(nextItems[index]);
}

async function deleteArtifact(id) {
  if (supabase) {
    const { error } = await supabase.from('artifacts').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
  const items = await readJson(DATA_FILE, []);
  const nextItems = (Array.isArray(items) ? items : []).filter(item => String(item.id) !== String(id));
  const removed = nextItems.length !== (Array.isArray(items) ? items.length : 0);
  if (removed) await writeJson(DATA_FILE, nextItems);
  return removed;
}

async function incrementView(id) {
  if (!id) return;
  if (supabase) {
    try {
      const { data, error } = await supabase.from('artifacts').select('view_count').eq('id', id).single();
      if (error) {
        if (isMissingColumnOrTable(error) || error.code === 'PGRST116') return;
        throw error;
      }
      const nextCount = Number(data && data.view_count || 0) + 1;
      const update = await supabase.from('artifacts').update({ view_count: nextCount }).eq('id', id);
      if (update.error && !isMissingColumnOrTable(update.error)) throw update.error;
    } catch (error) {
      if (!isMissingColumnOrTable(error)) console.warn('incrementView failed:', error.message || error);
    }
    return;
  }

  const items = await readJson(DATA_FILE, []);
  const nextItems = Array.isArray(items) ? items : [];
  const item = nextItems.find(row => String(row.id) === String(id));
  if (!item) return;
  item.view_count = Number(item.view_count || 0) + 1;
  await writeJson(DATA_FILE, nextItems);
}

async function listPages() {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('site_pages').select('slug, lang, content, updated_at').order('slug', { ascending: true });
      if (error) {
        if (isMissingColumnOrTable(error)) return [];
        throw error;
      }
      return data || [];
    } catch (error) {
      if (isMissingColumnOrTable(error)) return [];
      throw error;
    }
  }
  const rows = await readJson(PAGES_FILE, []);
  return Array.isArray(rows) ? rows : [];
}

async function getPage(slug, lang = 'ko') {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const cleanLang = String(lang || 'ko').trim().toLowerCase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('site_pages').select('slug, lang, content, updated_at').eq('slug', cleanSlug).eq('lang', cleanLang).maybeSingle();
      if (error) {
        if (isMissingColumnOrTable(error)) return null;
        throw error;
      }
      return data || null;
    } catch (error) {
      if (isMissingColumnOrTable(error)) return null;
      throw error;
    }
  }
  const rows = await readJson(PAGES_FILE, []);
  return (Array.isArray(rows) ? rows : []).find(item => item.slug === cleanSlug && item.lang === cleanLang) || null;
}

async function upsertPage(slug, lang, content) {
  const row = { slug:String(slug), lang:String(lang), content: content && typeof content === 'object' ? content : {}, updated_at:new Date().toISOString() };
  if (supabase) {
    const { data, error } = await supabase.from('site_pages').upsert(row, { onConflict:'slug,lang' }).select('slug, lang, content, updated_at').single();
    if (error) throw error;
    return data;
  }
  const rows = await readJson(PAGES_FILE, []);
  const nextRows = Array.isArray(rows) ? rows : [];
  const index = nextRows.findIndex(item => item.slug === row.slug && item.lang === row.lang);
  if (index === -1) nextRows.push(row);
  else nextRows[index] = row;
  await writeJson(PAGES_FILE, nextRows);
  return row;
}

async function listPostInteractions(postId, options = {}) {
  const target = String(postId || '');
  const includePrivate = Boolean(options && options.includePrivate);
  if (!target) return [];
  if (supabase) {
    let { data, error } = await supabase
      .from('post_interactions')
      .select('id, post_id, kind, visibility, name, body, option_key, vote_key, created_at')
      .eq('post_id', target)
      .order('created_at', { ascending: true });
    if (error && isMissingColumnOrTable(error)) {
      const fallback = await supabase
        .from('post_interactions')
        .select('id, post_id, kind, visibility, name, body, option_key, created_at')
        .eq('post_id', target)
        .order('created_at', { ascending: true });
      data = fallback.data; error = fallback.error;
    }
    if (error) throw error;
    return (data || [])
      .map(normalizeInteraction)
      .filter(item => includePrivate || item.visibility !== 'private');
  }

  const items = await readJson(POST_INTERACTIONS_FILE, []);
  return (Array.isArray(items) ? items : [])
    .map(normalizeInteraction)
    .filter(item => item.post_id === target)
    .filter(item => includePrivate || item.visibility !== 'private')
    .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
}

async function createPostInteraction(payload) {
  const record = normalizeInteraction({
    id: crypto.randomUUID(),
    post_id: payload && payload.post_id,
    kind: payload && payload.kind,
    visibility: payload && payload.visibility,
    name: payload && payload.name,
    body: payload && payload.body,
    option_key: payload && payload.option_key,
    vote_key: payload && payload.vote_key,
    created_at: new Date().toISOString()
  });
  if (!record.post_id) throw new Error('post_id is required.');
  if (record.kind === 'message' && !record.body) throw new Error('message body is required.');
  if (record.kind === 'vote' && !record.option_key) throw new Error('vote option is required.');

  if (supabase) {
    let { data, error } = await supabase
      .from('post_interactions')
      .insert(record)
      .select('id, post_id, kind, visibility, name, body, option_key, vote_key, created_at')
      .single();
    if (error && isMissingColumnOrTable(error)) {
      const fallbackRecord = { ...record };
      delete fallbackRecord.vote_key;
      const fallback = await supabase
        .from('post_interactions')
        .insert(fallbackRecord)
        .select('id, post_id, kind, visibility, name, body, option_key, created_at')
        .single();
      data = fallback.data; error = fallback.error;
    }
    if (error) throw error;
    return normalizeInteraction(data);
  }

  const items = await readJson(POST_INTERACTIONS_FILE, []);
  const list = Array.isArray(items) ? items : [];
  list.push(record);
  await writeJson(POST_INTERACTIONS_FILE, list);
  return record;
}


async function systemStatus() {
  const status = {
    mode,
    supabaseConfigured: Boolean(supabase),
    databaseOk: false,
    storageOk: false,
    mediaBucket: MEDIA_BUCKET,
    artifactBucket: ARTIFACT_BUCKET,
    artifactsOk: false,
    pagesOk: false,
    mediaBucketOk: false,
    artifactBucketOk: false,
    artifactStorageColumnsOk: false,
    storageUploadOk: false,
    postInteractionsOk: false,
    postVoteKeyOk: false,
    tarotPublicSettingsOk: false,
    tarotInvitesOk: false,
    tarotSubmissionsOk: false,
    artifactCount: 0,
    publicCount: 0,
    privateCount: 0,
    draftCount: 0,
    pageCount: 0,
    postInteractionCount: 0,
    tarotInviteCount: 0,
    tarotSubmissionCount: 0
  };
  if (!supabase) {
    const items = await readJson(DATA_FILE, []);
    const pages = await readJson(PAGES_FILE, []);
    const interactions = await readJson(POST_INTERACTIONS_FILE, []);
    const tarotInvites = await readJson(TAROT_INVITES_FILE, []);
    const tarotSubmissions = await readJson(TAROT_SUBMISSIONS_FILE, []);
    const normalized = (Array.isArray(items) ? items : []).map(normalizeArtifact);
    status.databaseOk = true;
    status.storageOk = true;
    status.artifactsOk = true;
    status.pagesOk = true;
    status.mediaBucketOk = true;
    status.artifactBucketOk = true;
    status.artifactStorageColumnsOk = true;
    status.storageUploadOk = true;
    status.postInteractionsOk = true;
    status.postVoteKeyOk = true;
    status.tarotPublicSettingsOk = true;
    status.tarotInvitesOk = true;
    status.tarotSubmissionsOk = true;
    status.artifactCount = normalized.length;
    status.publicCount = normalized.filter(item => item.status === 'public' && !item.is_private).length;
    status.privateCount = normalized.filter(item => item.status === 'private' || item.is_private).length;
    status.draftCount = normalized.filter(item => item.status === 'draft').length;
    status.pageCount = Array.isArray(pages) ? pages.length : 0;
    status.postInteractionCount = Array.isArray(interactions) ? interactions.length : 0;
    status.tarotInviteCount = Array.isArray(tarotInvites) ? tarotInvites.length : 0;
    status.tarotSubmissionCount = Array.isArray(tarotSubmissions) ? tarotSubmissions.length : 0;
    return status;
  }
  try {
    const { count, error } = await supabase.from('artifacts').select('id', { count:'exact', head:true });
    if (error) throw error;
    status.artifactsOk = true;
    status.databaseOk = true;
    status.artifactCount = Number(count || 0);
  } catch (error) { status.artifactsError = error.message || String(error); }
  try {
    const { data, error } = await supabase.from('artifacts').select('status, is_private');
    if (error) throw error;
    const rows = (data || []).map(normalizeArtifact);
    status.publicCount = rows.filter(item => item.status === 'public' && !item.is_private).length;
    status.privateCount = rows.filter(item => item.status === 'private' || item.is_private).length;
    status.draftCount = rows.filter(item => item.status === 'draft').length;
  } catch (error) { status.visibilityError = error.message || String(error); }
  try {
    const { error } = await supabase
      .from('artifacts')
      .select('code_storage_bucket, code_storage_path, code_storage_mime, source_filename', { head: true });
    if (error) throw error;
    status.artifactStorageColumnsOk = true;
  } catch (error) { status.artifactStorageColumnsError = error.message || String(error); }
  try {
    const { count, error } = await supabase.from('site_pages').select('slug', { count:'exact', head:true });
    if (error) throw error;
    status.pagesOk = true;
    status.databaseOk = true;
    status.pageCount = Number(count || 0);
  } catch (error) { status.pagesError = error.message || String(error); }
  try {
    const { count, error } = await supabase.from('post_interactions').select('id', { count:'exact', head:true });
    if (error) throw error;
    status.postInteractionsOk = true;
    status.databaseOk = true;
    status.postInteractionCount = Number(count || 0);
  } catch (error) { status.postInteractionsError = error.message || String(error); }
  try {
    const { error } = await supabase.from('post_interactions').select('vote_key', { head:true });
    if (error) throw error;
    status.postVoteKeyOk = true;
  } catch (error) { status.postVoteKeyError = error.message || String(error); }
  try {
    const { count, error } = await supabase.from('tarot_invites').select('id', { count:'exact', head:true });
    if (error) throw error;
    status.tarotInvitesOk = true;
    status.databaseOk = true;
    status.tarotInviteCount = Number(count || 0);
  } catch (error) { status.tarotInvitesError = error.message || String(error); }
  try {
    const { count, error } = await supabase.from('tarot_submissions').select('id', { count:'exact', head:true });
    if (error) throw error;
    status.tarotSubmissionsOk = true;
    status.databaseOk = true;
    status.tarotSubmissionCount = Number(count || 0);
  } catch (error) { status.tarotSubmissionsError = error.message || String(error); }
  try {
    const { error } = await supabase.from('tarot_public_project_settings').select('id', { head:true });
    if (error) throw error;
    status.tarotPublicSettingsOk = true;
    status.databaseOk = true;
  } catch (error) { status.tarotPublicSettingsError = error.message || String(error); }
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    status.storageOk = true;
    const names = new Set((data || []).map(bucket => bucket.name || bucket.id));
    status.mediaBucketOk = names.has(MEDIA_BUCKET);
    status.artifactBucketOk = names.has(ARTIFACT_BUCKET);
  } catch (error) { status.storageError = error.message || String(error); }
  try {
    if (!status.artifactBucketOk) throw new Error(`${ARTIFACT_BUCKET} bucket is missing.`);
    const testPath = `health/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.txt`;
    const { error } = await supabase.storage.from(ARTIFACT_BUCKET).createSignedUploadUrl(testPath);
    if (error) throw error;
    status.storageUploadOk = true;
  } catch (error) { status.storageUploadError = error.message || String(error); }
  return status;
}

function ensureSupabaseStorage() {
  if (!supabase) throw new Error('Supabase Storage is not configured.');
}

async function createSignedUploadUrl(bucket, objectPath) {
  ensureSupabaseStorage();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(objectPath);
  if (error) throw error;
  return data;
}

function getPublicUrl(bucket, objectPath) {
  ensureSupabaseStorage();
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data && data.publicUrl ? data.publicUrl : '';
}

async function downloadStorageObject(bucket, objectPath) {
  ensureSupabaseStorage();
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function isoFromMs(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function msFromDate(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function normalizeTarotSettings(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const get = (camel, snake, fallback) => src[camel] !== undefined ? src[camel] : (src[snake] !== undefined ? src[snake] : fallback);
  const bool = (camel, snake, fallback) => get(camel, snake, fallback) !== false;
  const drawMode = ['manual_select', 'shuffle_select', 'auto'].includes(String(get('drawMode', 'draw_mode', 'manual_select'))) ? String(get('drawMode', 'draw_mode', 'manual_select')) : 'manual_select';
  const revealMode = String(get('revealMode', 'reveal_mode', 'flip')) === 'static' ? 'static' : 'flip';
  const completionMessage = String(get('completionMessage', 'completion_message', '카드가 접수되었습니다.')).trim().slice(0, 200) || '카드가 접수되었습니다.';
  return {
    allowReversed:bool('allowReversed', 'allow_reversed', true),
    allow_reversed:bool('allowReversed', 'allow_reversed', true),
    showCardsToParticipant:bool('showCardsToParticipant', 'show_cards_to_participant', true),
    show_cards_to_participant:bool('showCardsToParticipant', 'show_cards_to_participant', true),
    showOrientationToParticipant:bool('showOrientationToParticipant', 'show_orientation_to_participant', true),
    show_orientation_to_participant:bool('showOrientationToParticipant', 'show_orientation_to_participant', true),
    enableResultImage:bool('enableResultImage', 'enable_result_image', true),
    enable_result_image:bool('enableResultImage', 'enable_result_image', true),
    includeQuestionInImage:get('includeQuestionInImage', 'include_question_in_image', false) === true,
    include_question_in_image:get('includeQuestionInImage', 'include_question_in_image', false) === true,
    revealMode,
    reveal_mode:revealMode,
    drawMode,
    draw_mode:drawMode,
    requireNickname:bool('requireNickname', 'require_nickname', true),
    require_nickname:bool('requireNickname', 'require_nickname', true),
    requireTitle:bool('requireTitle', 'require_title', true),
    require_title:bool('requireTitle', 'require_title', true),
    requireQuestion:bool('requireQuestion', 'require_question', true),
    require_question:bool('requireQuestion', 'require_question', true),
    allowTopicSelect:bool('allowTopicSelect', 'allow_topic_select', true),
    allow_topic_select:bool('allowTopicSelect', 'allow_topic_select', true),
    singleUse:bool('singleUse', 'single_use', true),
    single_use:bool('singleUse', 'single_use', true),
    completionMessage,
    completion_message:completionMessage,
    spreadCount:Number(src.spreadCount || src.spread_count || 3)
  };
}

function normalizeTarotInvite(row) {
  const item = row || {};
  return {
    id:String(item.id || ''),
    codeHash:String(item.code_hash || item.codeHash || ''),
    codeSuffix:String(item.code_suffix || item.codeSuffix || ''),
    label:String(item.label || ''),
    internalNote:String(item.internal_note || item.internalNote || ''),
    readingTitle:String(item.reading_title || item.readingTitle || ''),
    spreadCount:Number(item.spread_count || item.spreadCount || 3),
    spreadType:String(item.spread_type || item.spreadType || ''),
    spreadPositions:Array.isArray(item.spread_positions) ? item.spread_positions : (Array.isArray(item.spreadPositions) ? item.spreadPositions : []),
    settings:normalizeTarotSettings(item.settings),
    status:String(item.status || 'open'),
    expiresAt:msFromDate(item.expires_at || item.expiresAt),
    usedAt:msFromDate(item.used_at || item.usedAt),
    createdAt:msFromDate(item.created_at || item.createdAt) || Date.now(),
    updatedAt:msFromDate(item.updated_at || item.updatedAt) || Date.now()
  };
}

function normalizeTarotSubmission(row) {
  const item = row || {};
  return {
    id:String(item.id || ''),
    inviteId:String(item.invite_id || item.inviteId || ''),
    participantName:String(item.participant_name || item.participantName || ''),
    title:String(item.title || ''),
    topic:String(item.topic || ''),
    question:String(item.question || ''),
    spreadCount:Number(item.spread_count || item.spreadCount || 3),
    spreadType:String(item.spread_type || item.spreadType || ''),
    drawnCards:Array.isArray(item.drawn_cards) ? item.drawn_cards : (Array.isArray(item.drawnCards) ? item.drawnCards : []),
    resultImageUrl:String(item.result_image_url || item.resultImageUrl || ''),
    status:String(item.status || 'received'),
    adminNote:String(item.admin_note || item.adminNote || ''),
    interpretation:String(item.interpretation || ''),
    createdAt:msFromDate(item.created_at || item.createdAt) || Date.now(),
    updatedAt:msFromDate(item.updated_at || item.updatedAt) || Date.now(),
    deleteAt:msFromDate(item.delete_after || item.deleteAt)
  };
}

function tarotInviteDbPayload(payload) {
  const item = normalizeTarotInvite(payload);
  return {
    id:item.id,
    code_hash:item.codeHash,
    code_suffix:item.codeSuffix,
    label:item.label,
    internal_note:item.internalNote,
    reading_title:item.readingTitle,
    spread_count:item.spreadCount,
    spread_type:item.spreadType,
    spread_positions:item.spreadPositions,
    settings:item.settings,
    status:item.status,
    expires_at:isoFromMs(item.expiresAt)
  };
}

function tarotSubmissionDbPayload(payload) {
  const item = normalizeTarotSubmission(payload);
  const nowIso = new Date().toISOString();
  return {
    id:item.id,
    invite_id:item.inviteId,
    participant_name:item.participantName,
    title:item.title,
    topic:item.topic,
    question:item.question,
    spread_count:item.spreadCount,
    spread_type:item.spreadType,
    drawn_cards:item.drawnCards,
    result_image_url:item.resultImageUrl,
    status:item.status,
    admin_note:item.adminNote,
    interpretation:item.interpretation,
    created_at:isoFromMs(item.createdAt) || nowIso,
    updated_at:isoFromMs(item.updatedAt) || nowIso,
    delete_after:isoFromMs(item.deleteAt)
  };
}

function tarotSubmissionPatch(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const patch = {};
  if (src.status !== undefined) patch.status = String(src.status || 'received').slice(0, 40);
  if (src.adminNote !== undefined || src.admin_note !== undefined) patch.admin_note = String(src.adminNote || src.admin_note || '').slice(0, 2000);
  if (src.interpretation !== undefined) patch.interpretation = String(src.interpretation || '').slice(0, 6000);
  patch.updated_at = new Date().toISOString();
  return patch;
}

function defaultTarotPublicSettings() {
  return {
    title:'타로 리딩 접수',
    description:'참여코드를 받은 분만 접수할 수 있습니다.',
    notice:'실명이나 연락처 없이 닉네임과 질문만 남겨 주세요. 타로 리딩은 자기 이해와 선택을 돕는 참고용 콘텐츠입니다.',
    buttonLabel:'타로 접수 사이트 열기',
    buttonUrl:'',
    entryButtonLabel:'참여코드 입력하기',
    isPublic:true,
    updatedAt:Date.now()
  };
}

function normalizeTarotPublicSettings(row) {
  const item = row && typeof row === 'object' ? row : {};
  return {
    id:String(item.id || ''),
    title:String(item.title || defaultTarotPublicSettings().title),
    description:String(item.description || defaultTarotPublicSettings().description),
    notice:String(item.notice || defaultTarotPublicSettings().notice),
    buttonLabel:String(item.button_label || item.buttonLabel || defaultTarotPublicSettings().buttonLabel),
    buttonUrl:String(item.button_url || item.buttonUrl || defaultTarotPublicSettings().buttonUrl),
    entryButtonLabel:String(item.entry_button_label || item.entryButtonLabel || defaultTarotPublicSettings().entryButtonLabel),
    isPublic:item.is_public !== undefined ? item.is_public !== false : (item.isPublic !== false),
    updatedAt:msFromDate(item.updated_at || item.updatedAt) || Date.now()
  };
}

async function getTarotPublicSettings() {
  if (supabase) {
    const { data, error } = await supabase.from('tarot_public_project_settings').select('*').order('updated_at', { ascending:false }).limit(1).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? normalizeTarotPublicSettings(data) : defaultTarotPublicSettings();
  }
  const row = await readJson(TAROT_PUBLIC_FILE, defaultTarotPublicSettings());
  return normalizeTarotPublicSettings(row);
}

async function updateTarotPublicSettings(payload) {
  const current = await getTarotPublicSettings();
  const next = normalizeTarotPublicSettings({ ...current, ...payload, updatedAt:Date.now() });
  if (supabase) {
    const dbPayload = {
      title:next.title.slice(0, 80),
      description:next.description.slice(0, 500),
      notice:next.notice.slice(0, 500),
      button_label:next.buttonLabel.slice(0, 40),
      button_url:next.buttonUrl.slice(0, 300),
      entry_button_label:next.entryButtonLabel.slice(0, 40),
      is_public:next.isPublic,
      updated_at:new Date().toISOString()
    };
    let result;
    if (next.id) result = await supabase.from('tarot_public_project_settings').update(dbPayload).eq('id', next.id).select('*').single();
    else result = await supabase.from('tarot_public_project_settings').insert(dbPayload).select('*').single();
    if (result.error && isMissingColumnOrTable(result.error)) {
      const { entry_button_label, ...fallbackPayload } = dbPayload;
      if (next.id) result = await supabase.from('tarot_public_project_settings').update(fallbackPayload).eq('id', next.id).select('*').single();
      else result = await supabase.from('tarot_public_project_settings').insert(fallbackPayload).select('*').single();
    }
    if (result.error) throw result.error;
    return normalizeTarotPublicSettings({ ...result.data, entryButtonLabel:next.entryButtonLabel });
  }
  await writeJson(TAROT_PUBLIC_FILE, next);
  return next;
}

async function listTarotInvites() {
  if (supabase) {
    const { data, error } = await supabase.from('tarot_invites').select('*').order('created_at', { ascending:false });
    if (error) throw error;
    return (data || []).map(normalizeTarotInvite);
  }
  const rows = await readJson(TAROT_INVITES_FILE, []);
  return (Array.isArray(rows) ? rows : []).map(normalizeTarotInvite).sort((a, b) => b.createdAt - a.createdAt);
}

async function createTarotInvite(payload) {
  const record = normalizeTarotInvite({
    ...payload,
    id:payload.id || crypto.randomUUID(),
    status:'open',
    createdAt:Date.now(),
    updatedAt:Date.now()
  });
  if (supabase) {
    const { data, error } = await supabase.from('tarot_invites').insert(tarotInviteDbPayload(record)).select('*').single();
    if (error) throw error;
    return normalizeTarotInvite(data);
  }
  const rows = await readJson(TAROT_INVITES_FILE, []);
  const next = [record, ...(Array.isArray(rows) ? rows : [])];
  await writeJson(TAROT_INVITES_FILE, next);
  return record;
}

async function deleteTarotInvite(id) {
  if (supabase) {
    const submissionDelete = await supabase.from('tarot_submissions').delete().eq('invite_id', id);
    if (submissionDelete.error && !isMissingColumnOrTable(submissionDelete.error)) throw submissionDelete.error;
    const { error } = await supabase.from('tarot_invites').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
  const rows = await readJson(TAROT_INVITES_FILE, []);
  const current = Array.isArray(rows) ? rows : [];
  const nextInvites = current.filter(item => String(item.id) !== String(id));
  const submissions = await readJson(TAROT_SUBMISSIONS_FILE, []);
  const nextSubmissions = (Array.isArray(submissions) ? submissions : []).filter(item => String(item.inviteId || item.invite_id) !== String(id));
  await writeJson(TAROT_INVITES_FILE, nextInvites);
  await writeJson(TAROT_SUBMISSIONS_FILE, nextSubmissions);
  return nextInvites.length !== current.length;
}

async function deleteExpiredTarotSubmissions() {
  if (supabase) {
    const { error } = await supabase.rpc('tarot_delete_old_submissions');
    if (!error) return true;
    if (!isMissingRpc(error)) throw error;
    const fallback = await supabase
      .from('tarot_submissions')
      .delete()
      .lte('delete_after', new Date().toISOString());
    if (fallback.error) {
      if (isMissingColumnOrTable(fallback.error)) return false;
      throw fallback.error;
    }
    return true;
  }
  const rows = await readJson(TAROT_SUBMISSIONS_FILE, []);
  const current = Array.isArray(rows) ? rows : [];
  const now = Date.now();
  const next = current.filter(item => {
    const deleteAt = msFromDate(item.delete_after || item.deleteAt);
    return !deleteAt || deleteAt > now;
  });
  if (next.length !== current.length) await writeJson(TAROT_SUBMISSIONS_FILE, next);
  return current.length - next.length;
}

async function listTarotSubmissions() {
  try {
    await deleteExpiredTarotSubmissions();
  } catch (_) {}
  if (supabase) {
    const { data, error } = await supabase.from('tarot_submissions').select('*').order('created_at', { ascending:false });
    if (error) throw error;
    return (data || []).map(normalizeTarotSubmission);
  }
  const rows = await readJson(TAROT_SUBMISSIONS_FILE, []);
  return (Array.isArray(rows) ? rows : []).map(normalizeTarotSubmission).sort((a, b) => b.createdAt - a.createdAt);
}

async function updateTarotSubmission(id, payload) {
  if (supabase) {
    const { data, error } = await supabase.from('tarot_submissions').update(tarotSubmissionPatch(payload)).eq('id', id).select('*').single();
    if (error) throw error;
    return normalizeTarotSubmission(data);
  }
  const rows = await readJson(TAROT_SUBMISSIONS_FILE, []);
  const next = Array.isArray(rows) ? rows : [];
  const index = next.findIndex(item => String(item.id) === String(id));
  if (index < 0) return null;
  next[index] = { ...next[index], ...payload, updatedAt:Date.now() };
  await writeJson(TAROT_SUBMISSIONS_FILE, next);
  return normalizeTarotSubmission(next[index]);
}

async function deleteTarotSubmission(id) {
  if (supabase) {
    const { error } = await supabase.from('tarot_submissions').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
  const rows = await readJson(TAROT_SUBMISSIONS_FILE, []);
  const current = Array.isArray(rows) ? rows : [];
  const next = current.filter(item => String(item.id) !== String(id));
  await writeJson(TAROT_SUBMISSIONS_FILE, next);
  return next.length !== current.length;
}

async function findTarotInviteByCodeHash(hash) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('tarot_invites')
    .select('*')
    .eq('code_hash', hash)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data ? normalizeTarotInvite(data) : null;
}

async function validateTarotInvite(codeHash) {
  const hash = String(codeHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  if (supabase) {
    const { data, error } = await supabase.rpc('tarot_validate_invite', { p_code_hash:hash });
    if (error) {
      if (isMissingRpc(error)) return findTarotInviteByCodeHash(hash);
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return row ? normalizeTarotInvite({
      id:row.invite_id,
      reading_title:row.reading_title,
      spread_count:row.spread_count,
      spread_type:row.spread_type,
      spread_positions:row.spread_positions,
      settings:row.settings,
      status:row.status,
      expires_at:row.expires_at
    }) : null;
  }
  const invites = await listTarotInvites();
  return invites.find(item => item.codeHash === hash) || null;
}

function assertDrawnCardsForInvite(invite, drawnCards) {
  if (!invite) {
    const err = new Error('invalid_invite_code');
    err.statusCode = 400;
    throw err;
  }
  if (invite.expiresAt && invite.expiresAt < Date.now()) {
    const err = new Error('expired_invite_code');
    err.statusCode = 400;
    throw err;
  }
  if (invite.settings.singleUse !== false && invite.status !== 'open') {
    const err = new Error('used_invite_code');
    err.statusCode = 400;
    throw err;
  }
  if (drawnCards.length !== invite.spreadCount) {
    const err = new Error('invalid_drawn_cards');
    err.statusCode = 400;
    throw err;
  }
  const seen = new Set();
  for (const card of drawnCards) {
    const id = String(card.card_id || card.cardId || '');
    if (!id || seen.has(id) || !['upright', 'reversed'].includes(String(card.orientation || ''))) {
      const err = new Error(seen.has(id) ? 'duplicate_drawn_cards' : 'invalid_drawn_cards');
      err.statusCode = 400;
      throw err;
    }
    seen.add(id);
  }
}

async function submitTarotReadingWithTables(hash, payload, drawnCards) {
  const invite = await findTarotInviteByCodeHash(hash);
  assertDrawnCardsForInvite(invite, drawnCards);
  const now = Date.now();
  const submission = normalizeTarotSubmission({
    id:crypto.randomUUID(),
    inviteId:invite.id,
    participantName:String(payload.participantName || '').slice(0, 24),
    title:String(payload.title || '').slice(0, 50),
    topic:String(payload.topic || '').slice(0, 24),
    question:String(payload.question || '').slice(0, 400),
    spreadCount:invite.spreadCount,
    spreadType:invite.spreadType,
    drawnCards,
    status:'received',
    createdAt:now,
    updatedAt:now,
    deleteAt:now + 30 * 24 * 60 * 60 * 1000
  });
  const { data, error } = await supabase
    .from('tarot_submissions')
    .insert(tarotSubmissionDbPayload(submission))
    .select('*')
    .single();
  if (error) throw error;
  if (invite.settings.singleUse !== false) {
    const update = await supabase
      .from('tarot_invites')
      .update({ status:'used', used_at:new Date(now).toISOString(), updated_at:new Date(now).toISOString() })
      .eq('id', invite.id);
    if (update.error) throw update.error;
  }
  return normalizeTarotSubmission(data);
}

async function submitTarotReading(payload) {
  const hash = String(payload && payload.codeHash || '').trim().toLowerCase();
  const drawnCards = Array.isArray(payload && payload.drawnCards) ? payload.drawnCards : [];
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    const err = new Error('invalid_invite_code');
    err.statusCode = 400;
    throw err;
  }
  try {
    await deleteExpiredTarotSubmissions();
  } catch (_) {}
  if (supabase) {
    const { data, error } = await supabase.rpc('tarot_submit_reading', {
      p_code_hash:hash,
      p_participant_name:String(payload.participantName || '').slice(0, 24),
      p_title:String(payload.title || '').slice(0, 50),
      p_topic:String(payload.topic || '').slice(0, 24),
      p_question:String(payload.question || '').slice(0, 400),
      p_drawn_cards:drawnCards
    });
    if (error) {
      if (isMissingRpc(error)) return submitTarotReadingWithTables(hash, payload, drawnCards);
      throw error;
    }
    const id = Array.isArray(data) ? data[0] : data;
    const { data:row, error:selectError } = await supabase.from('tarot_submissions').select('*').eq('id', id).single();
    if (selectError) throw selectError;
    return normalizeTarotSubmission(row);
  }

  const invites = await listTarotInvites();
  const invite = invites.find(item => item.codeHash === hash);
  assertDrawnCardsForInvite(invite, drawnCards);
  const now = Date.now();
  const submission = normalizeTarotSubmission({
    id:crypto.randomUUID(),
    inviteId:invite.id,
    participantName:String(payload.participantName || '').slice(0, 24),
    title:String(payload.title || '').slice(0, 50),
    topic:String(payload.topic || '').slice(0, 24),
    question:String(payload.question || '').slice(0, 400),
    spreadCount:invite.spreadCount,
    spreadType:invite.spreadType,
    drawnCards,
    status:'received',
    createdAt:now,
    updatedAt:now,
    deleteAt:now + 30 * 24 * 60 * 60 * 1000
  });
  const submissions = await readJson(TAROT_SUBMISSIONS_FILE, []);
  await writeJson(TAROT_SUBMISSIONS_FILE, [submission, ...(Array.isArray(submissions) ? submissions : [])]);
  if (invite.settings.singleUse !== false) {
    const currentInvites = await readJson(TAROT_INVITES_FILE, []);
    await writeJson(TAROT_INVITES_FILE, (Array.isArray(currentInvites) ? currentInvites : []).map(item => String(item.id) === invite.id ? { ...item, status:'used', usedAt:now, updatedAt:now } : item));
  }
  return submission;
}

module.exports = {
  mode,
  MEDIA_BUCKET,
  ARTIFACT_BUCKET,
  listArtifacts,
  getArtifact,
  createArtifact,
  updateArtifact,
  deleteArtifact,
  incrementView,
  listPages,
  getPage,
  upsertPage,
  listPostInteractions,
  createPostInteraction,
  createSignedUploadUrl,
  getPublicUrl,
  downloadStorageObject,
  getTarotPublicSettings,
  updateTarotPublicSettings,
  listTarotInvites,
  createTarotInvite,
  deleteTarotInvite,
  listTarotSubmissions,
  updateTarotSubmission,
  deleteTarotSubmission,
  deleteExpiredTarotSubmissions,
  validateTarotInvite,
  submitTarotReading,
  systemStatus,
  stripSecrets
};
