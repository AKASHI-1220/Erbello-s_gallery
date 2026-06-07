const DEFAULT_MODEL = 'gemini-2.5-flash';
const POST_ASSET_BASE = '/assets/illust/imagegen-assets/web/';
const POST_SUBCATEGORY_PREFIX = 'sub:';
const LEGACY_MASCOT_PROFILE = 'ERBELLO Gallery의 작은 안내자입니다. 조용히 작업물을 둘러보고, 오늘의 발견과 기분을 짧은 일기처럼 남깁니다.';
const LEGACY_DIARY_PROMPT = '마스코트가 ERBELLO Gallery에서 본 작은 변화, 작업 기록, 방문자에게 건네는 짧은 인사를 일기처럼 작성하세요.';
const LEGACY_TREND_PROMPT = '최근 웹 제작, 개인 사이트, AI 도구 활용 흐름을 비교해 짧은 정리 글을 작성하세요. 확인되지 않은 최신 뉴스처럼 단정하지 말고, 일반적인 흐름과 관찰 중심으로 씁니다.';

const DEFAULT_AI_POSTING_CONFIG = {
  enabled: true,
  autoPublish: false,
  model: DEFAULT_MODEL,
  maxOutputTokens: 1400,
  temperature: 0.72,
  mascot: {
    name: 'Pello',
    visual: 'A cute sky-blue pixel penguin mascot wearing a tiny gold crown.',
    profile: 'ERBELLO Gallery의 작은 관리자 및 안내자입니다. 조용히 작업물을 둘러보고, 오늘의 발견과 기분을 짧은 일기처럼 남깁니다.',
    tone: '다정하고 귀엽지만 과하게 감성적이지 않게, 짧고 읽기 쉽게 씁니다.'
  },
  diary: {
    category: 'other',
    categoryTag: "Pello's Diary",
    autoAssets: true,
    tags: ["Pello's Diary", '마스코트', '다이어리', 'ERBELLO', 'AI 자동 포스팅'],
    prompt: '마스코트가 ERBELLO Gallery에서 본 작은 변화, 작업 기록, 방문자에게 건네는 짧은 인사를 일기처럼 작성하세요. 변화가 없더라도 귀여운 마스코트로서의 작은 일기를 완성하면 됩니다.'
  },
  trend: {
    category: 'other',
    categoryTag: 'AI posting',
    autoAssets: true,
    tags: ['AI posting', 'AI', '트렌드', '정리', 'AI 자동 포스팅'],
    prompt: '최근 뉴스와 트렌드를 정리하여 짧은 블로그 글을 작성하세요. 확인되지 않은 최신 뉴스처럼 단정하지 말고, 일반적인 흐름과 관찰 중심으로 씁니다. 전문적이고 정보를 전달하는 목적으로 사실을 기반하여 신뢰성 있는 출처와 함께 글을 작성합니다.'
  }
};

const AI_POST_ASSETS = {
  diary: {
    header: ['typo-diary.png', 'typo-log.png', 'typo-today.png'],
    divider: ['divider-cloud-moon.png', 'divider-pink-beads.png', 'divider-dotted-bow-heart.png'],
    sticker: ['pello/pello-basic.png', 'pello/pello-diary.png', 'pello/pello-cloud.png', 'pello/pello-sleepy.png', 'pello/pello-cheer.png', 'pello/pello-wink-heart.png', 'pello/pello-curious.png', 'pello/pello-cloud-walk.png', 'pello/pello-mail.png', 'pello/pello-proud.png', 'potion-charm.png', 'cloud-soft.png', 'memo-card.png', 'bow-heart.png']
  },
  trend: {
    header: ['typo-new.png', 'typo-summary.png', 'typo-study.png'],
    divider: ['divider-blue-stars.png', 'divider-dashed-cloud-stars.png', 'divider-lavender-potion-gems.png'],
    sticker: ['pello/pello-trend-report.png', 'pello/pello-laptop.png', 'pello/pello-curious.png', 'pello/pello-proud.png', 'study-laptop.png', 'study-book.png', 'memo-card.png', 'gold-star.png']
  }
};

function cleanString(value, max = 1000) {
  return String(value || '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function cleanTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[\n,#，、]+/);
  const seen = new Set();
  const tags = [];
  for (const item of raw) {
    const tag = cleanString(item, 28).replace(/^#+/, '').replace(/[<>"`]/g, '').trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return tags;
}

function cleanCategory(value, fallback = 'other') {
  const allowed = new Set(['tool', 'game', 'daily', 'study', 'cooking', 'fandom', 'design', 'chart', 'experiment', 'other']);
  const key = cleanString(value, 42).toLowerCase();
  return allowed.has(key) ? key : fallback;
}

function cleanNumber(value, fallback, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function normalizeSection(input, fallback, legacyPrompt = '') {
  const src = input && typeof input === 'object' ? input : {};
  const categoryTag = cleanString(src.categoryTag || src.sidebarCategory || src.sidebarLabel, 40);
  const prompt = cleanString(src.prompt, 2400);
  return {
    category: categoryTag ? cleanCategory(src.category, fallback.category) : fallback.category,
    categoryTag: categoryTag || fallback.categoryTag || '',
    autoAssets: src.autoAssets !== false,
    tags: cleanTags(src.tags && cleanTags(src.tags).length ? src.tags : fallback.tags),
    prompt: !prompt || (legacyPrompt && prompt === legacyPrompt) ? fallback.prompt : prompt
  };
}

function normalizeAiPostingConfig(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const mascot = src.mascot && typeof src.mascot === 'object' ? src.mascot : {};
  const rawMaxTokens = Number(src.maxOutputTokens);
  const maxOutputTokens = !Number.isFinite(rawMaxTokens) || rawMaxTokens === 900
    ? DEFAULT_AI_POSTING_CONFIG.maxOutputTokens
    : rawMaxTokens;
  const profile = cleanString(mascot.profile, 1600);
  return {
    enabled: src.enabled !== false,
    autoPublish: Boolean(src.autoPublish),
    model: cleanString(src.model, 80) || DEFAULT_AI_POSTING_CONFIG.model,
    maxOutputTokens: Math.round(cleanNumber(maxOutputTokens, DEFAULT_AI_POSTING_CONFIG.maxOutputTokens, 300, 1800)),
    temperature: Number(cleanNumber(src.temperature, DEFAULT_AI_POSTING_CONFIG.temperature, 0.1, 1.3).toFixed(2)),
    mascot: {
      name: cleanString(mascot.name, 40) || DEFAULT_AI_POSTING_CONFIG.mascot.name,
      visual: cleanString(mascot.visual, 500) || DEFAULT_AI_POSTING_CONFIG.mascot.visual,
      profile: !profile || profile === LEGACY_MASCOT_PROFILE ? DEFAULT_AI_POSTING_CONFIG.mascot.profile : profile,
      tone: cleanString(mascot.tone, 700) || DEFAULT_AI_POSTING_CONFIG.mascot.tone
    },
    diary: normalizeSection(src.diary, DEFAULT_AI_POSTING_CONFIG.diary, LEGACY_DIARY_PROMPT),
    trend: normalizeSection(src.trend, DEFAULT_AI_POSTING_CONFIG.trend, LEGACY_TREND_PROMPT)
  };
}

function trimPostBody(value) {
  const text = cleanString(value, 5000);
  if (!text) return '';
  return text
    .split(/\n{3,}/)
    .map(part => part.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 3200);
}

function stripJsonFence(value) {
  let text = cleanString(value, 8000);
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();
  return text;
}

function unescapeLooseJsonString(value) {
  return cleanString(value, 5000)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
}

function looseJsonField(text, key) {
  const source = String(text || '');
  const marker = new RegExp(`"${key}"\\s*:\\s*"`, 'i');
  const match = marker.exec(source);
  if (!match) return '';
  const start = match.index + match[0].length;
  const rest = source.slice(start);
  const next = rest.search(new RegExp(`"\\s*,\\s*"(?:title|description|body|tags|category)"|"\\s*}\\s*$`, 'i'));
  const raw = next >= 0 ? rest.slice(0, next) : rest;
  return unescapeLooseJsonString(raw);
}

function parseLooseGeneratedPost(text) {
  const title = looseJsonField(text, 'title');
  const description = looseJsonField(text, 'description');
  const body = looseJsonField(text, 'body');
  if (!title && !description && !body) return null;
  return { title, description, body };
}

function parseGeneratedPost(rawText) {
  const text = stripJsonFence(rawText);
  for (const candidate of [text, text.replace(/[“”]/g, '"')]) {
    try {
      let parsed = JSON.parse(candidate);
      for (let i = 0; i < 2 && typeof parsed === 'string'; i += 1) {
        parsed = JSON.parse(stripJsonFence(parsed));
      }
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
    const loose = parseLooseGeneratedPost(objectMatch[0]);
    if (loose) return loose;
  }
  const loose = parseLooseGeneratedPost(text);
  if (loose) return loose;
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  return {
    title: lines[0] || 'AI 자동 포스팅',
    description: lines[1] || '',
    body: lines.slice(1).join('\n\n') || text
  };
}

function normalizeGeneratedPost(kind, generated, config) {
  const safeKind = kind === 'trend' ? 'trend' : 'diary';
  const section = config[safeKind] || DEFAULT_AI_POSTING_CONFIG[safeKind];
  const categoryTag = aiPostCategoryTag(safeKind, config);
  const titleFallback = safeKind === 'trend' ? '이번 주 작은 트렌드 정리' : `${config.mascot.name}의 갤러리 일기`;
  const bodyFallback = safeKind === 'trend'
    ? '이번 주에는 개인 사이트와 작은 웹 도구를 더 가볍게 만들고 정리하는 흐름을 살펴보았습니다.'
    : `${config.mascot.name}가 ERBELLO Gallery를 둘러보며 오늘의 작은 기록을 남겼습니다.`;
  const src = generated && typeof generated === 'object' ? generated : {};
  const title = cleanString(src.title, 80) || titleFallback;
  const description = cleanString(src.description || src.summary, 220) || trimPostBody(src.body || bodyFallback).slice(0, 120);
  const body = trimPostBody(src.body || src.content || bodyFallback);
  const tags = cleanTags([categoryTag, `${POST_SUBCATEGORY_PREFIX}${categoryTag}`, ...(section.tags || []), ...(cleanTags(src.tags || []))]);
  return {
    title,
    description,
    body,
    tags,
    type: cleanCategory(section.category || src.category, section.category || 'other')
  };
}

function aiPostCategoryTag(kind, config) {
  const safeKind = kind === 'trend' ? 'trend' : 'diary';
  const section = config && config[safeKind] ? config[safeKind] : DEFAULT_AI_POSTING_CONFIG[safeKind];
  const fallback = safeKind === 'trend' ? 'AI posting' : "Pello's Diary";
  return cleanString(section.categoryTag, 40) || fallback;
}

function assetMarkdown(file, alt) {
  const safeFile = String(file || '')
    .replace(/\\/g, '/')
    .split('/')
    .map(part => part.replace(/[^a-z0-9._-]/gi, ''))
    .filter(Boolean)
    .join('/');
  if (!safeFile) return '';
  return `![${cleanString(alt, 40)}](${POST_ASSET_BASE}${safeFile})`;
}

function seedValue(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickAsset(list, seed) {
  const items = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!items.length) return '';
  return items[seedValue(seed) % items.length];
}

function decorateAiPostBody(kind, generated, config) {
  const safeKind = kind === 'trend' ? 'trend' : 'diary';
  const section = config && config[safeKind] ? config[safeKind] : DEFAULT_AI_POSTING_CONFIG[safeKind];
  const body = trimPostBody(generated && generated.body);
  if (!body || section.autoAssets === false || /!\[[^\]]*]\(\/assets\/illust\//i.test(body)) return body;

  const assets = AI_POST_ASSETS[safeKind] || AI_POST_ASSETS.diary;
  const seed = `${safeKind}|${generated && generated.title || ''}|${body.slice(0, 80)}`;
  const header = assetMarkdown(pickAsset(assets.header, `${seed}|header`), safeKind === 'trend' ? 'AI posting' : 'Pello diary');
  const divider = assetMarkdown(pickAsset(assets.divider, `${seed}|divider`), 'divider');
  const sticker = assetMarkdown(pickAsset(assets.sticker, `${seed}|sticker`), safeKind === 'trend' ? 'trend asset' : 'diary asset');
  const blocks = body.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const first = blocks.slice(0, 2).join('\n\n');
  const rest = blocks.slice(2).join('\n\n');
  return [header, first, divider, rest, sticker].filter(Boolean).join('\n\n');
}

function recentLines(recentPosts = []) {
  return recentPosts.slice(0, 8).map((post, index) => {
    const title = cleanString(post.title, 80) || 'Untitled';
    const summary = cleanString(post.description || post.body || '', 180);
    const tags = cleanTags(post.tags || []).join(', ');
    return `${index + 1}. ${title}${summary ? ` - ${summary}` : ''}${tags ? ` / tags: ${tags}` : ''}`;
  }).join('\n') || '최근 참고할 포스트가 아직 없습니다.';
}

function buildGeminiPrompt(kind, config, recentPosts = []) {
  const safeKind = kind === 'trend' ? 'trend' : 'diary';
  const section = config[safeKind];
  const mission = safeKind === 'trend'
    ? '금요일용 AI 자동 포스팅입니다. 최근 웹 제작/개인 블로그/AI 도구 활용 흐름을 비교 분석하되, 실시간 검색을 하지 않았다면 최신 뉴스처럼 단정하지 마세요.'
    : '화요일용 마스코트 일기입니다. 마스코트의 시점으로 ERBELLO Gallery의 작은 작업 기록과 하루 분위기를 짧게 남기세요.';
  const lengthRule = safeKind === 'trend'
    ? '- Body: 8 to 12 short paragraphs, around 900 to 1400 Korean characters.'
    : '- Body: 8 to 9 short diary-like lines or short paragraphs, around 450 to 750 Korean characters.';
  return [
    'You write Korean blog posts for a personal project gallery.',
    'Return only valid JSON. Do not wrap it in markdown.',
    '',
    `Mascot name: ${config.mascot.name}`,
    `Mascot visual: ${config.mascot.visual}`,
    `Mascot profile: ${config.mascot.profile}`,
    `Tone: ${config.mascot.tone}`,
    '',
    `Task: ${mission}`,
    `Sidebar category tag: ${aiPostCategoryTag(safeKind, config)}`,
    `Admin prompt: ${section.prompt}`,
    '',
    'Recent posts to avoid repeating:',
    recentLines(recentPosts),
    '',
    'Constraints:',
    '- Korean only.',
    '- Keep it short and easy to read.',
    '- Title: 16 to 40 Korean characters.',
    '- Description: under 100 Korean characters.',
    lengthRule,
    '- Do not include code blocks.',
    '- Do not include markdown image syntax; decorative assets are inserted by the site after generation.',
    '- Do not ask visitors for personal information.',
    '- Do not invent source names, dates, URLs, or citations. If live source verification is unavailable, say it is an observation-based summary.',
    '- Do not mention API keys, cron, Gemini, or admin-only details.',
    '- Do not repeat recent post titles or the same opening sentence.',
    '',
    'JSON shape:',
    `{"title":"...","description":"...","body":"...","tags":["..."],"category":"${section.category || 'other'}"}`
  ].join('\n');
}

module.exports = {
  DEFAULT_AI_POSTING_CONFIG,
  normalizeAiPostingConfig,
  parseGeneratedPost,
  normalizeGeneratedPost,
  decorateAiPostBody,
  buildGeminiPrompt
};
