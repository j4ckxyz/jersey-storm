// Bluesky search for local storm posts (and the feed's Guernsey rule), shared by the server (lib/feed.js, the fallback copy in /api/feed) and the
// browser (app.js loads this file with import() and polls Bluesky directly every minute while the tab is visible).
// No dependencies, plain ES module, so it runs in Workers, Node and browsers alike.

// public.api.bsky.app answers 403 to searchPosts (from servers and browsers alike), so search uses api.bsky.app,
// which allows cross-origin requests. public.api.bsky.app still serves author feeds, used as the browser's fallback.
export const SEARCH_HOST = 'https://api.bsky.app';
export const PUBLIC_HOST = 'https://public.api.bsky.app';
export const QUERIES = ['Storm Austen Jersey', 'Storm Austen Guernsey', 'Storm Austen', 'Jersey storm', 'Guernsey storm', 'from:gov.je', 'from:today.je storm'];
// The browser runs every minute per open tab, so it asks less: these three cover the same posts in practice.
export const BROWSER_QUERIES = ['Storm Austen', 'Jersey storm', 'from:gov.je'];
// Accounts whose recent posts stand in for search if search fails.
export const FALLBACK_AUTHORS = ['gov.je', 'today.je'];

const LOCAL_HANDLES = /(\.je$|^gov\.gg$|^gov\.je$|bbcjersey|bbcguernsey|jerseyeveningpost|guernseypress|channel103|islandfm|bailiwick|localtoguernsey|jerseymet|guernseymet|thequarry)/i;
const LOCAL_WORDS = /\b(jersey|guernsey|alderney|sark|herm|st\.? peter port|st\.? sampson'?s?|vale|castel|bailiwick|aurigny|gov\.gg|states of guernsey|st\.? helier|channel islands?|gorey|st\.? brelade|st\.? aubin|st\.? ouen|grouville|trinity|st\.? clement|st\.? saviour|jsy|la rocque|elizabeth castle|states of jersey|gov\.je)\b/i;
const NOT_LOCAL = /new jersey|jersey shore|\bnj\b|jersey city|north jersey|south jersey|nor'?easter|philadelphia|atlantic city/i;
const STORMY = /austen|\bwinds?\b|windy|gale|gust|weather|flood|heavy rain|red warning|amber warning|met office|jersey met|power cut|fallen tree|high tide/i;
// Mirror accounts that just repost news we already pull directly.
const MIRROR = (handle, text) => /xmirror\.bot$|^localtoguernsey/i.test(handle) || (handle === 'today.je' && /^\[(BBC Jersey|JEP News|Jersey Evening Post|Bailiwick Express|GOV\.JE News)\]/i.test(text));

export const searchUrl = (q, limit = 40) => `${SEARCH_HOST}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=${limit}&sort=latest`;
export const authorFeedUrl = (actor, limit = 30) => `${PUBLIC_HOST}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${limit}&filter=posts_no_replies`;

function media(e) {
  if (!e) return [];
  const t = e.$type || '';
  if (t.startsWith('app.bsky.embed.recordWithMedia')) return media(e.media);
  if (t.startsWith('app.bsky.embed.images')) return (e.images || []).slice(0, 4).map((i) => ({ type: 'photo', url: i.fullsize || i.thumb, thumb: i.thumb, alt: i.alt || '' }));
  if (t.startsWith('app.bsky.embed.video')) return e.thumbnail ? [{ type: 'video', url: e.thumbnail, thumb: e.thumbnail, alt: e.alt || '' }] : [];
  if (t.startsWith('app.bsky.embed.external') && e.external) return e.external.thumb ? [{ type: 'link', url: e.external.thumb, thumb: e.external.thumb, alt: e.external.title || '', link: e.external.uri, title: e.external.title || '' }] : [];
  return [];
}
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// Post views (from searchPosts .posts, or getAuthorFeed .feed[].post) → feed items, keeping only local storm posts.
export function toItems(posts) {
  const seen = new Set();
  const out = [];
  for (const p of posts) {
    if (!p || !p.uri || seen.has(p.uri)) continue;
    seen.add(p.uri);
    const text = (p.record && p.record.text) || '';
    const handle = (p.author && p.author.handle) || '';
    if (!text.trim() || handle === 'handle.invalid') continue;
    const local = LOCAL_HANDLES.test(handle) || LOCAL_WORDS.test(text);
    if (!local || NOT_LOCAL.test(text) || MIRROR(handle, text)) continue;
    if (!(STORMY.test(text) || (/storm|school|clos|cancel|ferr|flight/i.test(text) && LOCAL_HANDLES.test(handle)))) continue;
    if (p.labels && p.labels.some((l) => /porn|sexual|nudity|graphic/.test(l.val))) continue;
    const rkey = p.uri.split('/').pop();
    out.push({
      source: 'Bluesky',
      author: p.author.displayName && p.author.displayName.length <= 32 ? p.author.displayName : '',
      handle,
      title: '',
      avatar: p.author.avatar || '',
      text: truncate(text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), 500),
      media: media(p.embed),
      platform: 'bsky',
      url: `https://bsky.app/profile/${handle}/post/${rkey}`,
      time: (p.record && p.record.createdAt) || p.indexedAt,
    });
  }
  return out;
}

// Feed-wide rule (all sources, not just Bluesky): Guernsey-only items show only when they genuinely matter.
const GSY = /guernsey|alderney|\bsark\b|\bherm\b|st\.? peter port|gov\.gg|states of guernsey/i;
const JSY = /jersey|st\.? helier|gov\.je|channel islands/i;
const IMPORTANT = /power cut|outage|power (?:is )?off|without power|injur|damage|airport closed|closed airport|airport.{0,20}clos|cancel+ed (?:flight|sailing)|(?:flight|sailing)s? (?:are |have been )?cancel|aurigny|condor|dfds|brittany ferries|ferr(?:y|ies)|emergency|red warning|red wind|evacuat|flood/i;
export function guernseyRule(i) {
  const t = `${i.source} ${i.title || ''} ${i.text || ''} ${i.handle || ''}`;
  const gsyOnly = /guernsey|quarry/i.test(i.source) || i.island === 'Guernsey' || (GSY.test(t) && !JSY.test(`${i.title || ''} ${i.text || ''}`));
  return !gsyOnly || IMPORTANT.test(`${i.title || ''} ${i.text || ''}`);
}
