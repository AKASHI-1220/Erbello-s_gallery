require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const store = require('./lib/store');
const { isJSX, wrapJSX, normalizeCode } = require('./lib/jsx');

const app = express();
const ZIP_BUNDLE_PREFIX = 'ERBELLO_BUNDLE_V1\n';
const RANDOM_GAMSUNG_COVER = '__GAMSUNG_RANDOM__';

const ADSENSE_CLIENT = process.env.ADSENSE_CLIENT || 'ca-pub-3039189451733887';
const ADSENSE_SCRIPT = ADSENSE_CLIENT
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`
  : '';

function injectAdSense(html) {
  const text = String(html || '');
  if (!ADSENSE_SCRIPT || text.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')) return text;
  if (/<head[^>]*>/i.test(text)) {
    return text.replace(/<head([^>]*)>/i, `<head$1>\n${ADSENSE_SCRIPT}`);
  }
  if (/<html[^>]*>/i.test(text)) {
    return text.replace(/<html([^>]*)>/i, `<html$1>\n<head>${ADSENSE_SCRIPT}</head>`);
  }
  return text;
}

function escHtml(value) {
  return String(value || '').replace(/[<>&]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[c]));
}

function isZipBundle(code) {
  return String(code || '').startsWith(ZIP_BUNDLE_PREFIX);
}

function normalizeZipPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/\.\//g, '/');
}

function guessMime(name) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  return ({
    html:'text/html', htm:'text/html', css:'text/css', js:'text/javascript', mjs:'text/javascript', json:'application/json',
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', svg:'image/svg+xml', ico:'image/x-icon', bmp:'image/bmp', avif:'image/avif',
    woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf', mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', mp4:'video/mp4', webm:'video/webm'
  }[ext]) || 'application/octet-stream';
}

function isExternalAsset(value) {
  return /^(https?:|data:|blob:|mailto:|tel:|javascript:|#)/i.test(String(value || '').trim());
}

function stripQueryHash(value) {
  return String(value || '').split('#')[0].split('?')[0];
}

function joinZipPath(baseDir, url) {
  const clean = stripQueryHash(url).replace(/^\.\//, '');
  if (!clean || clean.startsWith('/')) return normalizeZipPath(clean);
  const parts = `${baseDir || ''}/${clean}`.split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function decodeBundle(code) {
  const raw = String(code || '').slice(ZIP_BUNDLE_PREFIX.length);
  const parsed = JSON.parse(raw);
  const files = new Map();
  for (const file of Array.isArray(parsed.files) ? parsed.files : []) {
    const filePath = normalizeZipPath(file.path);
    if (!filePath || !file.contentBase64) continue;
    files.set(filePath, {
      path: filePath,
      mime: file.mime || guessMime(filePath),
      contentBase64: file.contentBase64
    });
  }
  return { entry: normalizeZipPath(parsed.entry || 'index.html'), files };
}

function findBundleFile(bundle, baseDir, url) {
  if (!url || isExternalAsset(url)) return null;
  const resolved = joinZipPath(baseDir, url);
  if (bundle.files.has(resolved)) return bundle.files.get(resolved);
  const decoded = (() => { try { return decodeURIComponent(resolved); } catch (_) { return resolved; } })();
  if (bundle.files.has(decoded)) return bundle.files.get(decoded);
  const lower = resolved.toLowerCase();
  for (const [key, value] of bundle.files.entries()) {
    if (key.toLowerCase() === lower) return value;
  }
  return null;
}

function fileText(file) {
  return Buffer.from(file.contentBase64, 'base64').toString('utf8');
}

function fileDataUrl(file) {
  return `data:${file.mime || guessMime(file.path)};base64,${file.contentBase64}`;
}

function inlineCssAssets(cssText, bundle, baseDir, cssDir) {
  return String(cssText || '').replace(/url\((?!['"]?data:)(['"]?)([^)'"#?]+(?:[?#][^)'"]*)?)\1\)/gi, (full, _quote, rawUrl) => {
    if (isExternalAsset(rawUrl)) return full;
    const file = findBundleFile(bundle, cssDir || baseDir, rawUrl);
    return file ? `url("${fileDataUrl(file)}")` : full;
  });
}

function renderZipBundle(code) {
  const bundle = decodeBundle(code);
  const entry = bundle.files.get(bundle.entry) || [...bundle.files.values()].find(file => /(^|\/)index\.html?$/i.test(file.path));
  if (!entry) throw new Error('ZIP bundle entry file is missing.');
  const baseDir = entry.path.includes('/') ? entry.path.split('/').slice(0, -1).join('/') : '';
  let html = fileText(entry);

  html = html.replace(/<link\b([^>]*?)\bhref=["']([^"']+)["']([^>]*?)>/gi, (full, before, href, after) => {
    if (!/rel=["'][^"']*stylesheet/i.test(`${before} ${after}`)) return full;
    const file = findBundleFile(bundle, baseDir, href);
    if (!file) return full;
    const cssDir = file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : baseDir;
    const cssText = inlineCssAssets(fileText(file), bundle, baseDir, cssDir);
    return `<style data-erbello-zip="${file.path.replace(/"/g, '&quot;')}">\n${cssText}\n</style>`;
  });

  html = html.replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi, (full, before, src, after) => {
    const file = findBundleFile(bundle, baseDir, src);
    if (!file) return full;
    const scriptText = fileText(file).replace(/<\/script/gi, '<\\/script');
    return `<script${before} ${after} data-erbello-zip="${file.path.replace(/"/g, '&quot;')}">\n${scriptText}\n</script>`;
  });

  html = html.replace(/\b(src|poster)=["']([^"']+)["']/gi, (full, attr, rawUrl) => {
    const file = findBundleFile(bundle, baseDir, rawUrl);
    return file ? `${attr}="${fileDataUrl(file)}"` : full;
  });

  html = html.replace(/\bsrcset=["']([^"']+)["']/gi, (full, value) => {
    const replaced = value.split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      const file = findBundleFile(bundle, baseDir, bits[0]);
      return [file ? fileDataUrl(file) : bits[0], ...bits.slice(1)].join(' ');
    }).join(', ');
    return `srcset="${replaced}"`;
  });

  return html;
}

function renderArtifactHtml(artifact) {
  const code = String(artifact && artifact.code || '');
  if (isZipBundle(code)) return renderZipBundle(code);
  if (artifact && artifact.is_jsx) return wrapJSX(code, { title: artifact.title });
  return code;
}

app.disable('x-powered-by');
app.use(express.json({ limit: process.env.JSON_LIMIT || '30mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiLimit = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const adminLimit = rateLimit({ windowMs: 60_000, max: 40, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimit);
app.use('/api/admin', adminLimit);

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getAdminHash() {
  if (process.env.ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD_HASH.trim()) return process.env.ADMIN_PASSWORD_HASH.trim();
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()) return sha256(process.env.ADMIN_PASSWORD.trim());
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
  if (!expected) return res.status(503).json({ error: 'ADMIN_PASSWORD_HASH or ADMIN_PASSWORD is not configured.' });
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
  const allowed = new Set(['react', 'html', 'chart', 'game', 'tool', 'daily', 'design', 'experiment', 'other']);
  const t = String(value || 'other').trim().toLowerCase();
  return allowed.has(t) ? t : 'other';
}

function cleanTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[\n,#，、]+/);
  const seen = new Set();
  const tags = [];
  for (const item of raw) {
    const tag = String(item || '').replace(/^#+/, '').trim().replace(/\s+/g, ' ').slice(0, 28).replace(/[<>"'`]/g, '');
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 14) break;
  }
  return tags;
}

function cleanSourceKind(value, detectedJsx = false) {
  const allowed = new Set(['html', 'jsx', 'zip', 'other']);
  const kind = String(value || '').trim().toLowerCase();
  if (allowed.has(kind)) return kind;
  return detectedJsx ? 'jsx' : 'html';
}

function cleanSlug(value) {
  const allowed = new Set(['home', 'projects', 'about', 'contact']);
  const slug = String(value || '').trim().toLowerCase();
  return allowed.has(slug) ? slug : null;
}

function cleanLang(value) {
  const allowed = new Set(['ko', 'en', 'ja', 'zh']);
  const lang = String(value || 'ko').trim().toLowerCase();
  return allowed.has(lang) ? lang : null;
}

function cleanPageContent(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const cleanString = (v, max = 1000) => String(v || '').trim().slice(0, max);
  const cleanBlocks = Array.isArray(src.blocks) ? src.blocks.slice(0, 4).map((block) => ({ title: cleanString(block && block.title, 120), text: cleanString(block && block.text, 500) })) : [];
  const cleanLinks = Array.isArray(src.links) ? src.links.slice(0, 12).map((link) => ({ label: cleanString(link && link.label, 80), url: cleanString(link && link.url, 300) })) : [];
  return {
    eyebrow: cleanString(src.eyebrow, 120),
    script: cleanString(src.script, 120),
    title: cleanString(src.title, 200),
    body: cleanString(src.body, 1200),
    infoTitle: cleanString(src.infoTitle, 120),
    email: cleanString(src.email, 200),
    blocks: cleanBlocks,
    links: cleanLinks
  };
}

function cleanDataUrl(value, max = 1200000) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(text)) return '';
  return text.length <= max ? text : '';
}

function cleanCoverImage(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === RANDOM_GAMSUNG_COVER) return text;
  if (/^\/assets\/illust\/gamsung-(?:1|3|4|5|6|7|8|9|10|11|12|13|14|15)\.webp$/i.test(text)) return text;
  return cleanDataUrl(text);
}

function cleanGalleryImages(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw.map(item => cleanDataUrl(item)).filter(Boolean).slice(0, 8);
}

function payloadFromBody(body) {
  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 240);
  const type = cleanType(body.type);
  const code = normalizeCode(body.code);
  const cover_image = cleanCoverImage(body.cover_image);
  const gallery_images = cleanGalleryImages(body.gallery_images);
  const detail_text = cleanText(body.detail_text, 1600);
  const detectedJsx = isJSX(code);
  const source_kind = cleanSourceKind(body.source_kind || body.format, detectedJsx);
  const tags = cleanTags(body.tags);
  return { title, description, type, tags, source_kind, cover_image, gallery_images, detail_text, code, is_jsx: detectedJsx || source_kind === 'jsx' };
}

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, storage: store.mode, adminConfigured: Boolean(getAdminHash()) });
});

app.get('/api/artifacts', async (_req, res) => {
  try {
    const artifacts = await store.listArtifacts();
    res.json(artifacts.map(({ code, ...rest }) => rest));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pages', async (_req, res) => {
  try {
    res.json(await store.listPages());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/pages/:slug/:lang', checkAdmin, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const lang = cleanLang(req.params.lang);
    if (!slug || !lang) return res.status(400).json({ error: 'Invalid page or language.' });
    const content = cleanPageContent(req.body && req.body.content);
    const page = await store.upsertPage(slug, lang, content);
    res.json(page);
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
    const payload = payloadFromBody(req.body || {});
    if (!payload.title || !payload.code) return res.status(400).json({ error: 'title and code are required.' });
    const artifact = await store.createArtifact(payload);
    const { code, ...summary } = artifact;
    res.status(201).json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/artifacts/:id', checkAdmin, async (req, res) => {
  try {
    const payload = payloadFromBody(req.body || {});
    if (!payload.title || !payload.code) return res.status(400).json({ error: 'title and code are required.' });
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

    if (req.query.ownerPreview !== '1') {
      store.incrementView(req.params.id).catch((error) => console.warn('view count failed:', error.message || error));
    }

    const html = renderArtifactHtml(artifact);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(html);
  } catch (error) {
    res.status(500).send(`<!doctype html><html><body><pre>${escHtml(error.message)}</pre></body></html>`);
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
