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
const mode = hasSupabase ? 'supabase' : 'local-json';
const MEDIA_BUCKET = process.env.SUPABASE_MEDIA_BUCKET || 'erbello-media';
const ARTIFACT_BUCKET = process.env.SUPABASE_ARTIFACT_BUCKET || 'erbello-artifacts';
const PROJECT_STATUSES = new Set(['public', 'private', 'draft']);

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
  if (['html', 'jsx', 'zip', 'other'].includes(kind)) return kind;
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


async function systemStatus() {
  const status = {
    mode,
    supabaseConfigured: Boolean(supabase),
    mediaBucket: MEDIA_BUCKET,
    artifactBucket: ARTIFACT_BUCKET,
    artifactsOk: false,
    pagesOk: false,
    mediaBucketOk: false,
    artifactBucketOk: false,
    artifactCount: 0,
    pageCount: 0
  };
  if (!supabase) {
    const items = await readJson(DATA_FILE, []);
    const pages = await readJson(PAGES_FILE, []);
    status.artifactsOk = true;
    status.pagesOk = true;
    status.artifactCount = Array.isArray(items) ? items.length : 0;
    status.pageCount = Array.isArray(pages) ? pages.length : 0;
    return status;
  }
  try {
    const { count, error } = await supabase.from('artifacts').select('id', { count:'exact', head:true });
    if (error) throw error;
    status.artifactsOk = true;
    status.artifactCount = Number(count || 0);
  } catch (error) { status.artifactsError = error.message || String(error); }
  try {
    const { count, error } = await supabase.from('site_pages').select('slug', { count:'exact', head:true });
    if (error) throw error;
    status.pagesOk = true;
    status.pageCount = Number(count || 0);
  } catch (error) { status.pagesError = error.message || String(error); }
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const names = new Set((data || []).map(bucket => bucket.name || bucket.id));
    status.mediaBucketOk = names.has(MEDIA_BUCKET);
    status.artifactBucketOk = names.has(ARTIFACT_BUCKET);
  } catch (error) { status.storageError = error.message || String(error); }
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
  upsertPage,
  createSignedUploadUrl,
  getPublicUrl,
  downloadStorageObject,
  systemStatus,
  stripSecrets
};
