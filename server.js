require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const JSZip = require('jszip');
const store = require('./lib/store');
const { isJSX, wrapJSX, normalizeCode } = require('./lib/jsx');
const {
  normalizeAiPostingConfig,
  parseGeneratedPost,
  normalizeGeneratedPost,
  decorateAiPostBody,
  buildGeminiPrompt,
  aiPostBodyLooksShort
} = require('./lib/ai-posting');

const app = express();
app.set('trust proxy', 1);
const ZIP_BUNDLE_PREFIX = 'ERBELLO_BUNDLE_V1\n';
const ZIP_MANIFEST_PREFIX = 'ERBELLO_ZIP_MANIFEST_V2\n';
const STORAGE_SOURCE_PREFIX = 'ERBELLO_STORAGE_SOURCE_V1\n';
const POST_SOURCE_CODE = '__ERBELLO_POST__';
const POST_ATTACH_PREFIX = 'ERBELLO_POST_ATTACHMENTS_V1:';
const POST_WIDGET_PREFIX = 'ERBELLO_POST_WIDGETS_V1:';
const POST_META_PREFIX = 'ERBELLO_POST_META_V1:';
const STORAGE_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;
const RANDOM_GAMSUNG_COVER = '__GAMSUNG_RANDOM__';
const PRIVATE_TOKEN_TTL_MS = 15 * 60 * 1000;
const ADMIN_TOKEN_TTL_MS = Number(process.env.ADMIN_TOKEN_TTL_MS || 6 * 60 * 60 * 1000);
const DEFAULT_SITE_ORIGIN = 'https://erbello.vercel.app';
const AI_POSTING_PAGE_SLUG = 'ai-posting';
const AI_POSTING_FALLBACK_PAGE_SLUGS = ['posts', 'home'];
const ADMIN_ENTRY_CODE = String(process.env.ADMIN_ENTRY_CODE || '1220').trim() || '1220';

const ADSENSE_CLIENT = process.env.ADSENSE_CLIENT || 'ca-pub-3039189451733887';
const ADSENSE_SCRIPT = ADSENSE_CLIENT
  ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`
  : '';
const ADSENSE_PUBLISHER_ID = String(process.env.ADSENSE_PUBLISHER_ID || ADSENSE_CLIENT || 'pub-3039189451733887')
  .replace(/^ca-/, '')
  .trim();
const ADS_TXT_LINE = `google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`;

const interactionLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});

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

function escAttr(value) {
  return String(value || '').replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]));
}

function plainText(value, max = 1000) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safePostInlineAssetUrl(value) {
  const text = String(value || '').trim();
  if (/^\/assets\/illust\/post-assets\/[-\w.]+\.png$/i.test(text)) return text;
  if (/^\/assets\/illust\/imagegen-assets\/web\/(?:[-\w]+\/)*[-\w.]+\.png$/i.test(text)) return text;
  if (/^\/assets\/illust\/[-\w.]+\.(?:png|webp|jpe?g|gif)$/i.test(text)) return text;
  if (/^https:\/\/[^\s"'<>]+$/i.test(text) && text.length <= 1200) return text;
  return '';
}

function isMarkdownTableBlock(value) {
  const lines = String(value || '').trim().split('\n').map(line => line.trim()).filter(Boolean);
  return lines.length >= 2 && lines[0].includes('|') && /^[\s|:-]+$/.test(lines[1]);
}

function renderMarkdownTable(value) {
  const lines = String(value || '').trim().split('\n').map(line => line.trim()).filter(Boolean);
  if (!isMarkdownTableBlock(lines.join('\n'))) return '';
  const rows = lines.filter((_, index) => index !== 1).map(line => line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
  if (!rows.length) return '';
  const head = rows[0] || [];
  const body = rows.slice(1);
  return `<table class="post-body-table"><thead><tr>${head.map(cell => `<th>${escHtml(cell || ' ')}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${head.map((_, index) => `<td>${escHtml(row[index] || ' ')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function safePostColor(value) {
  const text = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : '';
}

function safePostFont(value) {
  const text = String(value || '').toLowerCase().trim();
  return ['round', 'serif', 'mono'].includes(text) ? text : '';
}

function postInlineHtml(value) {
  let html = escHtml(value || '');
  html = html.replace(/\[([^\]\n]+)\]\{color:(#[0-9a-f]{6})\}/gi, (_m, text, color) => `<span class="post-text-color" style="color:${safePostColor(color)}">${text}</span>`);
  html = html.replace(/\[([^\]\n]+)\]\{bg:(#[0-9a-f]{6})\}/gi, (_m, text, color) => `<span class="post-text-bg" style="background-color:${safePostColor(color)}">${text}</span>`);
  html = html.replace(/\[([^\]\n]+)\]\{font:(round|serif|mono)\}/gi, (_m, text, font) => `<span class="post-font-${safePostFont(font)}">${text}</span>`);
  html = html.replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n][^*\n]*?)\*/g, '$1<em>$2</em>');
  return html.replace(/\n/g, '<br>');
}

function renderPostBodyHtml(value) {
  const blocks = String(value || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map(part => part.trim()).filter(Boolean).slice(0, 80);
  if (!blocks.length) return '<p>아직 본문이 없습니다.</p>';
  return blocks.map((block) => {
    const alignMatch = block.match(/^:::align:(left|center|right)\n([\s\S]*?)\n:::$/i);
    if (alignMatch) return `<p class="post-align-${alignMatch[1].toLowerCase()}">${postInlineHtml(alignMatch[2])}</p>`;
    if (/^(?:---|\*\*\*)$/.test(block)) return '<hr class="post-body-divider">';
    if (isMarkdownTableBlock(block)) return renderMarkdownTable(block);
    const imageMatch = block.match(/^!\[([^\]\n]{0,120})\]\(([^)\s]+)\)$/);
    if (imageMatch) {
      const src = safePostInlineAssetUrl(imageMatch[2]);
      if (!src) return '';
      const alt = imageMatch[1] || '';
      const decorative = /\/assets\/illust\//i.test(src) || /\/(?:divider|index)-/i.test(src);
      return `<figure class="post-body-asset${decorative ? ' decorative' : ''}"><img src="${escAttr(src)}" alt="${escAttr(alt)}" loading="lazy"></figure>`;
    }
    return `<p>${postInlineHtml(block)}</p>`;
  }).filter(Boolean).join('');
}

function splitPostAttachments(value) {
  const text = String(value || '').replace(/\r\n/g, '\n');
  const index = text.lastIndexOf(POST_ATTACH_PREFIX);
  if (index < 0) return { body:text.trim(), attachments:[] };
  const body = text.slice(0, index).trim();
  const raw = text.slice(index + POST_ATTACH_PREFIX.length).split(/\n/, 1)[0].trim();
  let attachments = [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    attachments = (Array.isArray(parsed) ? parsed : []).map((item) => ({
      name: cleanFilename(item && item.name || 'attachment'),
      url: String(item && item.url || '').trim().slice(0, 1200),
      mime: cleanMime(item && item.mime || ''),
      size: Number(item && item.size || 0)
    })).filter(item => /^https:\/\//i.test(item.url)).slice(0, 12);
  } catch (_) {
    attachments = [];
  }
  return { body, attachments };
}

function normalizeVisibility(value, fallback = 'private') {
  const text = String(value || '').toLowerCase().trim();
  return text === 'public' ? 'public' : fallback;
}

function normalizePostWidgetConfig(value) {
  const data = value && typeof value === 'object' ? value : {};
  const message = data.message && typeof data.message === 'object' ? data.message : {};
  const poll = data.poll && typeof data.poll === 'object' ? data.poll : {};
  const options = Array.isArray(poll.options) ? poll.options : [];
  const seen = new Set();
  return {
    message:{
      enabled:Boolean(message.enabled),
      visibility:normalizeVisibility(message.visibility, 'private'),
      prompt:String(message.prompt || '').trim().slice(0, 160)
    },
    poll:{
      enabled:Boolean(poll.enabled),
      visibility:normalizeVisibility(poll.visibility, 'private'),
      question:String(poll.question || '').trim().slice(0, 180),
      options:options.map((option, index) => {
        const label = String(option && option.label || option || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        const rawKey = String(option && option.key || label || `option-${index + 1}`).toLowerCase();
        const key = rawKey.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || `option-${index + 1}`;
        return { key, label };
      }).filter(option => {
        if (!option.label || seen.has(option.key)) return false;
        seen.add(option.key);
        return true;
      }).slice(0, 10)
    }
  };
}

function splitPostWidgets(value) {
  const text = String(value || '').replace(/\r\n/g, '\n');
  const index = text.lastIndexOf(POST_WIDGET_PREFIX);
  if (index < 0) return { body:text.trim(), config:normalizePostWidgetConfig({}) };
  const body = text.slice(0, index).trim();
  const raw = text.slice(index + POST_WIDGET_PREFIX.length).split(/\n/, 1)[0].trim();
  let parsed = {};
  try { parsed = JSON.parse(decodeURIComponent(raw)); } catch (_) { parsed = {}; }
  return { body, config:normalizePostWidgetConfig(parsed) };
}

function normalizePostMetaConfig(value) {
  const data = value && typeof value === 'object' ? value : {};
  const scheduled = fmtIsoDate(data.scheduled_at || data.scheduledAt || '');
  const tarotEntryUrl = cleanProjectActionUrl(data.tarot_entry_url || data.tarotEntryUrl || '');
  const tarotButtonLabel = cleanText(data.tarot_button_label || data.tarotButtonLabel || '참여 페이지 열기', 40);
  const tarotNotice = cleanText(data.tarot_notice || data.tarotNotice || '', 500);
  const tarotPublicOnly = data.tarot_public_only === true || data.tarotPublicOnly === true || Boolean(tarotEntryUrl);
  return {
    scheduled_at: scheduled,
    tarot_entry_url: tarotEntryUrl,
    tarot_button_label: tarotButtonLabel,
    tarot_notice: tarotNotice,
    tarot_public_only: tarotPublicOnly
  };
}

function splitPostMeta(value) {
  const text = String(value || '').replace(/\r\n/g, '\n');
  const index = text.lastIndexOf(POST_META_PREFIX);
  if (index < 0) return { body:text.trim(), meta:normalizePostMetaConfig({}) };
  const body = text.slice(0, index).trim();
  const raw = text.slice(index + POST_META_PREFIX.length).split(/\n/, 1)[0].trim();
  let parsed = {};
  try { parsed = JSON.parse(decodeURIComponent(raw)); } catch (_) { parsed = {}; }
  return { body, meta:normalizePostMetaConfig(parsed) };
}

function splitPostContent(value) {
  const metaParts = splitPostMeta(value);
  const widgetParts = splitPostWidgets(metaParts.body);
  const attachmentParts = splitPostAttachments(widgetParts.body);
  return { body:attachmentParts.body, attachments:attachmentParts.attachments, widgets:widgetParts.config, meta:metaParts.meta };
}

function isScheduledFutureArtifact(artifact) {
  if (!artifact) return false;
  const meta = splitPostContent(artifact.detail_text || '').meta || {};
  const time = Date.parse(meta.scheduled_at || '');
  return Number.isFinite(time) && time > Date.now();
}

function pollResults(interactions, options) {
  const counts = new Map((options || []).map(option => [option.key, 0]));
  (interactions || []).filter(item => item.kind === 'vote').forEach((vote) => {
    if (counts.has(vote.option_key)) counts.set(vote.option_key, counts.get(vote.option_key) + 1);
  });
  return (options || []).map(option => ({ ...option, count:counts.get(option.key) || 0 }));
}

function voteFingerprint(req, postId) {
  const clientId = cleanText(req.body && req.body.voter_id, 160);
  const forwarded = cleanText(req.headers && req.headers['x-forwarded-for'], 240).split(',')[0].trim();
  const ip = forwarded || cleanText(req.ip || req.socket && req.socket.remoteAddress, 120);
  const ua = cleanText(req.headers && req.headers['user-agent'], 240);
  const basis = clientId || `${ip}|${ua}`;
  const secret = process.env.PRIVATE_TOKEN_SECRET || getAdminHash() || process.env.ADMIN_PASSWORD || DEFAULT_SITE_ORIGIN;
  return crypto.createHash('sha256').update(`${postId}|${basis}|${secret}`).digest('hex');
}

function fmtMonthKo(value) {
  const d = new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtIsoDate(value) {
  const d = new Date(value || '');
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function cleanProjectActionUrl(value) {
  const text = cleanText(value, 500);
  if (!text) return '';
  if (/^(?:\/(?!\/)|\?|#|https:\/\/)/i.test(text)) return text;
  return '';
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function siteOrigin(req) {
  const env = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  if (env) return env;
  return DEFAULT_SITE_ORIGIN;
}

function absoluteSiteUrl(value, origin = DEFAULT_SITE_ORIGIN) {
  const text = String(value || '').trim();
  if (!text || /^data:/i.test(text)) return `${origin}/assets/illust/erbello-typo5.png`;
  if (/^https?:\/\//i.test(text)) return text;
  try { return new URL(text, origin).href; } catch (_) { return `${origin}/assets/illust/erbello-typo5.png`; }
}

function artifactSummaryText(artifact) {
  const detail = plainText(splitPostContent(artifact.detail_text).body, 4000);
  if (detail) return detail;
  const desc = plainText(artifact.description, 500);
  if (desc) return desc;
  return isPostArtifact(artifact)
    ? 'ERBELLO가 작성한 개인 포스트입니다. 글과 이미지로 정리한 내용을 확인할 수 있습니다.'
    : 'ERBELLO에 보관된 개인 프로젝트입니다. 프로젝트 설명과 실행 페이지를 함께 확인할 수 있습니다.';
}

function artifactDetailBody(artifact) {
  const detail = splitPostContent(artifact && artifact.detail_text || '').body.slice(0, 8000);
  if (detail) return detail;
  const desc = String(artifact && artifact.description || '').trim();
  if (desc) return desc;
  return isPostArtifact(artifact)
    ? 'ERBELLO가 작성한 개인 포스트입니다. 글과 이미지로 정리한 내용을 확인할 수 있습니다.'
    : 'ERBELLO에 보관된 개인 프로젝트입니다. 프로젝트 설명과 실행 페이지를 함께 확인할 수 있습니다.';
}

function isPostArtifact(artifact) {
  return cleanSourceKind(artifact && artifact.source_kind, artifact && artifact.is_jsx) === 'post'
    || String(artifact && artifact.code || '').trim() === POST_SOURCE_CODE;
}

function tagList(artifact) {
  const tags = Array.isArray(artifact.tags) ? artifact.tags.filter(Boolean) : [];
  const type = artifact.type ? [artifact.type] : [];
  return [...new Set([...type, ...tags].map(v => String(v || '').trim()).filter(Boolean))].slice(0, 14);
}

function assetImage(src) {
  const text = String(src || '').trim();
  if (!text || text === '__GAMSUNG_RANDOM__') return '/assets/illust/gamsung-1.webp';
  return text;
}

function allowedAdsenseForIndex(req) {
  if (!ADSENSE_SCRIPT) return false;
  const admin = String(req.query && req.query.admin || '') === '1';
  if (admin) return false;
  const path = String(req.path || '');
  if (path.startsWith('/run') || path.startsWith('/api') || path.startsWith('/asset')) return false;
  return true;
}

function baseHead({ title, description, ads = false, robots = 'index,follow', url = '', image = '', type = 'website' } = {}) {
  const safeTitle = title || '프로젝트 갤러리 · ERBELLO';
  const safeDescription = description || 'ERBELLO라는 활동명으로 만든 개인 프로젝트 갤러리입니다.';
  const canonical = url ? `<link rel="canonical" href="${escAttr(url)}">` : '';
  const ogImage = absoluteSiteUrl(image || '/assets/illust/erbello-typo5.png');
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="${escAttr(robots)}"><meta name="description" content="${escAttr(safeDescription)}"><meta name="google-adsense-account" content="${escAttr(ADSENSE_CLIENT)}"><title>${escHtml(safeTitle)}</title>${canonical}<meta property="og:type" content="${escAttr(type)}"><meta property="og:title" content="${escAttr(safeTitle)}"><meta property="og:description" content="${escAttr(safeDescription)}"><meta property="og:url" content="${escAttr(url || DEFAULT_SITE_ORIGIN)}"><meta property="og:image" content="${escAttr(ogImage)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escAttr(safeTitle)}"><meta name="twitter:description" content="${escAttr(safeDescription)}"><meta name="twitter:image" content="${escAttr(ogImage)}">${ads && ADSENSE_SCRIPT ? `\n${ADSENSE_SCRIPT}` : ''}<link rel="stylesheet" href="/app.css">`;
}

function themeBootstrap() {
  return `<script>(function(){try{var s=localStorage.getItem('erbello-scheme-v11')||'white';var c=localStorage.getItem('erbello-color-v11')||'pixel';if(!/^(black|white)$/.test(s))s='white';if(!/^(crimson|sky|lavender|yellowblue|cream|rose|ocean|aurora|mint|pixel)$/.test(c))c='pixel';document.body.dataset.scheme=s;document.body.dataset.color=c;document.body.dataset.theme=s+'-'+c;}catch(_){}})();</script>`;
}

function indexRouteSeo(req) {
  const pathName = String(req.path || '/').replace(/^\/+|\/+$/g, '').toLowerCase();
  const route = pathName === 'akashi' ? 'akashi' : (['projects', 'posts', 'about', 'contact', 'privacy', 'terms'].includes(pathName) ? pathName : 'home');
  const origin = siteOrigin(req);
  const pathPart = route === 'home' ? '/' : (route === 'akashi' ? '/Akashi' : `/${route}`);
  const map = {
    home: ['프로젝트 갤러리 · ERBELLO', 'ERBELLO라는 활동명으로 만든 개인 프로젝트 갤러리입니다.'],
    akashi: ['Akashi Mode · ERBELLO', '붉은 코트, 금빛 왕관, 체스 피스 무드로 꾸민 ERBELLO 특별 홈 모드입니다.'],
    projects: ['프로젝트 갤러리 · ERBELLO', 'ERBELLO라는 활동명으로 만든 HTML, JSX, ZIP 기반 프로젝트를 둘러볼 수 있는 목록입니다.'],
    posts: ['포스트 아카이브 · ERBELLO', 'ERBELLO가 작성한 작업 기록, 이미지, 파일 메모를 모아둔 포스트 목록입니다.'],
    about: ['소개 · ERBELLO', 'ERBELLO라는 활동명으로 만든 작업물과 프로젝트 갤러리 운영 방식을 안내합니다.'],
    contact: ['연락처 · ERBELLO', 'ERBELLO 프로젝트 문의와 외부 연락처 링크를 확인할 수 있습니다.'],
    privacy: ['개인정보처리방침 · ERBELLO', 'ERBELLO가 사용하는 정보와 광고, 쿠키에 관한 안내입니다.'],
    terms: ['이용약관 · ERBELLO', 'ERBELLO 프로젝트 갤러리 이용에 관한 기본 안내입니다.']
  };
  const [title, description] = map[route] || map.home;
  return {
    title,
    description,
    robots: String(req.query && req.query.admin || '') === '1' ? 'noindex,nofollow' : 'index,follow',
    url: `${origin}${pathPart}`,
    image: route === 'akashi' ? `${origin}/assets/illust/akashi-mode/akashi-hero-banner.webp` : `${origin}/assets/illust/erbello-typo5.png`
  };
}

function applyIndexSeo(html, req) {
  const seo = indexRouteSeo(req);
  const seoTags = [
    `<meta name="description" content="${escAttr(seo.description)}" />`,
    `<meta name="robots" content="${escAttr(seo.robots)}" />`,
    `<link rel="canonical" href="${escAttr(seo.url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escAttr(seo.title)}" />`,
    `<meta property="og:description" content="${escAttr(seo.description)}" />`,
    `<meta property="og:url" content="${escAttr(seo.url)}" />`,
    `<meta property="og:image" content="${escAttr(seo.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(seo.title)}" />`,
    `<meta name="twitter:description" content="${escAttr(seo.description)}" />`,
    `<meta name="twitter:image" content="${escAttr(seo.image)}" />`
  ].join('\n  ');
  let next = String(html || '').replace(/<title>[\s\S]*?<\/title>/i, `<title>${escHtml(seo.title)}</title>`);
  next = next.replace(/\n?\s*<link rel="canonical"[^>]*>/gi, '');
  next = next.replace(/\n?\s*<meta name="robots"[^>]*>/gi, '');
  next = next.replace(/\n?\s*<meta property="og:[^"]+"[^>]*>/gi, '');
  next = next.replace(/\n?\s*<meta name="twitter:[^"]+"[^>]*>/gi, '');
  if (/<meta name="description"[^>]*>/i.test(next)) {
    return next.replace(/<meta name="description"[^>]*>/i, seoTags);
  }
  return next.replace(/<head[^>]*>/i, (match) => `${match}\n  ${seoTags}`);
}

function renderIndexPage(req) {
  const fs = require('fs');
  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  if (!allowedAdsenseForIndex(req)) {
    html = html.replace(/\n?\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=[^"\n]+" crossorigin="anonymous"><\/script>/i, '');
  }
  return applyIndexSeo(html, req);
}

function isZipBundle(code) {
  return String(code || '').startsWith(ZIP_BUNDLE_PREFIX);
}

function isZipManifest(code) {
  return String(code || '').startsWith(ZIP_MANIFEST_PREFIX);
}

function decodeZipManifest(code) {
  if (!isZipManifest(code)) return null;
  const parsed = JSON.parse(String(code || '').slice(ZIP_MANIFEST_PREFIX.length));
  const files = new Map();
  for (const file of Array.isArray(parsed.files) ? parsed.files : []) {
    const filePath = normalizeZipPath(file.path);
    const storagePath = cleanStoragePath(file.storage_path || file.storagePath);
    if (!filePath || !storagePath) continue;
    files.set(filePath, {
      path: filePath,
      storagePath,
      mime: cleanMime(file.mime) || guessMime(filePath),
      size: Number(file.size || 0)
    });
  }
  return {
    version: 2,
    entry: normalizeZipPath(parsed.entry || 'index.html'),
    root: normalizeZipPath(parsed.root || ''),
    originalName: cleanFilename(parsed.originalName || parsed.original_name || ''),
    files
  };
}

function decodeStorageSource(code) {
  if (!String(code || '').startsWith(STORAGE_SOURCE_PREFIX)) return null;
  const parsed = JSON.parse(String(code || '').slice(STORAGE_SOURCE_PREFIX.length));
  const objectPath = cleanStoragePath(parsed.path || parsed.storage_path);
  if (!objectPath) return null;
  return {
    bucket: cleanStorageBucket(parsed.bucket, store.ARTIFACT_BUCKET),
    path: objectPath,
    mime: cleanMime(parsed.mime) || 'application/octet-stream',
    filename: cleanFilename(parsed.filename || ''),
    sourceKind: cleanSourceKind(parsed.source_kind || parsed.sourceKind || 'html', false)
  };
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


function zipEntry(zip, filePath) {
  const normalized = normalizeZipPath(filePath);
  if (zip.files[normalized] && !zip.files[normalized].dir) return zip.files[normalized];
  const lower = normalized.toLowerCase();
  return Object.values(zip.files).find(entry => !entry.dir && normalizeZipPath(entry.name).toLowerCase() === lower) || null;
}

function zipEntryExists(zip, filePath) {
  return Boolean(zipEntry(zip, filePath));
}

function findZipIndex(zip) {
  const entries = Object.values(zip.files).filter(entry => !entry.dir && !/^__MACOSX\//i.test(entry.name) && !/(^|\/)\.DS_Store$/i.test(entry.name));
  return entries.find(entry => /(^|\/)index\.html?$/i.test(entry.name)) || entries.find(entry => /\.html?$/i.test(entry.name));
}

function encodedAssetUrl(id, filePath, access = '') {
  const parts = normalizeZipPath(filePath).split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const qs = access ? `?access=${encodeURIComponent(access)}` : '';
  return `/asset/${encodeURIComponent(String(id))}/${parts}${qs}`;
}

function assetRefParts(rawUrl) {
  const text = String(rawUrl || '').trim();
  if (!text || isExternalAsset(text)) return null;
  const match = text.match(/^([^?#]*)([?#].*)?$/);
  const assetPath = match ? match[1] : text;
  if (!assetPath || assetPath.startsWith('#')) return null;
  return { path: assetPath, suffix: match && match[2] ? match[2] : '' };
}

function findManifestFile(manifest, baseDir, rawUrl) {
  const ref = assetRefParts(rawUrl);
  if (!manifest || !ref) return null;
  const resolved = joinZipPath(baseDir, ref.path);
  if (manifest.files.has(resolved)) return { file: manifest.files.get(resolved), suffix: ref.suffix };
  const decoded = (() => { try { return decodeURIComponent(resolved); } catch (_) { return resolved; } })();
  if (manifest.files.has(decoded)) return { file: manifest.files.get(decoded), suffix: ref.suffix };
  const lower = resolved.toLowerCase();
  for (const [key, value] of manifest.files.entries()) {
    if (key.toLowerCase() === lower) return { file: value, suffix: ref.suffix };
  }
  return null;
}

function encodedManifestAssetUrl(id, filePath, access = '', suffix = '') {
  const base = encodedAssetUrl(id, filePath, access);
  if (!suffix || suffix[0] === '#') return `${base}${suffix || ''}`;
  const clean = suffix.replace(/^\?/, '');
  return `${base}${base.includes('?') ? '&' : '?'}${clean}`;
}

function rewriteHtmlManifestUrls(html, manifest, artifactId, baseDir, access = '') {
  return String(html || '')
    .replace(/\b(src|href|poster|data)=(["'])([^"']+)\2/gi, (full, attr, quote, rawUrl) => {
      const match = findManifestFile(manifest, baseDir, rawUrl);
      return match ? `${attr}=${quote}${encodedManifestAssetUrl(artifactId, match.file.path, access, match.suffix)}${quote}` : full;
    })
    .replace(/\bsrcset=(["'])([^"']+)\1/gi, (full, quote, value) => {
      const replaced = String(value).split(',').map((part) => {
        const bits = part.trim().split(/\s+/);
        const match = findManifestFile(manifest, baseDir, bits[0]);
        if (!match) return part.trim();
        return [encodedManifestAssetUrl(artifactId, match.file.path, access, match.suffix), ...bits.slice(1)].join(' ');
      }).join(', ');
      return `srcset=${quote}${replaced}${quote}`;
    });
}

function rewriteCssManifestUrls(css, manifest, artifactId, cssDir, access = '') {
  return String(css || '').replace(/url\((?!['"]?(?:data:|https?:|blob:|#))(['"]?)([^)'"#?]+(?:[?#][^)'"]*)?)\1\)/gi, (full, quote, rawUrl) => {
    const match = findManifestFile(manifest, cssDir, rawUrl);
    return match ? `url(${quote || '"'}${encodedManifestAssetUrl(artifactId, match.file.path, access, match.suffix)}${quote || '"'})` : full;
  });
}

function rewriteHtmlZipUrls(html, zip, artifactId, baseDir, access = '') {
  return String(html || '')
    .replace(/\b(src|href|poster|data)=(["'])([^"']+)\2/gi, (full, attr, quote, rawUrl) => {
      if (!rawUrl || isExternalAsset(rawUrl)) return full;
      const resolved = joinZipPath(baseDir, rawUrl);
      return zipEntryExists(zip, resolved) ? `${attr}=${quote}${encodedAssetUrl(artifactId, resolved, access)}${quote}` : full;
    })
    .replace(/\bsrcset=(["'])([^"']+)\1/gi, (full, quote, value) => {
      const replaced = String(value).split(',').map((part) => {
        const bits = part.trim().split(/\s+/);
        if (!bits[0] || isExternalAsset(bits[0])) return part.trim();
        const resolved = joinZipPath(baseDir, bits[0]);
        if (!zipEntryExists(zip, resolved)) return part.trim();
        return [encodedAssetUrl(artifactId, resolved, access), ...bits.slice(1)].join(' ');
      }).join(', ');
      return `srcset=${quote}${replaced}${quote}`;
    });
}

function rewriteCssZipUrls(css, zip, artifactId, cssDir, access = '') {
  return String(css || '').replace(/url\((?!['"]?(?:data:|https?:|blob:|#))(['"]?)([^)'"#?]+(?:[?#][^)'"]*)?)\1\)/gi, (full, quote, rawUrl) => {
    const resolved = joinZipPath(cssDir, rawUrl);
    return zipEntryExists(zip, resolved) ? `url(${quote || '"'}${encodedAssetUrl(artifactId, resolved, access)}${quote || '"'})` : full;
  });
}

async function loadStorageSource(artifact) {
  const bucket = artifact.code_storage_bucket || store.ARTIFACT_BUCKET;
  const objectPath = artifact.code_storage_path;
  if (!objectPath) return null;
  return store.downloadStorageObject(bucket, objectPath);
}

async function renderStoredZipHtml(artifact, access = '') {
  const buffer = await loadStorageSource(artifact);
  if (!buffer) throw new Error('Stored ZIP source is missing.');
  const zip = await JSZip.loadAsync(buffer);
  const entry = findZipIndex(zip);
  if (!entry) throw new Error('ZIP 안에서 index.html을 찾지 못했습니다.');
  const entryPath = normalizeZipPath(entry.name);
  const baseDir = entryPath.includes('/') ? entryPath.split('/').slice(0, -1).join('/') : '';
  const html = await entry.async('string');
  return rewriteHtmlZipUrls(html, zip, artifact.id, baseDir, access);
}

async function renderStoredManifestHtml(artifact, manifest, access = '') {
  const entry = manifest && (manifest.files.get(manifest.entry) || [...manifest.files.values()].find(file => /(^|\/)index\.html?$/i.test(file.path)));
  if (!entry) throw new Error('ZIP manifest entry file is missing.');
  const buffer = await store.downloadStorageObject(artifact.code_storage_bucket || store.ARTIFACT_BUCKET, entry.storagePath);
  const entryPath = normalizeZipPath(entry.path);
  const baseDir = entryPath.includes('/') ? entryPath.split('/').slice(0, -1).join('/') : '';
  return rewriteHtmlManifestUrls(buffer.toString('utf8'), manifest, artifact.id, baseDir, access);
}

async function renderArtifactHtml(artifact, options = {}) {
  const manifest = decodeZipManifest(artifact && artifact.code);
  if (manifest) return renderStoredManifestHtml(artifact, manifest, options.access || '');

  const storageSource = decodeStorageSource(artifact && artifact.code);
  if (storageSource) {
    const buffer = await store.downloadStorageObject(storageSource.bucket, storageSource.path);
    const code = buffer ? buffer.toString('utf8') : '';
    const kind = cleanSourceKind(storageSource.sourceKind || artifact.source_kind, artifact.is_jsx);
    return (artifact.is_jsx || kind === 'jsx') ? wrapJSX(code, { title: artifact.title }) : code;
  }

  if (artifact && artifact.code_storage_path) {
    const kind = cleanSourceKind(artifact.source_kind, artifact.is_jsx);
    if (kind === 'zip' || /zip/i.test(artifact.code_storage_mime || '') || /\.zip$/i.test(artifact.source_filename || '')) {
      return renderStoredZipHtml(artifact, options.access || '');
    }
    const buffer = await loadStorageSource(artifact);
    const code = buffer ? buffer.toString('utf8') : '';
    if (artifact.is_jsx || kind === 'jsx') return wrapJSX(code, { title: artifact.title });
    return code;
  }

  const code = String(artifact && artifact.code || '');
  if (isZipBundle(code)) return renderZipBundle(code);
  if (artifact && artifact.is_jsx) return wrapJSX(code, { title: artifact.title });
  return code;
}

app.disable('x-powered-by');
app.use(express.json({ limit: process.env.JSON_LIMIT || '30mb' }));
app.get('/vendor/jszip.min.js', (_req, res) => {
  try {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(require.resolve('jszip/dist/jszip.min.js'));
  } catch (_) {
    res.status(404).send('Not found');
  }
});
app.get('/index.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderIndexPage(req));
});
app.get('/tarot-entry/admin-config.js', (_req, res) => {
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__ARCANA_ADMIN_ENTRY_CODE__=${JSON.stringify(ADMIN_ENTRY_CODE)};`);
});
app.get(['/tarot-entry', '/tarot-entry/'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tarot-entry', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

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

function safeEqualText(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch (_) {
    return false;
  }
}

function adminTokenSecret() {
  return process.env.ADMIN_TOKEN_SECRET || getAdminHash() || process.env.ADMIN_PASSWORD || 'erbello-admin-token-secret';
}

function signAdminAccess() {
  const payload = Buffer.from(JSON.stringify({ scope:'admin', exp:Date.now() + ADMIN_TOKEN_TTL_MS }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', adminTokenSecret()).update(payload).digest('base64url');
  return `admin.${payload}.${sig}`;
}

function verifyAdminAccessToken(token) {
  const raw = String(token || '');
  const expected = getAdminHash();
  if (!expected || !raw) return false;
  if (safeEqualHex(sha256(raw), expected)) return true;
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'admin') return false;
  const [, payload, sig] = parts;
  const actual = crypto.createHmac('sha256', adminTokenSecret()).update(payload).digest('base64url');
  if (!safeEqualText(sig, actual)) return false;
  let parsed = null;
  try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (_) { return false; }
  return parsed && parsed.scope === 'admin' && Number(parsed.exp || 0) > Date.now();
}

function isAdminRequest(req) {
  const token = req && req.headers && req.headers['x-admin-token'];
  if (!token || typeof token !== 'string') return false;
  return verifyAdminAccessToken(token);
}

function hashPrivatePassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const text = String(password || '');
  const hash = crypto.pbkdf2Sync(text, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPrivatePassword(password, artifact) {
  if (!artifact || !artifact.is_private) return true;
  if (!artifact.private_password_hash || !artifact.private_password_salt) return false;
  const { hash } = hashPrivatePassword(password, artifact.private_password_salt);
  return safeEqualHex(hash, artifact.private_password_hash);
}

function privateTokenSecret() {
  return process.env.PRIVATE_TOKEN_SECRET || getAdminHash() || process.env.ADMIN_PASSWORD || 'erbello-private-token-secret';
}

function signPrivateAccess(artifact) {
  const payload = Buffer.from(JSON.stringify({ id:String(artifact.id), exp:Date.now() + PRIVATE_TOKEN_TTL_MS }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', privateTokenSecret()).update(`${payload}.${artifact.private_password_hash || ''}`).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyPrivateAccessToken(token, artifact) {
  const raw = String(token || '');
  const parts = raw.split('.');
  if (parts.length !== 2 || !artifact) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', privateTokenSecret()).update(`${payload}.${artifact.private_password_hash || ''}`).digest('base64url');
  if (!sig || sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  let parsed = null;
  try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (_) { return false; }
  return parsed && String(parsed.id) === String(artifact.id) && Number(parsed.exp || 0) > Date.now();
}

function isDraftArtifact(artifact) { return String(artifact && artifact.status || '').toLowerCase() === 'draft'; }

function stripPrivateSecrets(artifact) {
  if (!artifact || typeof artifact !== 'object') return artifact;
  const { private_password_hash, private_password_salt, ...safe } = artifact;
  return safe;
}

function publicArtifactSummary(artifact) {
  const safe = stripPrivateSecrets(artifact);
  if (!safe || !safe.is_private) return safe;
  return {
    id: safe.id,
    title: safe.title || 'Untitled project',
    status: 'private',
    is_private: true,
    source_kind: isPostArtifact(safe) ? 'post' : cleanSourceKind(safe.source_kind, safe.is_jsx)
  };
}

function renderPrivateLockPage(artifact) {
  const title = artifact && artifact.title || 'Untitled project';
  const id = escHtml(artifact && artifact.id || '');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escHtml(title)} · Locked</title><style>${require('fs').readFileSync(path.join(__dirname, 'public', 'app.css'), 'utf8').match(/\/\* v16 private project locks \*\/[\s\S]*$/)?.[0] || ''}</style></head><body class="lock-page"><main class="lock-box"><div class="lock-kicker">ERBELLO / LOCKED</div><h1>${escHtml(title)}</h1><p>이 프로젝트는 비밀번호 확인 후에만 열 수 있습니다.</p><form id="lockForm" class="lock-form"><input id="lockPassword" type="password" placeholder="비밀번호" autocomplete="current-password" autofocus /><button type="submit">열기</button><div id="lockError" class="lock-error"></div></form><a class="lock-home" href="/">ERBELLO로 돌아가기</a></main><script>const form=document.getElementById('lockForm');form.addEventListener('submit',async(e)=>{e.preventDefault();const error=document.getElementById('lockError');error.textContent='';try{const r=await fetch('/api/artifacts/${id}/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('lockPassword').value})});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'비밀번호가 맞지 않습니다.');location.href='/run/${id}?access='+encodeURIComponent(data.access);}catch(err){error.textContent=err.message||'비밀번호가 맞지 않습니다.';}});</script></body></html>`;
}


function renderProjectDetailPage(req, artifact) {
  const title = artifact.title || 'Untitled project';
  const isPost = isPostArtifact(artifact);
  const desc = artifact.description || (isPost ? 'ERBELLO가 작성한 포스트입니다.' : 'ERBELLO에 보관된 프로젝트입니다.');
  const detailContentData = splitPostContent(artifact.detail_text || '');
  const detailMeta = detailContentData.meta || {};
  const postContentData = isPost ? detailContentData : { attachments:[], widgets:normalizePostWidgetConfig({}), meta:detailMeta };
  const postAttachmentData = postContentData.attachments || [];
  const summary = artifactDetailBody(artifact);
  const summaryPlain = plainText(summary || desc, 5000);
  const tags = tagList(artifact);
  const origin = siteOrigin(req);
  const projectUrl = `${origin}/project/${encodeURIComponent(String(artifact.id))}`;
  const runUrl = `${origin}/run/${encodeURIComponent(String(artifact.id))}`;
  const cover = assetImage(artifact.cover_image);
  const gallery = [cover, ...(Array.isArray(artifact.gallery_images) ? artifact.gallery_images : [])].filter(Boolean).slice(0, 8);
  const updated = fmtMonthKo(artifact.updated_at || artifact.created_at);
  const category = artifact.type || 'other';
  const format = isPost ? 'POST' : cleanSourceKind(artifact.source_kind, artifact.is_jsx).toUpperCase();
  const tarotEntryUrl = !isPost && detailMeta.tarot_public_only ? cleanProjectActionUrl(detailMeta.tarot_entry_url) : '';
  const tarotButtonLabel = cleanText(detailMeta.tarot_button_label, 40) || '참여 페이지 열기';
  const tarotNotice = cleanText(detailMeta.tarot_notice, 500);
  const structured = {
    '@context':'https://schema.org',
    '@type':'CreativeWork',
    name:title,
    description:plainText(summaryPlain || desc, 500),
    url:projectUrl,
    dateModified:artifact.updated_at || artifact.created_at || undefined,
    keywords:tags.join(', '),
    image:gallery[0] && !gallery[0].startsWith('data:') ? new URL(gallery[0], origin).href : undefined
  };
  const tagHtml = tags.map(tag => `<span>${escHtml(tag)}</span>`).join('');
  const galleryHtml = gallery.length ? `<div class="detail-gallery">${gallery.map(src => `<img src="${escAttr(src)}" alt="" loading="lazy">`).join('')}</div>` : '';
  const attachmentHtml = postAttachmentData.length
    ? `<section class="detail-panel detail-attachments-panel"><p class="section-kicker">FILES</p><h2>첨부 파일</h2><div class="detail-attachments">${postAttachmentData.map(file => `<a class="detail-attachment" href="${escAttr(file.url)}" target="_blank" rel="noopener noreferrer"><strong>${escHtml(file.name || 'attachment')}</strong><small>${escHtml(file.mime || 'file')}${file.size ? ` · ${escHtml(formatBytes(file.size))}` : ''}</small><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`
    : '';
  const detailLength = summaryPlain.length;
  const allowDetailAds = detailLength >= 500;
  const metaHtml = `<dl class="detail-meta"><div><dt>대표 분류</dt><dd>${escHtml(category)}</dd></div><div><dt>형식</dt><dd>${escHtml(format)}</dd></div>${updated ? `<div><dt>년월</dt><dd>${escHtml(updated)}</dd></div>` : ''}</dl>`;
  const primaryAction = isPost ? '' : (tarotEntryUrl
    ? `<a class="btn primary" href="${escAttr(tarotEntryUrl)}">${escHtml(tarotButtonLabel)}</a>`
    : `<a class="btn primary" href="${escAttr(runUrl)}">프로젝트 실행하기</a>`);
  const listUrl = isPost ? '/posts' : '/projects';
  const listLabel = isPost ? '포스트 목록' : '목록으로';
  const bodyHtml = isPost ? renderPostBodyHtml(summary) : summary.split(/\n{2,}/).map(p => `<p>${escHtml(p)}</p>`).join('');
  const guide = tarotEntryUrl
    ? `<section class="detail-panel detail-guide"><p class="section-kicker">TAROT ENTRY</p><h2>리딩 접수 안내</h2><ul><li>${escHtml(tarotNotice || '참여코드를 받은 분만 접수할 수 있습니다.')}</li><li>이 프로젝트 상세 페이지에서는 카드 뽑기 기능을 열지 않습니다.</li><li>타로 리딩은 자기 이해와 선택을 돕는 참고용 콘텐츠입니다.</li></ul></section>`
    : isPost
    ? `<section class="detail-panel detail-guide"><p class="section-kicker">POST NOTE</p><h2>포스트 안내</h2><ul><li>이 글은 코드 실행 화면이 없는 이미지, 글, 파일 중심의 포스트입니다.</li><li>첨부 이미지가 있는 경우 글 아래 이미지 자료 영역에서 확인할 수 있습니다.</li><li>첨부 파일이 있는 경우 별도 링크로 열 수 있습니다.</li></ul></section>`
    : `<section class="detail-panel detail-guide"><p class="section-kicker">HOW TO VIEW</p><h2>이용 안내</h2><ul><li>프로젝트 실행 버튼을 누르면 실제 HTML/JSX 페이지가 열립니다.</li><li>모바일과 PC에서 보이는 방식이 다를 수 있습니다.</li><li>비밀번호가 필요한 프로젝트는 제목 외 내용이 보호됩니다.</li></ul></section>`;
  return `<!doctype html><html lang="ko"><head>${baseHead({ title:`${title} · ERBELLO`, description:plainText(summaryPlain || desc, 160), ads:allowDetailAds, url:projectUrl, image:cover, type:'article' })}<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script></head><body data-scheme="white" data-color="pixel" data-theme="white-pixel" class="detail-document">${themeBootstrap()}<div class="site-bg" aria-hidden="true"><span class="grid-glow glow-a"></span><span class="grid-glow glow-b"></span></div><main class="detail-shell"><a class="detail-brand" href="/"><img src="/assets/illust/erbello-typo5.png" alt="ERBELLO"><span>Project Gallery</span></a><section class="detail-hero"><div><p class="detail-kicker">${isPost ? 'POST DETAIL' : 'PROJECT DETAIL'}</p><h1>${escHtml(title)}</h1><p class="detail-desc">${escHtml(desc)}</p>${metaHtml}<div class="detail-tags">${tagHtml}</div><div class="detail-actions">${primaryAction}<a class="btn" href="${escAttr(listUrl)}">${escHtml(listLabel)}</a></div></div><aside class="detail-cover detail-cover-note"><span class="detail-cover-sticker">✦</span><strong>${escHtml(isPost ? 'POST' : category)}</strong><small>${updated ? escHtml(updated) : 'ERBELLO'}</small></aside></section><section class="detail-panel"><p class="section-kicker">${isPost ? 'POST BODY' : 'ABOUT THIS PROJECT'}</p><h2>${isPost ? '포스트 본문' : '프로젝트 소개'}</h2><div class="detail-text ${isPost ? 'post-rich-body' : ''}">${bodyHtml}</div></section>${galleryHtml ? `<section class="detail-panel detail-gallery-panel"><p class="section-kicker">GALLERY</p><h2>이미지 자료</h2>${galleryHtml}</section>` : ''}${attachmentHtml}${guide}<footer class="detail-footer"><span>© ERBELLO</span><a href="/privacy">개인정보처리방침</a><a href="/terms">이용약관</a></footer></main></body></html>`;
}

function renderPrivateProjectDetailPage(req, artifact) {
  const title = artifact && artifact.title || 'Untitled project';
  const isPost = isPostArtifact(artifact);
  const runUrl = `/run/${encodeURIComponent(String(artifact.id))}`;
  const listUrl = isPost ? '/posts' : '/projects';
  const listLabel = isPost ? '포스트 목록' : '프로젝트 목록';
  const action = isPost ? '' : `<a class="btn primary" href="${escAttr(runUrl)}">비밀번호 입력 후 실행</a>`;
  return `<!doctype html><html lang="ko"><head>${baseHead({ title:`${title} · Locked`, description:`비밀번호가 필요한 ERBELLO ${isPost ? '포스트' : '프로젝트'}입니다.`, ads:false, robots:'noindex,nofollow' })}</head><body data-scheme="white" data-color="pixel" class="detail-document">${themeBootstrap()}<main class="detail-shell"><a class="detail-brand" href="/"><img src="/assets/illust/erbello-typo5.png" alt="ERBELLO"><span>Project Gallery</span></a><section class="detail-panel locked-detail"><p class="detail-kicker">ERBELLO / LOCKED</p><h1>${escHtml(title)}</h1><div class="locked-blind" aria-hidden="true"><span></span><span></span><span></span></div><p>이 ${isPost ? '포스트' : '프로젝트'}는 비밀번호 확인 전까지 제목 외 내용이 보호됩니다.</p><div class="detail-actions">${action}<a class="btn" href="${escAttr(listUrl)}">${escHtml(listLabel)}</a></div></section></main></body></html>`;
}

async function renderPolicyPage(req, kind = 'privacy') {
  const isTerms = kind === 'terms';
  const fallbackTitle = isTerms ? '이용약관' : '개인정보처리방침';
  const fallbackSubtitle = isTerms ? 'ERBELLO 이용에 관한 기본 안내입니다.' : 'ERBELLO가 사용하는 정보와 광고/쿠키에 관한 안내입니다.';
  const fallbackCards = isTerms ? [
    ['개인 프로젝트 갤러리', 'ERBELLO는 HTML, JSX, ZIP 기반의 개인 프로젝트를 정리하고 공유하기 위한 갤러리입니다.'],
    ['콘텐츠 이용', '등록된 프로젝트의 저작권과 책임은 각 프로젝트 작성자에게 있으며, 무단 복제나 재배포는 권장하지 않습니다.'],
    ['서비스 변경', '사이트 구조, 프로젝트, 링크, 기능은 운영 상황에 따라 수정되거나 삭제될 수 있습니다.']
  ] : [
    ['수집하는 정보', '프로젝트 조회수, 기본 접속 기록, 연락처 링크 이용처럼 사이트 운영에 필요한 최소 정보가 사용될 수 있습니다.'],
    ['광고와 쿠키', 'Google AdSense가 광고 제공, 빈도 제한, 통계 측정을 위해 쿠키나 유사 기술을 사용할 수 있습니다.'],
    ['문의', '개인정보나 사이트 이용 관련 문의는 연락처 페이지에 등록된 링크를 통해 보낼 수 있습니다.']
  ];
  let content = null;
  try {
    const page = await store.getPage(kind, 'ko');
    content = page && page.content && typeof page.content === 'object' ? page.content : null;
  } catch (_) {
    content = null;
  }
  const title = cleanText(content && content.title, 200) || fallbackTitle;
  const subtitle = cleanText(content && content.body, 1200) || fallbackSubtitle;
  const eyebrow = cleanText(content && content.eyebrow, 120) || 'ERBELLO POLICY';
  const blocks = Array.isArray(content && content.blocks) && content.blocks.length
    ? content.blocks.map(block => [cleanText(block && block.title, 120), cleanText(block && block.text, 500)]).filter(([h, p]) => h || p)
    : fallbackCards;
  const origin = siteOrigin(req);
  const url = `${origin}/${isTerms ? 'terms' : 'privacy'}`;
  const isAdmin = String(req.query && req.query.admin || '') === '1';
  return `<!doctype html><html lang="ko"><head>${baseHead({ title:`${title} · ERBELLO`, description:plainText(subtitle, 160), ads:!isAdmin, robots:isAdmin ? 'noindex,nofollow' : 'index,follow', url })}</head><body data-scheme="white" data-color="pixel" class="detail-document">${themeBootstrap()}<main class="detail-shell"><a class="detail-brand" href="/"><img src="/assets/illust/erbello-typo5.png" alt="ERBELLO"><span>Project Gallery</span></a><section class="detail-panel"><p class="detail-kicker">${escHtml(eyebrow)}</p><h1>${escHtml(title)}</h1><p class="detail-desc">${escHtml(subtitle)}</p></section><section class="detail-policy-grid">${blocks.map(([h,p]) => `<article class="page-panel page-mini-card"><span class="page-mini-icon" aria-hidden="true">▣</span><h2>${escHtml(h)}</h2><p>${escHtml(p)}</p></article>`).join('')}</section><footer class="detail-footer"><span>© ERBELLO</span><a href="/">홈</a><a href="/contact">연락처</a></footer></main></body></html>`;
}

function checkAdmin(req, res, next) {
  const expected = getAdminHash();
  if (!expected) return res.status(503).json({ error: 'ADMIN_PASSWORD_HASH or ADMIN_PASSWORD is not configured.' });
  const token = req.headers['x-admin-token'];
  if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Unauthorized' });
  if (!verifyAdminAccessToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function cleanText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

const TAROT_SPREADS = {
  1:[
    { id:'one', label:'한 장 리딩', positions:['핵심'] },
    { id:'today', label:'오늘의 흐름', positions:['오늘의 흐름'] },
    { id:'advice', label:'질문 조언', positions:['조언'] },
    { id:'symbol', label:'상징 한 장', positions:['상징'] }
  ],
  3:[
    { id:'flow', label:'현재 / 흐름 / 조언', positions:['현재','흐름','조언'] },
    { id:'past', label:'과거 / 현재 / 미래', positions:['과거','현재','미래'] },
    { id:'relationship', label:'나 / 상대 / 관계', positions:['나','상대','관계'] },
    { id:'character3', label:'겉모습 / 속마음 / 다음 장면', positions:['겉모습','속마음','다음 장면'] },
    { id:'favorite3', label:'끌리는 이유 / 지금 마음 / 조언', positions:['끌리는 이유','지금 마음','조언'] }
  ],
  5:[
    { id:'situation', label:'상황 / 원인 / 흐름 / 조언 / 결과', positions:['상황','원인','흐름','조언','결과'] },
    { id:'relation5', label:'나 / 상대 / 문제 / 가능성 / 조언', positions:['나','상대','문제','가능성','조언'] },
    { id:'character5', label:'현재 서사 / 상처 / 욕망 / 변수 / 다음 장면', positions:['현재 서사','상처','욕망','변수','다음 장면'] },
    { id:'favorite5', label:'이미지 / 내 마음 / 기대 / 불안 / 조언', positions:['이미지','내 마음','기대','불안','조언'] },
    { id:'dream5', label:'나의 역할 / 대상 / 관계 온도 / 갈등 / 다음 장면', positions:['나의 역할','대상','관계 온도','갈등','다음 장면'] }
  ],
  7:[
    { id:'deep7', label:'7장 확장 리딩', positions:['현재','숨은 원인','상대 또는 환경','장애물','조언','가까운 미래','결과'] },
    { id:'relation7', label:'관계 흐름 7장', positions:['과거','현재','가까운 미래','A의 욕구','B의 욕구','문제','조언'] },
    { id:'character7', label:'캐릭터 서사 7장', positions:['겉모습','숨은 면','결핍','욕망','관계 변수','선택','다음 장면'] }
  ],
  9:[
    { id:'deep9', label:'전체 흐름형 9장 배열', positions:['현재','원인','겉으로 보이는 일','숨은 마음','흐름','변수','조언','가까운 결과','전체 결론'] },
    { id:'relation9', label:'관계/상황 확장 리딩', positions:['나','상대','관계','장애물','기대','두려움','조언','가능성','결과'] }
  ],
  10:[
    { id:'celtic', label:'켈틱크로스형 10장 배열', positions:['현재','도전','숨은 기반','과거','가능성','가까운 미래','나의 태도','환경','바람과 두려움','결과'] }
  ]
};

const TAROT_MAJOR_IDS = Array.from({ length:22 }, (_, index) => `major_${String(index).padStart(2, '0')}`);
const TAROT_MINOR_IDS = ['wands', 'cups', 'swords', 'pentacles']
  .flatMap(suit => Array.from({ length:14 }, (_, index) => `minor_${suit}_${String(index + 1).padStart(2, '0')}`));
const TAROT_CARD_IDS = new Set([...TAROT_MAJOR_IDS, ...TAROT_MINOR_IDS]);

function normalizeTarotCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function hashTarotCode(value) {
  return sha256(`arcana-entry:${normalizeTarotCode(value)}`);
}

function randomTarotChars(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join('');
}

function makeTarotCode() {
  return `TARO-${randomTarotChars(4)}-${randomTarotChars(4)}-${randomTarotChars(4)}`;
}

function tarotCodeSuffix(code) {
  return normalizeTarotCode(code).slice(-4);
}

function hasRestrictedPersonalInfo(value) {
  const text = String(value || '');
  return /(010[-.\s]?\d{3,4}[-.\s]?\d{4}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|주민등록|주민번호|여권번호|운전면허|계좌번호|카카오톡\s*ID|카톡\s*ID|인스타\s*ID|주소\s*:)/i.test(text);
}

function cleanTarotUrl(value, fallback = '') {
  const text = cleanText(value, 300);
  if (!text) return fallback;
  if (/^(?:\/(?!\/)|\?|#|https:\/\/)/i.test(text)) return text;
  return fallback;
}

function cleanTarotPublicSettingsBody(body) {
  const source = body && typeof body === 'object' ? body : {};
  return {
    title:cleanText(source.title, 80) || '타로 리딩 접수',
    description:cleanText(source.description, 500) || '참여코드를 받은 분만 접수할 수 있습니다.',
    notice:cleanText(source.notice, 500) || '실명이나 연락처 없이 닉네임과 질문만 남겨 주세요. 타로 리딩은 자기 이해와 선택을 돕는 참고용 콘텐츠입니다.',
    buttonLabel:cleanText(source.buttonLabel || source.button_label, 40) || '타로 접수 사이트 열기',
    buttonUrl:cleanTarotUrl(source.buttonUrl || source.button_url, ''),
    entryButtonLabel:cleanText(source.entryButtonLabel || source.entry_button_label, 40) || '참여코드 입력하기',
    isPublic:source.isPublic !== false && source.is_public !== false
  };
}

function clampUseLimit(value, fallback = 1) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, 999);
}

const TAROT_READING_TYPES = [
  ['general', '일반'],
  ['relationship', '관계'],
  ['oc', '자캐'],
  ['oc_relationship', '자캐관계'],
  ['favorite', '최애'],
  ['dream', '드림']
];
const TAROT_READING_TYPE_IDS = TAROT_READING_TYPES.map(([id]) => id);
const TAROT_READING_TYPE_LABELS = Object.fromEntries(TAROT_READING_TYPES);

function normalizeReadingTypeId(value) {
  const id = String(value || '').trim();
  return TAROT_READING_TYPE_IDS.includes(id) ? id : 'general';
}

function normalizeAllowedReadingTypes(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  const list = raw.map(normalizeReadingTypeId).filter((id, index, arr) => id && arr.indexOf(id) === index);
  return list.length ? list : [...TAROT_READING_TYPE_IDS];
}

function cleanTarotQuestionContext(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const readingType = normalizeReadingTypeId(source.readingType || source.reading_type);
  const fieldsSource = source.fields && typeof source.fields === 'object' && !Array.isArray(source.fields) ? source.fields : {};
  const fields = {};
  Object.entries(fieldsSource).forEach(([key, raw]) => {
    const cleanKey = String(key || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
    const cleanValue = cleanText(raw, 260);
    if (cleanKey && cleanValue) fields[cleanKey] = cleanValue;
  });
  const label = cleanText(source.readingTypeLabel || source.reading_type_label || TAROT_READING_TYPE_LABELS[readingType], 40) || TAROT_READING_TYPE_LABELS[readingType];
  const subTopic = cleanText(source.subTopic || source.sub_topic, 24);
  return {
    readingType,
    reading_type:readingType,
    readingTypeLabel:label,
    reading_type_label:label,
    subTopic,
    sub_topic:subTopic,
    fields
  };
}

function tarotQuestionContextText(context) {
  const ctx = cleanTarotQuestionContext(context);
  const fields = Object.values(ctx.fields || {}).join(' ');
  return `${ctx.readingTypeLabel || ''} ${ctx.subTopic || ''} ${fields}`.trim();
}

function cleanTarotSettings(value, spreadCount) {
  const source = value && typeof value === 'object' ? value : {};
  const get = (camel, snake, fallback) => source[camel] !== undefined ? source[camel] : (source[snake] !== undefined ? source[snake] : fallback);
  const bool = (camel, snake, fallback) => get(camel, snake, fallback) !== false;
  const drawMode = 'manual_select';
  const revealMode = String(get('revealMode', 'reveal_mode', 'flip')) === 'static' ? 'static' : 'flip';
  const completionMessage = cleanText(get('completionMessage', 'completion_message', '카드가 접수되었습니다.'), 200) || '카드가 접수되었습니다.';
  const legacySingleUse = get('singleUse', 'single_use', true) !== false;
  const maxSubmissions = clampUseLimit(get('maxSubmissions', 'max_submissions', legacySingleUse ? 1 : 999));
  const adminCode = normalizeTarotCode(get('adminCode', 'admin_code', ''));
  const allowedReadingTypes = normalizeAllowedReadingTypes(get('allowedReadingTypes', 'allowed_reading_types', TAROT_READING_TYPE_IDS));
  return {
    allowReversed:bool('allowReversed', 'allow_reversed', true),
    allow_reversed:bool('allowReversed', 'allow_reversed', true),
    showCardsToParticipant:bool('showCardsToParticipant', 'show_cards_to_participant', true),
    show_cards_to_participant:bool('showCardsToParticipant', 'show_cards_to_participant', true),
    showOrientationToParticipant:bool('showOrientationToParticipant', 'show_orientation_to_participant', true),
    show_orientation_to_participant:bool('showOrientationToParticipant', 'show_orientation_to_participant', true),
    enableResultImage:bool('enableResultImage', 'enable_result_image', true),
    enable_result_image:bool('enableResultImage', 'enable_result_image', true),
    includeQuestionInImage:get('includeQuestionInImage', 'include_question_in_image', true) !== false,
    include_question_in_image:get('includeQuestionInImage', 'include_question_in_image', true) !== false,
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
    allowedReadingTypes,
    allowed_reading_types:allowedReadingTypes,
    maxSubmissions,
    max_submissions:maxSubmissions,
    singleUse:maxSubmissions <= 1,
    single_use:maxSubmissions <= 1,
    completionMessage,
    completion_message:completionMessage,
    adminCode,
    admin_code:adminCode,
    spreadCount
  };
}

function tarotSpreadFor(count, spreadType) {
  const spreadCount = TAROT_SPREADS[count] ? count : 3;
  const spreads = TAROT_SPREADS[spreadCount] || TAROT_SPREADS[3];
  return spreads.find(item => item.id === spreadType) || spreads[0];
}

function cleanTarotInviteBody(body) {
  const source = body && typeof body === 'object' ? body : {};
  const requestedCount = Number(source.spreadCount || source.spread_count || 3);
  const spreadCount = TAROT_SPREADS[requestedCount] ? requestedCount : 3;
  const spread = tarotSpreadFor(spreadCount, cleanText(source.spreadType || source.spread_type, 40));
  const expiresRaw = source.expiresAt || source.expires_at || '';
  const expiresAt = expiresRaw ? Date.parse(expiresRaw) : null;
  return {
    label:cleanText(source.label, 80),
    internalNote:cleanText(source.internalNote || source.internal_note, 500),
    readingTitle:cleanText(source.readingTitle || source.reading_title, 80) || '개인 타로 리딩',
    spreadCount,
    spreadType:spread.id,
    spreadPositions:spread.positions,
    settings:cleanTarotSettings(source.settings, spreadCount),
    expiresAt:Number.isFinite(expiresAt) ? expiresAt : null
  };
}

function cleanTarotSubmissionBody(body) {
  const source = body && typeof body === 'object' ? body : {};
  const participantName = cleanText(source.participantName || source.participant_name, 24);
  const title = cleanText(source.title, 50);
  const topic = cleanText(source.topic, 24);
  const question = cleanText(source.question, 400);
  const questionContext = cleanTarotQuestionContext(source.questionContext || source.question_context);
  if (hasRestrictedPersonalInfo(`${participantName} ${title} ${topic} ${question} ${tarotQuestionContextText(questionContext)}`)) {
    const err = new Error('restricted_personal_info');
    err.statusCode = 400;
    throw err;
  }
  return {
    participantName,
    title,
    topic,
    question,
    questionContext,
    question_context:questionContext,
    drawnCards:normalizeTarotDrawnCards(source.drawnCards || source.drawn_cards)
  };
}

function normalizeTarotDrawnCards(value) {
  const cards = Array.isArray(value) ? value.slice(0, 10) : [];
  const seen = new Set();
  return cards.map((card, index) => {
    const item = card && typeof card === 'object' ? card : {};
    const cardId = cleanText(item.cardId || item.card_id, 60);
    const orientation = String(item.orientation || '').toLowerCase() === 'reversed' ? 'reversed' : 'upright';
    if (!TAROT_CARD_IDS.has(cardId) || seen.has(cardId)) {
      const err = new Error(seen.has(cardId) ? 'duplicate_drawn_cards' : 'invalid_drawn_cards');
      err.statusCode = 400;
      throw err;
    }
    seen.add(cardId);
    return {
      position:cleanText(item.position, 40) || `카드 ${index + 1}`,
      card_id:cardId,
      cardId,
      nameKo:cleanText(item.nameKo || item.name_ko, 40),
      nameEn:cleanText(item.nameEn || item.name_en, 80),
      orientation,
      symbol:cleanText(item.symbol, 12),
      imageUrl:null
    };
  });
}

function safeTarotInvite(invite, options = {}) {
  const item = invite || {};
  const settings = item.settings && typeof item.settings === 'object' ? { ...item.settings } : {};
  const adminCode = normalizeTarotCode(settings.adminCode || settings.admin_code || item.adminCode || item.admin_code || '');
  if (!options.admin) {
    delete settings.adminCode;
    delete settings.admin_code;
  }
  const safe = {
    id:String(item.id || ''),
    codeSuffix:String(item.codeSuffix || item.code_suffix || ''),
    label:String(item.label || ''),
    readingTitle:String(item.readingTitle || item.reading_title || ''),
    spreadCount:Number(item.spreadCount || item.spread_count || 3),
    spreadType:String(item.spreadType || item.spread_type || ''),
    spreadPositions:Array.isArray(item.spreadPositions) ? item.spreadPositions : (Array.isArray(item.spread_positions) ? item.spread_positions : []),
    settings,
    status:String(item.status || 'open'),
    expiresAt:item.expiresAt || item.expires_at || null,
    usedAt:item.usedAt || item.used_at || null,
    createdAt:item.createdAt || item.created_at || null,
    updatedAt:item.updatedAt || item.updated_at || null,
    usedCount:Number(item.usedCount || item.used_count || 0),
    maxSubmissions:maxSubmissionsForInvite(item)
  };
  if (options.admin) {
    safe.internalNote = String(item.internalNote || item.internal_note || '');
    if (adminCode) safe.adminCode = adminCode;
  }
  return safe;
}

function safeTarotSubmission(submission) {
  const item = submission || {};
  return {
    id:String(item.id || ''),
    inviteId:String(item.inviteId || item.invite_id || ''),
    participantName:String(item.participantName || item.participant_name || ''),
    title:String(item.title || ''),
    topic:String(item.topic || ''),
    question:String(item.question || ''),
    questionContext:cleanTarotQuestionContext(item.questionContext || item.question_context),
    spreadCount:Number(item.spreadCount || item.spread_count || 3),
    spreadType:String(item.spreadType || item.spread_type || ''),
    drawnCards:Array.isArray(item.drawnCards) ? item.drawnCards : (Array.isArray(item.drawn_cards) ? item.drawn_cards : []),
    resultImageUrl:String(item.resultImageUrl || item.result_image_url || ''),
    status:String(item.status || 'received'),
    adminNote:String(item.adminNote || item.admin_note || ''),
    interpretation:String(item.interpretation || ''),
    createdAt:item.createdAt || item.created_at || null,
    updatedAt:item.updatedAt || item.updated_at || null,
    deleteAt:item.deleteAt || item.delete_after || null
  };
}

function maxSubmissionsForInvite(invite) {
  const settings = invite && invite.settings ? invite.settings : {};
  if (settings.maxSubmissions !== undefined || settings.max_submissions !== undefined) {
    return clampUseLimit(settings.maxSubmissions !== undefined ? settings.maxSubmissions : settings.max_submissions, 1);
  }
  const singleUse = settings.singleUse !== undefined ? settings.singleUse : settings.single_use;
  return singleUse === false ? 999 : 1;
}

function assertInviteUsable(invite, usedCount = 0) {
  if (!invite) {
    const err = new Error('invalid_invite_code');
    err.statusCode = 404;
    throw err;
  }
  if (invite.expiresAt && Number(invite.expiresAt) < Date.now()) {
    const err = new Error('expired_invite_code');
    err.statusCode = 400;
    throw err;
  }
  if (invite.status !== 'open' || Number(usedCount || 0) >= maxSubmissionsForInvite(invite)) {
    const err = new Error('used_invite_code');
    err.statusCode = 400;
    throw err;
  }
}

function sendTarotError(res, error, fallback = 'tarot_request_failed') {
  const status = error && error.statusCode ? error.statusCode : 500;
  res.status(status).json({ error:error && error.message ? error.message : fallback });
}

function cleanType(value) {
  const allowed = new Set(['react', 'html', 'chart', 'game', 'tool', 'daily', 'study', 'cooking', 'fandom', 'design', 'experiment', 'other']);
  const t = String(value || 'other').trim().toLowerCase();
  return allowed.has(t) ? t : 'other';
}

function cleanTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[\n,#，、]+/);
  const seen = new Set();
  const tags = [];
  for (const item of raw) {
    const tag = String(item || '').replace(/^#+/, '').trim().replace(/\s+/g, ' ').slice(0, 28).replace(/[<>"`]/g, '');
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 14) break;
  }
  return tags;
}

function cleanSourceKind(value, detectedJsx = false) {
  const allowed = new Set(['html', 'jsx', 'zip', 'post', 'other']);
  const kind = String(value || '').trim().toLowerCase();
  if (allowed.has(kind)) return kind;
  return detectedJsx ? 'jsx' : 'html';
}

function cleanSlug(value) {
  const allowed = new Set(['home', 'projects', 'posts', 'about', 'contact', 'privacy', 'terms']);
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
  const cleanBlocks = Array.isArray(src.blocks) ? src.blocks.slice(0, 10).map((block) => ({ title: cleanString(block && block.title, 120), text: cleanString(block && block.text, 1600) })) : [];
  const cleanLinks = Array.isArray(src.links) ? src.links.slice(0, 12).map((link) => ({ label: cleanString(link && link.label, 80), url: cleanString(link && link.url, 300) })) : [];
  const cleanPostCategories = Array.isArray(src.postCategories)
    ? src.postCategories.slice(0, 24).map((item) => {
      if (item && item.kind === 'divider') return ['---', cleanString(item.divider || item.dividerAsset || item.file, 160)].join(' | ');
      return [
        cleanString(item && (item.label || item.name), 40),
        cleanString(item && item.key, 42),
        Array.isArray(item && item.subtopics) ? item.subtopics.map(sub => cleanString(sub, 40)).filter(Boolean).join(', ') : cleanString(item && item.subtopics, 300),
        cleanString(item && (item.divider || item.dividerAsset), 160)
      ].join(' | ');
    }).filter(line => line.trim()).join('\n')
    : cleanString(src.postCategories, 3000);
  const allowedFilters = new Set(['all', 'tool', 'game', 'daily', 'study', 'cooking', 'fandom', 'design', 'chart', 'experiment', 'other', 'secret']);
  const safeFilterKey = (item) => allowedFilters.has(item) || /^[a-z0-9_-]{1,42}$/.test(item);
  const cleanFilterOrder = (Array.isArray(src.filterOrder) ? src.filterOrder : String(src.filterOrder || '').split(/[\s,|/]+/))
    .map(item => String(item || '').trim().toLowerCase())
    .filter((item, index, arr) => safeFilterKey(item) && arr.indexOf(item) === index)
    .slice(0, 30);
  const postsPerPage = [1, 3, 5, 10].includes(Number(src.postsPerPage)) ? Number(src.postsPerPage) : undefined;
  const sidebarMode = ['recent', 'profile', 'hidden'].includes(String(src.sidebarMode || '')) ? src.sidebarMode : undefined;
  const recentLimit = [3, 5, 10].includes(Number(src.recentLimit)) ? Number(src.recentLimit) : undefined;
  const categoryFold = String(src.categoryFold || '') === 'closed' ? 'closed' : (String(src.categoryFold || '') === 'open' ? 'open' : undefined);
  const showPostCounts = typeof src.showPostCounts === 'boolean' ? src.showPostCounts : undefined;
  return {
    eyebrow: cleanString(src.eyebrow, 120),
    script: cleanString(src.script, 120),
    title: cleanString(src.title, 200),
    body: cleanString(src.body, 1200),
    infoTitle: cleanString(src.infoTitle, 120),
    email: cleanString(src.email, 200),
    blocks: cleanBlocks,
    links: cleanLinks,
    filterOrder: cleanFilterOrder,
    postCategories: cleanPostCategories,
    postDivider: cleanString(src.postDivider, 160),
    ...(postsPerPage ? { postsPerPage } : {}),
    ...(sidebarMode ? { sidebarMode } : {}),
    ...(recentLimit ? { recentLimit } : {}),
    ...(categoryFold ? { categoryFold } : {}),
    ...(showPostCounts !== undefined ? { showPostCounts } : {})
  };
}

function cleanDataUrl(value, max = 1200000) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(text)) return '';
  return text.length <= max ? text : '';
}

function cleanImageRef(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^https:\/\//i.test(text) && text.length <= 1200) return text;
  if (/^\/assets\/illust\//i.test(text) && text.length <= 300) return text;
  return cleanDataUrl(text);
}

function cleanCoverImage(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text === RANDOM_GAMSUNG_COVER) return text;
  if (/^\/assets\/illust\/gamsung-(?:1|3|4|5|6|7|8|9|10|11|12|13|14|15)\.webp$/i.test(text)) return text;
  return cleanImageRef(text);
}

function cleanGalleryImages(value) {
  const raw = Array.isArray(value) ? value : [];
  return raw.map(item => cleanImageRef(item)).filter(Boolean).slice(0, 8);
}

function cleanBool(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function cleanStatus(value, isPrivate = false) {
  const status = String(value || '').toLowerCase().trim();
  if (['public', 'private', 'draft'].includes(status)) return status;
  return isPrivate ? 'private' : 'public';
}


function cleanStoragePath(value) {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\/+/, '').slice(0, 700);
}

function cleanStorageBucket(value, fallback = '') {
  const text = String(value || '').trim().slice(0, 80);
  return /^[a-z0-9][a-z0-9._-]*$/i.test(text) ? text : fallback;
}

function cleanMime(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9.+\-/]/g, '').slice(0, 120);
}

function cleanFilename(value) {
  return String(value || '').trim().replace(/[<>:"'`\\|?*\x00-\x1f]/g, '').slice(0, 160);
}

function privateFieldsFromBody(body, existing = null) {
  const is_private = cleanBool(body && body.is_private) || cleanStatus(body && body.status) === 'private';
  const password = String(body && body.private_password || '').trim();
  if (!is_private) return { is_private:false, private_password_hash:'', private_password_salt:'' };
  if (password) {
    const next = hashPrivatePassword(password);
    return { is_private:true, private_password_hash:next.hash, private_password_salt:next.salt };
  }
  if (existing && existing.private_password_hash && existing.private_password_salt) {
    return { is_private:true, private_password_hash:existing.private_password_hash, private_password_salt:existing.private_password_salt };
  }
  const err = new Error('private password is required.');
  err.statusCode = 400;
  throw err;
}

function payloadFromBody(body, existing = null) {
  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 240);
  const type = cleanType(body.type);
  let code = normalizeCode(body.code);
  const cover_image = cleanCoverImage(body.cover_image);
  const gallery_images = cleanGalleryImages(body.gallery_images);
  const detail_text = cleanText(body.detail_text, 20000);
  const detectedJsxFromBody = isJSX(code);
  const source_kind = cleanSourceKind(body.source_kind || body.format || existing && existing.source_kind, detectedJsxFromBody || /jsx|tsx/i.test(body.source_filename || existing && existing.source_filename || ''));
  const incomingStoragePath = cleanStoragePath(body.code_storage_path);
  const existingStoragePath = existing && existing.code_storage_path ? existing.code_storage_path : '';
  const code_storage_path = source_kind === 'post' ? '' : (incomingStoragePath || (!code ? existingStoragePath : '') || '');
  const code_storage_bucket = code_storage_path ? cleanStorageBucket(body.code_storage_bucket, existing && existing.code_storage_bucket || store.ARTIFACT_BUCKET) : '';
  const code_storage_mime = code_storage_path ? cleanMime(body.code_storage_mime || existing && existing.code_storage_mime) : '';
  const source_filename = code_storage_path ? cleanFilename(body.source_filename || existing && existing.source_filename) : '';
  if (!code && existing && existing.code && !incomingStoragePath) code = normalizeCode(existing.code);
  if (code_storage_path && (!code || code === '__ERBELLO_STORAGE__')) code = '__ERBELLO_STORAGE__';
  const detectedJsx = isJSX(code);
  if (source_kind === 'post') code = POST_SOURCE_CODE;
  const tags = cleanTags(body.tags);
  const requestedStatus = cleanStatus(body.status, cleanBool(body.is_private));
  const privateFields = privateFieldsFromBody({ ...body, is_private: requestedStatus === 'private' || cleanBool(body.is_private) }, existing);
  const status = requestedStatus === 'private' || privateFields.is_private ? 'private' : requestedStatus;
  return { title, description, type, tags, source_kind, cover_image, gallery_images, detail_text, code, is_jsx: source_kind === 'post' ? false : (detectedJsx || source_kind === 'jsx'), code_storage_bucket, code_storage_path, code_storage_mime, source_filename, status, ...privateFields };
}

function hasPostContent(payload) {
  const postParts = splitPostContent(payload && payload.detail_text || '');
  return Boolean(payload && (
    plainText(postParts.body, 20)
    || plainText(payload.description, 20)
    || payload.cover_image
    || (Array.isArray(payload.gallery_images) && payload.gallery_images.length)
    || postParts.attachments.length
  ));
}

function hasTarotEntryMeta(payload) {
  if (!payload || payload.source_kind === 'post') return false;
  const meta = splitPostContent(payload.detail_text || '').meta || {};
  return Boolean(meta.tarot_public_only && meta.tarot_entry_url);
}

function validateArtifactPayload(payload) {
  if (!payload || !payload.title) return 'title and content are required.';
  if (payload.source_kind === 'post') {
    return hasPostContent(payload) ? '' : 'post body, description or image is required.';
  }
  if (hasTarotEntryMeta(payload)) return '';
  return (payload.code || payload.code_storage_path) ? '' : 'title and code are required.';
}

function hiddenPageContent(content) {
  return content && typeof content === 'object' && !Array.isArray(content) ? content : {};
}

function publicPageRow(row) {
  if (!row || typeof row !== 'object') return row;
  const content = hiddenPageContent(row.content);
  if (!Object.prototype.hasOwnProperty.call(content, 'aiPostingConfig')) return row;
  const nextContent = { ...content };
  delete nextContent.aiPostingConfig;
  return { ...row, content: nextContent };
}

function isSitePageSlugConstraintError(error) {
  const text = [
    error && error.code,
    error && error.message,
    error && error.details,
    error && error.hint
  ].filter(Boolean).join(' ');
  return /23514|site_pages_slug_check|violates check constraint/i.test(text);
}

async function getFallbackAiPostingConfig() {
  for (const slug of AI_POSTING_FALLBACK_PAGE_SLUGS) {
    try {
      const page = await store.getPage(slug, 'ko');
      const content = hiddenPageContent(page && page.content);
      if (content.aiPostingConfig && typeof content.aiPostingConfig === 'object') {
        return content.aiPostingConfig;
      }
    } catch (_) {}
  }
  return null;
}

async function saveFallbackAiPostingConfig(config) {
  let constraintError = null;
  for (const slug of AI_POSTING_FALLBACK_PAGE_SLUGS) {
    try {
      const page = await store.getPage(slug, 'ko').catch(() => null);
      const content = hiddenPageContent(page && page.content);
      const row = await store.upsertPage(slug, 'ko', {
        ...content,
        aiPostingConfig: config
      });
      return {
        ...row,
        slug: AI_POSTING_PAGE_SLUG,
        content: config,
        storage: `${slug}-page-fallback`
      };
    } catch (error) {
      if (!isSitePageSlugConstraintError(error)) throw error;
      constraintError = error;
    }
  }
  throw constraintError || new Error('Could not save AI posting config.');
}

async function getAiPostingConfig() {
  let stored = null;
  try {
    const page = await store.getPage(AI_POSTING_PAGE_SLUG, 'ko');
    stored = page && page.content && typeof page.content === 'object'
      ? (page.content.config && typeof page.content.config === 'object' ? page.content.config : page.content)
      : null;
  } catch (_) {
    stored = null;
  }
  if (!stored) stored = await getFallbackAiPostingConfig();
  return normalizeAiPostingConfig(stored || {});
}

async function saveAiPostingConfig(value) {
  const config = normalizeAiPostingConfig(value || {});
  try {
    const row = await store.upsertPage(AI_POSTING_PAGE_SLUG, 'ko', config);
    return { ...row, content: config, storage: 'dedicated-page' };
  } catch (error) {
    if (!isSitePageSlugConstraintError(error)) throw error;
    return saveFallbackAiPostingConfig(config);
  }
}

function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
}

function cronConfigured() {
  return Boolean(process.env.CRON_SECRET);
}

function checkCronRequest(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
  return String(req.headers && req.headers.authorization || '') === `Bearer ${expected}`;
}

function cleanAiPostBody(value) {
  return String(value || '')
    .split(POST_ATTACH_PREFIX)[0]
    .split(POST_WIDGET_PREFIX)[0]
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function recentAiPromptPosts() {
  const rows = await store.listArtifacts({ includePrivateDetails:true });
  return (rows || [])
    .filter(item => isPostArtifact(item))
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
    .slice(0, 10)
    .map(item => ({
      title: item.title || '',
      description: item.description || '',
      body: plainText(cleanAiPostBody(item.detail_text), 220),
      tags: Array.isArray(item.tags) ? item.tags : [],
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
}

async function callGeminiText(prompt, config) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('Gemini API key is not configured. Vercel 환경변수 GEMINI_API_KEY를 추가해주세요.');
    error.statusCode = 503;
    throw error;
  }
  const model = encodeURIComponent(process.env.GEMINI_MODEL || config.model || 'gemini-2.5-flash');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role:'user', parts:[{ text:prompt }] }],
        generationConfig: {
          temperature: Number(config.temperature || 0.72),
          maxOutputTokens: Number(config.maxOutputTokens || 1400),
          responseMimeType: 'application/json'
        }
      })
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    if (!response.ok) {
      const message = data && data.error && data.error.message ? data.error.message : text;
      const error = new Error(`Gemini request failed: ${message || response.status}`);
      error.statusCode = response.status >= 500 ? 502 : response.status;
      throw error;
    }
    const output = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts
      ? data.candidates[0].content.parts.map(part => part.text || '').join('\n').trim()
      : '';
    if (!output) {
      const error = new Error('Gemini returned an empty response.');
      error.statusCode = 502;
      throw error;
    }
    return output;
  } finally {
    clearTimeout(timer);
  }
}

async function generateAiPost(kind = 'diary') {
  const safeKind = kind === 'trend' ? 'trend' : 'diary';
  const config = await getAiPostingConfig();
  if (!config.enabled) {
    const error = new Error('AI auto posting is disabled.');
    error.statusCode = 403;
    throw error;
  }
  const recent = await recentAiPromptPosts();
  const prompt = buildGeminiPrompt(safeKind, config, recent);
  const raw = await callGeminiText(prompt, config);
  const generated = normalizeGeneratedPost(safeKind, parseGeneratedPost(raw), config);
  const shortBody = aiPostBodyLooksShort(safeKind, generated.body);
  const detailBody = decorateAiPostBody(safeKind, generated, config);
  const status = shortBody || !config.autoPublish ? 'draft' : 'public';
  const payload = {
    title: cleanText(generated.title, 80),
    description: cleanText(generated.description, 240),
    type: cleanType(generated.type),
    tags: cleanTags(shortBody ? [...generated.tags, '검토 필요'] : generated.tags),
    source_kind: 'post',
    cover_image: '',
    gallery_images: [],
    detail_text: cleanText(detailBody, 20000),
    code: POST_SOURCE_CODE,
    is_jsx: false,
    status,
    is_private: false,
    private_password_hash: '',
    private_password_salt: ''
  };
  const invalid = validateArtifactPayload(payload);
  if (invalid) {
    const error = new Error(invalid);
    error.statusCode = 400;
    throw error;
  }
  const artifact = await store.createArtifact(payload);
  return {
    artifact: stripPrivateSecrets(artifact),
    config,
    kind:safeKind,
    warning: shortBody ? 'AI 본문이 짧아서 자동공개하지 않고 임시저장했습니다.' : ''
  };
}

async function handleAiCron(req, res, kind) {
  if (!checkCronRequest(req)) return res.status(401).json({ error:'Unauthorized cron request.' });
  try {
    const result = await generateAiPost(kind);
    res.json({ ok:true, kind:result.kind, status:result.artifact.status, id:result.artifact.id, title:result.artifact.title, warning:result.warning || '' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error:error.message || 'AI auto posting failed.' });
  }
}

async function interactionPostFromRequest(req, res) {
  const artifact = await store.getArtifact(req.params.id);
  if (!artifact || !isPostArtifact(artifact) || isDraftArtifact(artifact) || (isScheduledFutureArtifact(artifact) && !isAdminRequest(req))) {
    res.status(404).json({ error:'Post not found.' });
    return null;
  }
  if (artifact.is_private && !isAdminRequest(req)) {
    res.status(404).json({ error:'Post not found.' });
    return null;
  }
  return artifact;
}

function interactionSummary(config, interactions, isAdmin) {
  const messages = config.message.enabled && (config.message.visibility === 'public' || isAdmin)
    ? interactions.filter(item => item.kind === 'message').map(item => ({
      id:item.id,
      name:item.name || '익명',
      body:item.body,
      visibility:item.visibility,
      created_at:item.created_at
    })).slice(-80)
    : [];
  const resultVisible = config.poll.enabled && (config.poll.visibility === 'public' || isAdmin);
  const results = resultVisible ? pollResults(interactions, config.poll.options) : [];
  return {
    message:{
      enabled:config.message.enabled,
      visibility:config.message.visibility,
      prompt:config.message.prompt,
      messages
    },
    poll:{
      enabled:config.poll.enabled,
      visibility:config.poll.visibility,
      question:config.poll.question,
      options:config.poll.options,
      results,
      resultVisible
    },
    admin:isAdmin
  };
}

app.get('/api/status', (_req, res) => {
  res.json({ ok: true, storage: store.mode, adminConfigured: Boolean(getAdminHash()) });
});

app.get('/api/cron/ai-diary', (req, res) => handleAiCron(req, res, 'diary'));
app.get('/api/cron/ai-trend', (req, res) => handleAiCron(req, res, 'trend'));

app.get('/api/posts/:id/interactions', async (req, res) => {
  try {
    const artifact = await interactionPostFromRequest(req, res);
    if (!artifact) return;
    const isAdmin = isAdminRequest(req);
    const config = splitPostContent(artifact.detail_text || '').widgets;
    const interactions = await store.listPostInteractions(req.params.id, { includePrivate:isAdmin });
    res.json(interactionSummary(config, interactions, isAdmin));
  } catch (error) {
    res.status(500).json({ error:error.message || 'Could not load post interactions.' });
  }
});

app.post('/api/posts/:id/messages', interactionLimit, async (req, res) => {
  try {
    const artifact = await interactionPostFromRequest(req, res);
    if (!artifact) return;
    const config = splitPostContent(artifact.detail_text || '').widgets;
    if (!config.message.enabled) return res.status(403).json({ error:'Message form is not enabled.' });
    const body = cleanText(req.body && req.body.body, 1000);
    if (!body) return res.status(400).json({ error:'Message is required.' });
    await store.createPostInteraction({
      post_id:req.params.id,
      kind:'message',
      visibility:config.message.visibility,
      name:cleanText(req.body && req.body.name, 40) || '익명',
      body
    });
    const interactions = await store.listPostInteractions(req.params.id, { includePrivate:isAdminRequest(req) });
    res.json(interactionSummary(config, interactions, isAdminRequest(req)));
  } catch (error) {
    res.status(500).json({ error:error.message || 'Could not save message.' });
  }
});

app.post('/api/posts/:id/votes', interactionLimit, async (req, res) => {
  try {
    const artifact = await interactionPostFromRequest(req, res);
    if (!artifact) return;
    const config = splitPostContent(artifact.detail_text || '').widgets;
    if (!config.poll.enabled) return res.status(403).json({ error:'Poll is not enabled.' });
    const option = String(req.body && req.body.option || '').trim();
    if (!config.poll.options.some(item => item.key === option)) return res.status(400).json({ error:'Invalid poll option.' });
    const vote_key = voteFingerprint(req, req.params.id);
    const before = await store.listPostInteractions(req.params.id, { includePrivate:true });
    const existingVote = before.find(item => item.kind === 'vote' && item.vote_key === vote_key);
    if (existingVote) {
      return res.json({ ...interactionSummary(config, before, isAdminRequest(req)), alreadyVoted:true });
    }
    await store.createPostInteraction({
      post_id:req.params.id,
      kind:'vote',
      visibility:config.poll.visibility,
      option_key:option,
      vote_key
    });
    const interactions = await store.listPostInteractions(req.params.id, { includePrivate:isAdminRequest(req) });
    res.json({ ...interactionSummary(config, interactions, isAdminRequest(req)), alreadyVoted:false });
  } catch (error) {
    res.status(500).json({ error:error.message || 'Could not save vote.' });
  }
});

app.get('/api/tarot/public-settings', async (_req, res) => {
  try {
    res.json({ ok:true, settings:await store.getTarotPublicSettings() });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.post('/api/tarot/validate', interactionLimit, async (req, res) => {
  try {
    const code = normalizeTarotCode(req.body && req.body.code);
    if (!code) return res.status(400).json({ error:'invalid_invite_code' });
    const invite = await store.validateTarotInvite(hashTarotCode(code));
    const usedCount = invite ? await store.countTarotSubmissionsForInvite(invite.id) : 0;
    assertInviteUsable(invite, usedCount);
    res.json({ ok:true, invite:safeTarotInvite({ ...invite, usedCount }) });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.post('/api/tarot/submit', interactionLimit, async (req, res) => {
  try {
    const code = normalizeTarotCode(req.body && req.body.code);
    if (!code) return res.status(400).json({ error:'invalid_invite_code' });
    const codeHash = hashTarotCode(code);
    const invite = await store.validateTarotInvite(codeHash);
    const usedCount = invite ? await store.countTarotSubmissionsForInvite(invite.id) : 0;
    assertInviteUsable(invite, usedCount);
    const payload = cleanTarotSubmissionBody(req.body || {});
    const allowedReadingTypes = normalizeAllowedReadingTypes(invite && invite.settings ? (invite.settings.allowedReadingTypes || invite.settings.allowed_reading_types) : TAROT_READING_TYPE_IDS);
    if (!allowedReadingTypes.includes(payload.questionContext.readingType)) {
      return res.status(400).json({ error:'invalid_reading_type' });
    }
    if (payload.drawnCards.length !== Number(invite.spreadCount || 0)) {
      return res.status(400).json({ error:'invalid_drawn_cards' });
    }
    const submission = await store.submitTarotReading({ codeHash, ...payload });
    res.status(201).json({
      ok:true,
      submission:safeTarotSubmission(submission),
      invite:safeTarotInvite({ ...invite, usedCount:usedCount + 1 })
    });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.get('/api/admin/tarot', checkAdmin, async (_req, res) => {
  try {
    const [settings, invites, submissions] = await Promise.all([
      store.getTarotPublicSettings(),
      store.listTarotInvites(),
      store.listTarotSubmissions()
    ]);
    res.json({
      ok:true,
      mode:store.mode,
      settings,
      invites:(invites || []).map(invite => {
        const usedCount = (submissions || []).filter(item => String(item.inviteId || item.invite_id || '') === String(invite.id)).length;
        return safeTarotInvite({ ...invite, usedCount }, { admin:true });
      }),
      submissions:(submissions || []).map(safeTarotSubmission)
    });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.put('/api/admin/tarot/public-settings', checkAdmin, async (req, res) => {
  try {
    const settings = await store.updateTarotPublicSettings(cleanTarotPublicSettingsBody(req.body || {}));
    res.json({ ok:true, settings });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.post('/api/admin/tarot/invites', checkAdmin, async (req, res) => {
  try {
    const code = makeTarotCode();
    const payload = cleanTarotInviteBody(req.body || {});
    payload.settings = { ...(payload.settings || {}), adminCode:code, admin_code:code };
    const invite = await store.createTarotInvite({
      ...payload,
      codeHash:hashTarotCode(code),
      codeSuffix:tarotCodeSuffix(code)
    });
    res.status(201).json({ ok:true, code, invite:safeTarotInvite(invite, { admin:true }) });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.delete('/api/admin/tarot/invites/:id', checkAdmin, async (req, res) => {
  try {
    const ok = await store.deleteTarotInvite(req.params.id);
    if (!ok) return res.status(404).json({ error:'tarot_invite_not_found' });
    res.json({ ok:true });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.put('/api/admin/tarot/submissions/:id', checkAdmin, async (req, res) => {
  try {
    const submission = await store.updateTarotSubmission(req.params.id, {
      status:cleanText(req.body && req.body.status, 40) || 'received',
      adminNote:cleanText(req.body && (req.body.adminNote || req.body.admin_note), 2000),
      interpretation:cleanText(req.body && req.body.interpretation, 6000)
    });
    if (!submission) return res.status(404).json({ error:'tarot_submission_not_found' });
    res.json({ ok:true, submission:safeTarotSubmission(submission) });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.delete('/api/admin/tarot/submissions/:id', checkAdmin, async (req, res) => {
  try {
    const ok = await store.deleteTarotSubmission(req.params.id);
    if (!ok) return res.status(404).json({ error:'tarot_submission_not_found' });
    res.json({ ok:true });
  } catch (error) {
    sendTarotError(res, error);
  }
});

app.get('/api/admin/ai-posting/config', checkAdmin, async (_req, res) => {
  try {
    const config = await getAiPostingConfig();
    res.json({ ok:true, config, geminiConfigured:geminiConfigured(), cronConfigured:cronConfigured() });
  } catch (error) {
    res.status(500).json({ error:error.message || 'Could not load AI posting config.' });
  }
});

app.put('/api/admin/ai-posting/config', checkAdmin, async (req, res) => {
  try {
    const row = await saveAiPostingConfig(req.body && (req.body.config || req.body));
    res.json({ ok:true, config:row.content, updated_at:row.updated_at, geminiConfigured:geminiConfigured(), cronConfigured:cronConfigured() });
  } catch (error) {
    res.status(500).json({ error:error.message || 'Could not save AI posting config.' });
  }
});

app.post('/api/admin/ai-posting/generate', checkAdmin, async (req, res) => {
  try {
    const kind = String(req.body && req.body.kind || 'diary').toLowerCase() === 'trend' ? 'trend' : 'diary';
    const result = await generateAiPost(kind);
    res.status(201).json({ ok:true, kind:result.kind, artifact:result.artifact, status:result.artifact.status, warning:result.warning || '' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error:error.message || 'Could not generate AI post.' });
  }
});

app.get('/api/admin/system', checkAdmin, async (req, res) => {
  try {
    const status = await store.systemStatus();
    const origin = siteOrigin(req);
    res.json({ ok:true, adminConfigured:Boolean(getAdminHash()), geminiConfigured:geminiConfigured(), cronConfigured:cronConfigured(), aiPostingEnabled:(await getAiPostingConfig()).enabled, siteOrigin:origin, adsTxtUrl:`${origin}/ads.txt`, adsenseClient:ADSENSE_CLIENT, ...status });
  } catch (error) {
    res.status(500).json({ error:error.message || 'System check failed' });
  }
});

app.get('/api/artifacts', async (req, res) => {
  try {
    const isAdmin = isAdminRequest(req);
    const artifacts = await store.listArtifacts({ includePrivateDetails: isAdmin });
    const visible = isAdmin ? artifacts : artifacts.filter(artifact => !isScheduledFutureArtifact(artifact));
    res.json(visible.map((artifact) => isAdmin ? stripPrivateSecrets(artifact) : publicArtifactSummary(artifact)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pages', async (_req, res) => {
  try {
    const publicSlugs = new Set(['home', 'projects', 'posts', 'about', 'contact', 'privacy', 'terms']);
    const rows = await store.listPages();
    res.json((rows || [])
      .filter(row => publicSlugs.has(String(row.slug || '').toLowerCase()))
      .map(publicPageRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


function uploadKindMeta(kind) {
  const k = String(kind || '').trim().toLowerCase();
  if (k === 'source') return { bucket: store.ARTIFACT_BUCKET, prefix: 'sources', isPublic: false };
  if (k === 'cover') return { bucket: store.MEDIA_BUCKET, prefix: 'covers', isPublic: true };
  if (k === 'gallery') return { bucket: store.MEDIA_BUCKET, prefix: 'gallery', isPublic: true };
  if (k === 'post-file') return { bucket: store.MEDIA_BUCKET, prefix: 'post-files', isPublic: true };
  const err = new Error('Invalid upload kind.');
  err.statusCode = 400;
  throw err;
}

function extensionFromMime(mime) {
  const map = {
    'text/html':'html',
    'text/javascript':'js',
    'application/javascript':'js',
    'text/css':'css',
    'text/plain':'txt',
    'application/json':'json',
    'application/pdf':'pdf',
    'application/zip':'zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx',
    'image/png':'png',
    'image/jpeg':'jpg',
    'image/webp':'webp',
    'image/gif':'gif',
    'image/svg+xml':'svg'
  };
  return map[String(mime || '').toLowerCase()] || '';
}

function safeUploadName(name, mime = '') {
  const cleaned = cleanFilename(name || 'upload').replace(/\s+/g, '-').replace(/[^a-z0-9._-]/gi, '').slice(0, 120) || 'upload';
  if (/\.[a-z0-9]{1,8}$/i.test(cleaned)) return cleaned;
  const ext = extensionFromMime(mime);
  return ext ? `${cleaned}.${ext}` : cleaned;
}

app.post('/api/admin/uploads/sign', checkAdmin, async (req, res) => {
  try {
    const meta = uploadKindMeta(req.body && req.body.kind);
    const mime = cleanMime(req.body && req.body.mime) || 'application/octet-stream';
    const name = safeUploadName(req.body && req.body.name, mime);
    const size = Number(req.body && req.body.size || 0);
    if (size > STORAGE_UPLOAD_LIMIT_BYTES) {
      return res.status(413).json({
        error: '파일이 너무 큽니다. Supabase Free 기준 50MB를 넘을 수 있어 이미지/영상/음악을 줄이거나 파일별 업로드가 필요합니다.',
        size,
        limit: STORAGE_UPLOAD_LIMIT_BYTES
      });
    }
    const objectPath = `${meta.prefix}/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}-${name}`;
    const signed = await store.createSignedUploadUrl(meta.bucket, objectPath);
    res.json({
      bucket: meta.bucket,
      path: objectPath,
      signedUrl: signed.signedUrl,
      token: signed.token,
      publicUrl: meta.isPublic ? store.getPublicUrl(meta.bucket, objectPath) : '',
      mime,
      filename: name
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.put('/api/admin/pages/:slug/:lang', checkAdmin, async (req, res) => {
  try {
    const slug = cleanSlug(req.params.slug);
    const lang = cleanLang(req.params.lang);
    if (!slug || !lang) return res.status(400).json({ error: 'Invalid page or language.' });
    const content = cleanPageContent(req.body && req.body.content);
    if (AI_POSTING_FALLBACK_PAGE_SLUGS.includes(slug) && lang === 'ko') {
      const existing = await store.getPage(slug, lang).catch(() => null);
      const hidden = hiddenPageContent(existing && existing.content).aiPostingConfig;
      if (hidden && typeof hidden === 'object') content.aiPostingConfig = hidden;
    }
    const page = await store.upsertPage(slug, lang, content);
    res.json(publicPageRow(page));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/admin/export', checkAdmin, async (req, res) => {
  try {
    const rows = await store.listArtifacts({ includePrivateDetails:true });
    const origin = siteOrigin(req);
    const text = (rows || []).map((item, index) => {
      const tags = Array.isArray(item.tags) ? item.tags.join(', ') : '';
      const detailParts = splitPostContent(item.detail_text || '');
      const detail = plainText(detailParts.body, 1000);
      const scheduledAt = detailParts.meta && detailParts.meta.scheduled_at ? fmtMonthKo(detailParts.meta.scheduled_at) : '';
      const isPost = isPostArtifact(item);
      return [`#${index + 1}`,
        `제목: ${item.title || ''}`,
        `종류: ${isPost ? 'post' : 'project'}`,
        `상태: ${item.status || (item.is_private ? 'private' : 'public')}`,
        scheduledAt ? `예약 공개: ${scheduledAt}` : '',
        `대표 분류: ${item.type || ''}`,
        `태그: ${tags}`,
        `짧은 설명: ${item.description || ''}`,
        `상세 소개: ${detail}`,
        `조회수: ${Number(item.view_count || 0)}`,
        `상세 URL: ${origin}/project/${encodeURIComponent(String(item.id))}`,
        isPost ? `실행 URL: 포스트는 실행 페이지 없음` : `실행 URL: ${origin}/run/${encodeURIComponent(String(item.id))}`
      ].join('\n');
    }).join('\n\n---\n\n');
    res.type('text/plain').send(text || '등록된 프로젝트가 없습니다.');
  } catch (error) {
    res.status(500).type('text/plain').send(error.message || 'Export failed');
  }
});

app.get('/api/admin/artifacts/:id', checkAdmin, async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found.' });
    res.json(stripPrivateSecrets(artifact));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/artifacts', checkAdmin, async (req, res) => {
  try {
    const payload = payloadFromBody(req.body || {});
    const invalid = validateArtifactPayload(payload);
    if (invalid) return res.status(400).json({ error: invalid });
    const artifact = await store.createArtifact(payload);
    const { code, private_password_hash, private_password_salt, ...summary } = artifact;
    res.status(201).json(summary);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.put('/api/admin/artifacts/:id', checkAdmin, async (req, res) => {
  try {
    const existing = await store.getArtifact(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Artifact not found.' });
    const payload = payloadFromBody(req.body || {}, existing);
    const invalid = validateArtifactPayload(payload);
    if (invalid) return res.status(400).json({ error: invalid });
    const artifact = await store.updateArtifact(req.params.id, payload);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found.' });
    const { code, private_password_hash, private_password_salt, ...summary } = artifact;
    res.json(summary);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
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
  if (!password) return res.status(400).json({ ok: false, error: 'Invalid admin password.' });
  const actual = sha256(password);
  if (safeEqualHex(actual, expected)) return res.json({ ok: true, token: signAdminAccess() });
  res.status(401).json({ ok: false, error: 'Invalid admin password.' });
});

app.post('/api/artifacts/:id/unlock', async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact || isDraftArtifact(artifact) || isScheduledFutureArtifact(artifact)) return res.status(404).json({ error: 'Artifact not found.' });
    if (!artifact.is_private) return res.json({ access: signPrivateAccess(artifact) });
    if (!verifyPrivatePassword(req.body && req.body.password, artifact)) return res.status(401).json({ error: '비밀번호가 맞지 않습니다.' });
    res.json({ access: signPrivateAccess(artifact) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/render/:id', checkAdmin, async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact) return res.status(404).json({ error: 'Artifact not found.' });
    if (isPostArtifact(artifact)) {
      const body = artifactDetailBody(artifact).split(/\n{2,}/).map(p => `<p>${escHtml(p)}</p>`).join('');
      return res.json({ html:`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#1f1a2d;background:#fff8fc}article{max-width:760px;margin:auto}h1{font-size:30px}p{line-height:1.8;color:#665b75}</style></head><body><article><p>POST PREVIEW</p><h1>${escHtml(artifact.title || '')}</h1>${body}</article></body></html>` });
    }
    res.json({ html: await renderArtifactHtml(artifact, { access: String(req.query.access || '') }) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/project/:id', async (req, res) => {
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact) return res.status(404).send(`<!doctype html><html lang="ko"><head>${baseHead({ title:'Project not found · ERBELLO', description:'삭제되었거나 잘못된 프로젝트 링크입니다.', ads:false, robots:'noindex,nofollow' })}</head><body data-scheme="white" data-color="pixel" class="detail-document">${themeBootstrap()}<main class="detail-shell"><section class="detail-panel"><p class="detail-kicker">ERBELLO / 404</p><h1>프로젝트를 찾을 수 없습니다.</h1><p>삭제되었거나 잘못된 링크입니다.</p><a class="btn primary" href="/projects">프로젝트 목록으로</a></section></main></body></html>`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (isDraftArtifact(artifact) || (isScheduledFutureArtifact(artifact) && !isAdminRequest(req))) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(404).send(`<!doctype html><html lang="ko"><head>${baseHead({ title:'Project not found · ERBELLO', description:'아직 공개되지 않은 프로젝트입니다.', ads:false, robots:'noindex,nofollow' })}</head><body data-scheme="white" data-color="pixel" class="detail-document">${themeBootstrap()}<main class="detail-shell"><section class="detail-panel"><p class="detail-kicker">ERBELLO / DRAFT</p><h1>아직 공개되지 않은 프로젝트입니다.</h1><p>이 프로젝트는 소유자만 확인할 수 있습니다.</p><a class="btn primary" href="/projects">프로젝트 목록으로</a></section></main></body></html>`);
    }
    if (artifact.is_private) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.send(renderPrivateProjectDetailPage(req, artifact));
    }
    res.send(renderProjectDetailPage(req, artifact));
  } catch (error) {
    res.status(500).send(`<!doctype html><html><body><pre>${escHtml(error.message)}</pre></body></html>`);
  }
});

app.get('/privacy', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(await renderPolicyPage(req, 'privacy'));
});

app.get('/terms', async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(await renderPolicyPage(req, 'terms'));
});

app.get('/robots.txt', (req, res) => {
  const origin = siteOrigin(req);
  res.type('text/plain').send(`User-agent: *\nDisallow: /api/\nDisallow: /run/\nDisallow: /asset/\nDisallow: /preview.html\nDisallow: /*?admin=\nAllow: /ads.txt\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/ads.txt', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('text/plain').send(`${ADS_TXT_LINE}\n`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const origin = siteOrigin(req);
    const rows = await store.listArtifacts({ includePrivateDetails:false });
    const publicRows = (rows || []).filter(item => !item.is_private && item.status !== 'draft' && !isScheduledFutureArtifact(item));
    const staticUrls = ['/', '/Akashi', '/projects', '/posts', '/about', '/contact', '/privacy', '/terms'].map(url => ({ url }));
    const projectUrls = publicRows.map(item => ({ url:`/project/${encodeURIComponent(String(item.id))}`, lastmod:fmtIsoDate(item.updated_at || item.created_at) }));
    const urls = [...staticUrls, ...projectUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url><loc>${origin}${item.url}</loc>${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
    res.type('application/xml').send(xml);
  } catch (error) {
    res.status(500).type('text/plain').send(error.message || 'sitemap error');
  }
});

app.get('/asset/:id/*', async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact || isDraftArtifact(artifact) || isScheduledFutureArtifact(artifact)) return res.status(404).send('Not found');
    const access = String(req.query.access || '');
    if (artifact.is_private && !verifyPrivateAccessToken(access, artifact)) return res.status(401).send('Locked');
    const requested = normalizeZipPath(req.params[0] || '');
    const manifest = decodeZipManifest(artifact.code);
    if (manifest) {
      const file = manifest.files.get(requested) || [...manifest.files.values()].find(item => item.path.toLowerCase() === requested.toLowerCase());
      if (!file) return res.status(404).send('Not found');
      const mime = file.mime || guessMime(file.path);
      const buffer = await store.downloadStorageObject(artifact.code_storage_bucket || store.ARTIFACT_BUCKET, file.storagePath);
      res.setHeader('Content-Type', mime.startsWith('text/') || /javascript|json|svg/.test(mime) ? `${mime}; charset=utf-8` : mime);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (mime === 'text/css') {
        const cssDir = file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '';
        return res.send(rewriteCssManifestUrls(buffer.toString('utf8'), manifest, artifact.id, cssDir, access));
      }
      return res.send(buffer);
    }

    if (!artifact.code_storage_path) return res.status(404).send('Not found');
    const kind = cleanSourceKind(artifact.source_kind, artifact.is_jsx);
    if (kind !== 'zip' && !/zip/i.test(artifact.code_storage_mime || '') && !/\.zip$/i.test(artifact.source_filename || '')) return res.status(404).send('Not found');
    const buffer = await loadStorageSource(artifact);
    const zip = await JSZip.loadAsync(buffer);
    const entry = zipEntry(zip, requested);
    if (!entry) return res.status(404).send('Not found');
    const mime = guessMime(entry.name);
    res.setHeader('Content-Type', mime.startsWith('text/') || /javascript|json|svg/.test(mime) ? `${mime}; charset=utf-8` : mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (mime === 'text/css') {
      const cssDir = normalizeZipPath(entry.name).includes('/') ? normalizeZipPath(entry.name).split('/').slice(0, -1).join('/') : '';
      const css = rewriteCssZipUrls(await entry.async('string'), zip, artifact.id, cssDir, access);
      return res.send(css);
    }
    const data = await entry.async('nodebuffer');
    res.send(data);
  } catch (error) {
    res.status(500).send(error.message || 'Asset error');
  }
});

app.get('/run/:id', async (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const artifact = await store.getArtifact(req.params.id);
    if (!artifact) {
      return res.status(404).send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title><style>body{margin:0;background:#090909;color:#f4f4f4;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}.box{border:1px solid #2a2a2a;padding:28px;border-radius:18px;background:#111}.k{color:#c7ff4f;font-family:monospace}</style></head><body><div class="box"><div class="k">ERBELLO / 404</div><h1>Artifact not found</h1><p>삭제되었거나 잘못된 링크입니다.</p></div></body></html>`);
    }

    if (isDraftArtifact(artifact) || isScheduledFutureArtifact(artifact)) {
      return res.status(404).send(`<!doctype html><html><body><pre>Draft project</pre></body></html>`);
    }

    if (isPostArtifact(artifact)) {
      return res.redirect(302, `/project/${encodeURIComponent(String(artifact.id))}`);
    }

    if (hasTarotEntryMeta(artifact)) {
      return res.redirect(302, `/project/${encodeURIComponent(String(artifact.id))}`);
    }

    if (artifact.is_private) {
      const access = String(req.query.access || '');
      if (!verifyPrivateAccessToken(access, artifact)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderPrivateLockPage(artifact));
      }
    }

    if (req.query.ownerPreview !== '1') {
      store.incrementView(req.params.id).catch((error) => console.warn('view count failed:', error.message || error));
    }

    const html = await renderArtifactHtml(artifact, { access: String(req.query.access || '') });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(html);
  } catch (error) {
    res.status(500).send(`<!doctype html><html><body><pre>${escHtml(error.message)}</pre></body></html>`);
  }
});

app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderIndexPage(req));
});

const PORT = Number(process.env.PORT || 3000);
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`ERBELLO gallery running on http://localhost:${PORT}`);
    console.log(`Storage mode: ${store.mode}`);
  });
}

module.exports = app;
