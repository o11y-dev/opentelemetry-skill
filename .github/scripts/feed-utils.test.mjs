import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseFeed, renderFeedDigest, selectRecentFeedPosts } from './feed-utils.mjs';

const NOW = new Date('2026-08-31T12:00:00Z');
const CNCF_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <item>
      <title>The lazy developer’s guide to observing your own code</title>
      <link>https://www.cncf.io/blog/2026/08/25/the-lazy-developers-guide-to-observing-your-own-code/</link>
      <pubDate>Tue, 25 Aug 2026 11:34:00 +0000</pubDate>
      <description><![CDATA[Developers are being asked to shift left on observability. This means that...]]></description>
      <content:encoded><![CDATA[Instrument application code with <strong>OpenTelemetry</strong>.]]></content:encoded>
    </item>
    <item>
      <title>Hotel telemetry patterns</title>
      <link>https://www.cncf.io/blog/2026/08/28/hotel-telemetry-patterns/</link>
      <pubDate>Fri, 28 Aug 2026 11:30:00 +0000</pubDate>
      <description><![CDATA[Hospitality analytics without distributed tracing.]]></description>
    </item>
    <item>
      <title>OpenTelemetry article outside the lookback</title>
      <link>https://www.cncf.io/blog/2026/08/01/old-opentelemetry-post/</link>
      <pubDate>Sat, 01 Aug 2026 11:30:00 +0000</pubDate>
      <description>OpenTelemetry</description>
    </item>
  </channel>
</rss>`;

test('filters the CNCF feed by whole OTel terms and publication window', () => {
  const posts = selectRecentFeedPosts(CNCF_FIXTURE, {
    include_any: ['OpenTelemetry', 'Open Telemetry', 'OTel'],
    lookback_days: 14,
    max_posts: 8,
  }, NOW);

  assert.deepEqual(posts.map((post) => post.title), [
    'The lazy developer’s guide to observing your own code',
  ]);
});

test('parses Atom alternate links as a supported fallback', () => {
  const posts = parseFeed(`<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>OTel release note</title>
        <link rel="alternate" href="https://example.com/otel-release" />
        <updated>2026-08-30T10:00:00Z</updated>
        <summary>OpenTelemetry update</summary>
      </entry>
    </feed>`);

  assert.equal(posts[0].url, 'https://example.com/otel-release');
  assert.equal(posts[0].published_at, '2026-08-30T10:00:00.000Z');
});

test('rejects feeds with entity declarations before parsing', () => {
  assert.throws(
    () => parseFeed('<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss />'),
    /unsafe XML declaration/,
  );
});

test('renders selected posts and the owning skill reference in the digest', () => {
  const posts = selectRecentFeedPosts(CNCF_FIXTURE, {
    include_any: ['OpenTelemetry', 'OTel'],
  }, NOW);
  const lines = renderFeedDigest([{
    source: {
      name: 'CNCF blog — OpenTelemetry',
      homepage: 'https://www.cncf.io/blog/',
      skills: ['references/playbooks.md'],
    },
    posts,
  }]);

  assert(lines.some((line) => line.includes('references/playbooks.md')));
  assert(lines.some((line) => line.includes('the-lazy-developers-guide-to-observing-your-own-code')));
});

test('keeps a feed outage visible without throwing away the digest', () => {
  const lines = renderFeedDigest([{
    source: { name: 'OpenTelemetry blog', homepage: 'https://opentelemetry.io/blog/' },
    posts: [],
    error: 'HTTP 503 Service Unavailable',
  }]);

  assert(lines.some((line) => line.includes('Feed unavailable: HTTP 503 Service Unavailable')));
});

test('configures feeds, viewer repositories, and their playbook ownership', async () => {
  const [configText, upstreamMap, playbooks] = await Promise.all([
    readFile(new URL('./repos.json', import.meta.url), 'utf8'),
    readFile(new URL('../upstream-map.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../../references/playbooks.md', import.meta.url), 'utf8'),
  ]);
  const config = JSON.parse(configText);
  assert.equal(config.version, 2);
  const weeklyFeedUrls = new Set(config.feeds.weekly.map((feed) => feed.url));
  assert(weeklyFeedUrls.has('https://opentelemetry.io/blog/index.xml'));
  assert(weeklyFeedUrls.has('https://www.cncf.io/feed/'));
  const cncfFeed = config.feeds.weekly.find((feed) => feed.url === 'https://www.cncf.io/feed/');
  assert.deepEqual(cncfFeed.include_any, ['OpenTelemetry', 'Open Telemetry', 'OTel']);

  const monthlyRepos = new Set(config.frequencies.monthly);
  const viewerRepos = ['CtrlSpice/otel-desktop-viewer', 'ymtdzzz/otel-tui', 'mesaglio/otel-front'];
  for (const repo of viewerRepos) assert(monthlyRepos.has(repo));

  const playbooksMapping = upstreamMap.match(/  - skill: references\/playbooks\.md\n([\s\S]*?)(?=\n  - skill:)/)?.[1] ?? '';
  for (const repo of viewerRepos) assert(playbooksMapping.includes(`repo: ${repo}`));
  assert(playbooksMapping.includes('repo: open-telemetry/opentelemetry.io'));
  assert(playbooks.includes('https://www.cncf.io/blog/2026/08/25/the-lazy-developers-guide-to-observing-your-own-code/'));
});
