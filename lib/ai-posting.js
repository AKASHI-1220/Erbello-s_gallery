const DEFAULT_MODEL = 'gemini-2.5-flash';

const DEFAULT_AI_POSTING_CONFIG = {
  enabled: true,
  autoPublish: false,
  model: DEFAULT_MODEL,
  maxOutputTokens: 900,
  temperature: 0.72,
  mascot: {
    name: 'Pello',
    visual: 'A cute sky-blue pixel penguin mascot wearing a tiny gold crown.',
    profile: 'ERBELLO Gallery의 작은 안내자입니다. 조용히 작업물을 둘러보고, 오늘의 발견과 기분을 짧은 일기처럼 남깁니다.',
    tone: '다정하고 귀엽지만 과하게 감성적이지 않게, 짧고 읽기 쉽게 씁니다.'
  },
  diary: {
    category: 'daily',
    tags: ['마스코트', '다이어리', 'ERBELLO', 'AI 자동 포스팅'],
    prompt: '마스코트가 ERBELLO Gallery에서 본 작은 변화, 작업 기록, 방문자에게 건네는 짧은 인사를 일기처럼 작성하세요.'
  },
  trend: {
    category: 'study',
    tags: ['AI', '트렌드', '정리', 'AI 자동 포스팅'],
    prompt: '최근 웹 제작, 개인 사이트, AI 도구 활용 흐름을 비교해 짧은 정리 글을 작성하세요. 확인되지 않은 최신 뉴스처럼 단정하지 말고, 일반적인 흐름과 관찰 중심으로 씁니다.'
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
    const tag = cleanString(item, 28).replace(/^#+/, '').replace(/[<>"'`]/g, '').trim();
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

function normalizeSection(input, fallback) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    category: cleanCategory(src.category, fallback.category),
    tags: cleanTags(src.tags && cleanTags(src.tags).length ? src.tags : fallback.tags),
    prompt: cleanString(src.prompt, 2400) || fallback.prompt
  };
}

function normalizeAiPostingConfig(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const mascot = src.mascot && typeof src.mascot === 'object' ? src.mascot : {};
  return {
    enabled: src.enabled !== false,
    autoPublish: Boolean(src.autoPublish),
    model: cleanString(src.model, 80) || DEFAULT_AI_POSTING_CONFIG.model,
    maxOutputTokens: Math.round(cleanNumber(src.maxOutputTokens, DEFAULT_AI_POSTING_CONFIG.maxOutputTokens, 300, 1600)),
    temperature: Number(cleanNumber(src.temperature, DEFAULT_AI_POSTING_CONFIG.temperature, 0.1, 1.3).toFixed(2)),
    mascot: {
      name: cleanString(mascot.name, 40) || DEFAULT_AI_POSTING_CONFIG.mascot.name,
      visual: cleanString(mascot.visual, 500) || DEFAULT_AI_POSTING_CONFIG.mascot.visual,
      profile: cleanString(mascot.profile, 1600) || DEFAULT_AI_POSTING_CONFIG.mascot.profile,
      tone: cleanString(mascot.tone, 700) || DEFAULT_AI_POSTING_CONFIG.mascot.tone
    },
    diary: normalizeSection(src.diary, DEFAULT_AI_POSTING_CONFIG.diary),
    trend: normalizeSection(src.trend, DEFAULT_AI_POSTING_CONFIG.trend)
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

function parseGeneratedPost(rawText) {
  const text = stripJsonFence(rawText);
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {}
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {}
  }
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
  const titleFallback = safeKind === 'trend' ? '이번 주 작은 트렌드 정리' : `${config.mascot.name}의 갤러리 일기`;
  const bodyFallback = safeKind === 'trend'
    ? '이번 주에는 개인 사이트와 작은 웹 도구를 더 가볍게 만들고 정리하는 흐름을 살펴보았습니다.'
    : `${config.mascot.name}가 ERBELLO Gallery를 둘러보며 오늘의 작은 기록을 남겼습니다.`;
  const src = generated && typeof generated === 'object' ? generated : {};
  const title = cleanString(src.title, 80) || titleFallback;
  const description = cleanString(src.description || src.summary, 220) || trimPostBody(src.body || bodyFallback).slice(0, 120);
  const body = trimPostBody(src.body || src.content || bodyFallback);
  const tags = cleanTags([...(section.tags || []), ...(cleanTags(src.tags || []))]);
  return {
    title,
    description,
    body,
    tags,
    type: cleanCategory(src.category || section.category, section.category || 'other')
  };
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
    '- Body: 5 to 8 short paragraphs, around 500 to 900 Korean characters.',
    '- Do not include code blocks.',
    '- Do not ask visitors for personal information.',
    '- Do not mention API keys, cron, Gemini, or admin-only details.',
    '- Do not repeat recent post titles or the same opening sentence.',
    '',
    'JSON shape:',
    '{"title":"...","description":"...","body":"...","tags":["..."],"category":"daily"}'
  ].join('\n');
}

module.exports = {
  DEFAULT_AI_POSTING_CONFIG,
  normalizeAiPostingConfig,
  parseGeneratedPost,
  normalizeGeneratedPost,
  buildGeminiPrompt
};
