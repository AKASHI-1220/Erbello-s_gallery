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
const mode = hasSupabase ? 'supabase' : 'local-json';

async function ensureLocalFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch (_) {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

async function readLocal() {
  await ensureLocalFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function writeLocal(items) {
  await ensureLocalFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function byCreatedDesc(a, b) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

async function listArtifacts() {
  if (supabase) {
    const { data, error } = await supabase
      .from('artifacts')
      .select('id, title, description, type, is_jsx, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  const items = await readLocal();
  return items.map(({ code, ...rest }) => rest).sort(byCreatedDesc);
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
    return data;
  }
  const items = await readLocal();
  return items.find(item => String(item.id) === String(id)) || null;
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
    created_at: now,
    updated_at: now
  };

  if (supabase) {
    const { data, error } = await supabase
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
    if (error) throw error;
    return data;
  }

  const items = await readLocal();
  items.unshift(record);
  await writeLocal(items);
  return record;
}

async function updateArtifact(id, payload) {
  const now = new Date().toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from('artifacts')
      .update({
        title: payload.title,
        description: payload.description || '',
        type: payload.type || 'other',
        code: payload.code,
        is_jsx: Boolean(payload.is_jsx),
        updated_at: now
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  const items = await readLocal();
  const index = items.findIndex(item => String(item.id) === String(id));
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    title: payload.title,
    description: payload.description || '',
    type: payload.type || 'other',
    code: payload.code,
    is_jsx: Boolean(payload.is_jsx),
    updated_at: now
  };
  await writeLocal(items);
  return items[index];
}

async function deleteArtifact(id) {
  if (supabase) {
    const existing = await getArtifact(id);
    if (!existing) return false;
    const { error } = await supabase.from('artifacts').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  const items = await readLocal();
  const next = items.filter(item => String(item.id) !== String(id));
  if (next.length === items.length) return false;
  await writeLocal(next);
  return true;
}

module.exports = {
  mode,
  listArtifacts,
  getArtifact,
  createArtifact,
  updateArtifact,
  deleteArtifact
};
