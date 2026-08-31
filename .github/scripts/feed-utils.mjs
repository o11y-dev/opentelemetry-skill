const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_MAX_POSTS = 8;

const XML_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

function decodeCodePoint(value, radix) {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isSafeInteger(codePoint)) return '';
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return '';
  }
}

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => decodeCodePoint(codePoint, 16))
    .replace(/&#([0-9]+);/g, (_, codePoint) => decodeCodePoint(codePoint, 10))
    .replace(/&([a-z]+);/gi, (entity, name) => XML_ENTITIES[name.toLowerCase()] ?? entity);
}

function cleanXmlText(value = '') {
  const withoutCdata = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  const decoded = decodeEntities(withoutCdata);
  return decodeEntities(decoded.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractElement(block, names) {
  for (const name of names) {
    const escapedName = escapeRegExp(name);
    const match = block.match(new RegExp(`<${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedName}>`, 'i'));
    if (match) return match[1];
  }
  return '';
}

function extractElements(block, name) {
  const escapedName = escapeRegExp(name);
  return [...block.matchAll(new RegExp(`<${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedName}>`, 'gi'))]
    .map((match) => cleanXmlText(match[1]));
}

function extractAtomLink(block) {
  for (const match of block.matchAll(/<link\b([^>]*)\/?\s*>/gi)) {
    const attributes = match[1];
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const rel = attributes.match(/\brel=["']([^"']+)["']/i)?.[1];
    if (href && (!rel || rel === 'alternate')) return decodeEntities(href).trim();
  }
  return '';
}

function normalizeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function keywordPattern(keyword) {
  const tokens = keyword.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return null;
  return new RegExp(`\\b${tokens.join('\\s+')}\\b`, 'i');
}

function matchesSourceFilter(post, source) {
  const patterns = (source.include_any ?? []).map(keywordPattern).filter(Boolean);
  if (patterns.length === 0) return true;
  return patterns.some((pattern) => pattern.test(post.searchable_text));
}

export function parseFeed(xml) {
  if (typeof xml !== 'string') throw new TypeError('feed must be a string');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml.slice(0, 4096))) {
    throw new Error('unsafe XML declaration in feed');
  }

  const rssItems = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => match[1]);
  const atomEntries = rssItems.length === 0
    ? [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].map((match) => match[1])
    : [];

  return [...rssItems, ...atomEntries].map((block) => {
    const title = cleanXmlText(extractElement(block, ['title']));
    const rssLink = cleanXmlText(extractElement(block, ['link']));
    const url = normalizeHttpUrl(rssLink || extractAtomLink(block));
    const publishedValue = cleanXmlText(extractElement(block, ['pubDate', 'published', 'updated']));
    const publishedMillis = Date.parse(publishedValue);
    const searchableContent = ['description', 'summary', 'content:encoded', 'content', 'dc:creator']
      .map((name) => cleanXmlText(extractElement(block, [name])))
      .filter(Boolean);
    const categories = extractElements(block, 'category');

    if (!title || !url) return null;
    return {
      title,
      url,
      published_at: Number.isFinite(publishedMillis) ? new Date(publishedMillis).toISOString() : null,
      searchable_text: [title, ...searchableContent, ...categories, url].join(' '),
    };
  }).filter(Boolean);
}

export function selectRecentFeedPosts(xml, source = {}, now = new Date()) {
  const nowMillis = new Date(now).getTime();
  if (!Number.isFinite(nowMillis)) throw new TypeError('now must be a valid date');

  const lookbackDays = Number.isFinite(source.lookback_days) ? source.lookback_days : DEFAULT_LOOKBACK_DAYS;
  const maxPosts = Number.isFinite(source.max_posts) ? source.max_posts : DEFAULT_MAX_POSTS;
  const cutoffMillis = nowMillis - lookbackDays * 86400 * 1000;
  const seen = new Set();

  return parseFeed(xml)
    .filter((post) => matchesSourceFilter(post, source))
    .filter((post) => !post.published_at || Date.parse(post.published_at) >= cutoffMillis)
    .sort((left, right) => (Date.parse(right.published_at) || 0) - (Date.parse(left.published_at) || 0))
    .filter((post) => {
      if (seen.has(post.url)) return false;
      seen.add(post.url);
      return true;
    })
    .slice(0, maxPosts)
    .map(({ searchable_text: _searchableText, ...post }) => post);
}

function escapeMarkdown(value) {
  return String(value).replace(/([\\[\]])/g, '\\$1').replace(/\s+/g, ' ').trim();
}

export function renderFeedDigest(feedResults) {
  if (feedResults.length === 0) return [];

  const lines = ['## Recent blog and community posts', ''];
  for (const result of feedResults) {
    const source = result.source ?? {};
    const homepage = normalizeHttpUrl(source.homepage ?? '');
    const sourceName = escapeMarkdown(source.name ?? source.url ?? 'Feed');
    lines.push(homepage ? `### [${sourceName}](${homepage})` : `### ${sourceName}`);

    const skills = (source.skills ?? []).map((skill) => `\`${String(skill).replace(/`/g, '')}\``);
    if (skills.length > 0) lines.push('', `_Skills to review: ${skills.join(', ')}_`);
    lines.push('');

    if (result.error) {
      lines.push(`- ⚠️ Feed unavailable: ${escapeMarkdown(result.error)}`, '');
      continue;
    }
    if ((result.posts ?? []).length === 0) {
      const lookbackDays = source.lookback_days ?? DEFAULT_LOOKBACK_DAYS;
      lines.push(`- _No matching posts published in the last ${lookbackDays} days._`, '');
      continue;
    }

    for (const post of result.posts) {
      const published = post.published_at ? ` — published ${post.published_at.slice(0, 10)}` : '';
      lines.push(`- [${escapeMarkdown(post.title)}](${post.url})${published}`);
    }
    lines.push('');
  }
  return lines;
}
