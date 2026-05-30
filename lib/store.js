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

async function ensureJsonFile(file, fallback) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(file);
  } catch (_) {
    await fs.writeFile(file, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

async function readJson(file, fallback) {
  await ensureJsonFile(file, fallback);
  const raw = await fs.readFile(file, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (_) {
    return fallback;
  }
}

async function writeJson(file, value) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

function byCreatedDesc(a, b) {
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}

function normalizeViewCount(item) {
  return { ...item, view_count: Number(item.view_count || 0) };
}

function isMissingColumnOrTable(error) {
  const text = `${error && (error.message || error.details || error.hint || error.code)}`.toLowerCase();
  return text.includes('does not exist') || text.includes('schema cache') || text.includes('column') || text.includes('relation');
}

async function listArtifacts() {
  if (supabase) {
    let query = supabase
      .from('artifacts')
      .select('id, title, description, type, is_jsx, created_at, updated_at, view_count')
      .order('created_at', { ascending: false });
    let { data, error } = await query;

    if (error && isMissingColumnOrTable(error)) {
      const fallback = await supabase
        .from('artifacts')
        .select('id, title, description, type, is_jsx, created_at, updated_at')
        .order('created_at', { ascending: false });
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return (data || []).map(normalizeViewCount);
  }

  const items = await readJson(DATA_FILE, []);
  return (Array.isArray(items) ? items : [])
    .map(({ code, ...rest }) => normalizeViewCount(rest))
    .sort(byCreatedDesc);
}

async function getArtifact(id) {
  if (supabase) {
    const { data, error } = await supabase
      .from('artifacts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? normalizeViewCount(data) : null;
  }

  const items = await readJson(DATA_FILE, []);
  const found = (Array.isArray(items) ? items : []).find(item => String(item.id) === String(id));
  return found ? normalizeViewCount(found) : null;
}

async function createArtifact(payload) {
  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    title: payload.title,
    description: payload.description || '',
    type: payload.type || 'other',
    code: payload.code,
    is_jsx: Boolean(payload.is_jsx),
    view_count: 0,
    created_at: now,
    updated_at: now
  };

  if (supabase) {
    let { data, error } = await supabase
      .from('artifacts')
      .insert({
        title: record.title,
        description: record.description,
        type: record.type,
        code: record.code,
        is_jsx: record.is_jsx,
        view_count: 0
      })
      .select('*')
      .single();

    if (error && isMissingColumnOrTable(error)) {
      const fallback = await supabase
        .from('artifacts')
        .insert({
          title: record.title,
          description: record.description,
          type: record.type,
          code: record.code,
          is_jsx: record.is_jsx
        })
        .select('*')
        .single();
      data = fallback.data;
      error = fallback.error;
    }

    if (error) throw error;
    return normalizeViewCount(data);
  }

  const items = await readJson(DATA_FILE, []);
  const nextItems = Array.isArray(items) ? items : [];
  nextItems.unshift(record);
  await writeJson(DATA_FILE, nextItems);
  return record;
}

async function updateArtifact(id, payload) {
  const patch = {
    title: payload.title,
    description: payload.description || '',
    type: payload.type || 'other',
    code: payload.code,
    is_jsx: Boolean(payload.is_jsx),
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('artifacts')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data ? normalizeViewCount(data) : null;
  }

  const items = await readJson(DATA_FILE, []);
  const nextItems = Array.isArray(items) ? items : [];
  const index = nextItems.findIndex(item => String(item.id) === String(id));
  if (index === -1) return null;
  nextItems[index] = { ...nextItems[index], ...patch };
  await writeJson(DATA_FILE, nextItems);
  return normalizeViewCount(nextItems[index]);
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
      const { data, error } = await supabase
        .from('artifacts')
        .select('view_count')
        .eq('id', id)
        .single();
      if (error) {
        if (isMissingColumnOrTable(error) || error.code === 'PGRST116') return;
        throw error;
      }
      const nextCount = Number(data && data.view_count || 0) + 1;
      const update = await supabase
        .from('artifacts')
        .update({ view_count: nextCount })
        .eq('id', id);
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
      const { data, error } = await supabase
        .from('site_pages')
        .select('slug, lang, content, updated_at')
        .order('slug', { ascending: true });
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
  const row = {
    slug: String(slug),
    lang: String(lang),
    content: content && typeof content === 'object' ? content : {},
    updated_at: new Date().toISOString()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('site_pages')
      .upsert(row, { onConflict: 'slug,lang' })
      .select('slug, lang, content, updated_at')
      .single();
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

module.exports = {
  mode,
  listArtifacts,
  getArtifact,
  createArtifact,
  updateArtifact,
  deleteArtifact,
  incrementView,
  listPages,
  upsertPage
};
