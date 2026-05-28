require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const store = require('./lib/store');
const { isJSX, wrapJSX, normalizeCode } = require('./lib/jsx');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiLimit = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const adminLimit = rateLimit({ windowMs: 60_000, max: 40, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimit);
app.use('/api/admin', adminLimit);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getAdminHash() {
  if (process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD_HASH.trim()) {
    return process.env.ADMIN_PASSWORD_HASH.trim();
  }
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()) {
    return sha256(process.env.ADMIN_PASSWORD.trim());
  }
  return null;
}

function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch (_) {
    return false;
  }
}

function checkAdmin(req, res, next) {
  const expected = getAdminHash();
  if (!expected) {
    return res.status(503).json({ error: 'ADMIN_PASSWORD_HASH or ADMIN_PASSWORD is not configured.' });
  }
  const token = req.headers['x-admin-token'];
  if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Unauthorized' });
  const actual = sha256(token);
  if (!safeEqualHex(actual, expected)) return res.status(401).json({ error: 'Wrong password' });
  next();
}

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function cleanType(value) {
  const allowed = new Set(['react', 'html', 'chart', 'game', 'tool', 'experiment', 'other']);
  const t = String(value || 'other').trim().toLowerCase();
  return allowed.has(t) ? t : 'other';
}

function payloadFromBody(body) {
  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 240);
  const type = cleanType(body.type);
  const code = normalizeCode(body.code);
  return { title, description, type, code, is_jsx: isJSX(code) };
}

app.get('/api/status', async (_req, res) => {
  res.json({
    ok: true,
    storage: store.mode,
    adminConfigured: Boolean(getAdminHash())
  });
});

app.get('/api/artifacts', async (_req, res) => {
  try {
    const artifacts = await store.listArtifacts();
    res.json(artifacts.map(({ code, ...rest }) => rest));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/artifacts/:id', checkAdmin, async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found.' });
    res.json(artifact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/artifacts', checkAdmin, async (req, res) => {
  try {
    const payload = payloadFromBody(req.body);
    if (!payload.title || !payload.code) {
      return res.status(400).json({ error: 'title and code are required.' });
    }
    const artifact = await store.createArtifact(payload);
    const { code, ...summary } = artifact;
    res.status(201).json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/artifacts/:id', checkAdmin, async (req, res) => {
  try {
    const payload = payloadFromBody(req.body);
    if (!payload.title || !payload.code) {
      return res.status(400).json({ error: 'title and code are required.' });
    }
    const artifact = await store.updateArtifact(req.params.id, payload);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found.' });
    const { code, ...summary } = artifact;
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/artifacts/:id', checkAdmin, async (req, res) => {
  try {
    const ok = await store.deleteArtifact(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Artifact not found.' });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/verify', (req, res) => {
  const expected = getAdminHash();
  if (!expected) return res.status(503).json({ ok: false, error: 'Admin password is not configured.' });

  const password = String(req.body.password || '');
  if (!password) return res.status(400).json({ ok: false });

  const actual = sha256(password);
  if (safeEqualHex(actual, expected)) return res.json({ ok: true });
  res.status(401).json({ ok: false });
});

app.get('/run/:id', async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact) {
      return res.status(404).send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title><style>body{margin:0;background:#090909;color:#f4f4f4;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}.box{border:1px solid #2a2a2a;padding:28px;border-radius:18px;background:#111}.k{color:#c7ff4f;font-family:monospace}</style></head><body><div class="box"><div class="k">ERBELLO / 404</div><h1>Artifact not found</h1><p>삭제되었거나 잘못된 링크입니다.</p></div></body></html>`);
    }

    const html = artifact.is_jsx ? wrapJSX(artifact.code, { title: artifact.title }) : artifact.code;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(html);
  } catch (error) {
    res.status(500).send(`<!doctype html><html><body><pre>${String(error.message).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre></body></html>`);
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = Number(process.env.PORT || 3000);
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`ERBELLO gallery running on http://localhost:${PORT}`);
    console.log(`Storage mode: ${store.mode}`);
  });
}

module.exports = app;
