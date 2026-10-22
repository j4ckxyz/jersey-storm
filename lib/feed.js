import { fetchText, fetchJSON, parseRSS, isStormy, stripTags, truncate, jerseyLocalToDate, MONTHS } from './util.js';
import { normaliseWarnings, WARNINGS_URL } from './weather.js';

const MAX_AGE_MS = 5 * 24 * 3600 * 1000; // only show the last 5 days

async function rssSource(name, url, { filter = true } = {}) {
  const items = parseRSS(await fetchText(url));
  return items
    .filter((i) => i.title && (!filter || isStormy(i.title, i.text)))
    .map((i) => ({ source: name, title: i.title, text: truncate(i.text, 260), url: i.link, time: i.time }));
}

const bbc = () => rssSource('BBC Jersey', 'https://feeds.bbci.co.uk/news/world/europe/jersey/rss.xml');
const jep = () => rssSource('Jersey Evening Post', 'https://jerseyeveningpost.com/feed/');
const bex = () => rssSource('Bailiwick Express', 'https://www.bailiwickexpress.com/feed/');
const bbcg = () => rssSource('BBC Guernsey', 'https://feeds.bbci.co.uk/news/world/europe/guernsey/rss.xml');
const quarry = () => rssSource('The Quarry (Guernsey)', 'https://www.thequarry.media/rss/');

// gov.je has no news RSS any more, so read the news listing page.
async function govje() {
  const html = await fetchText('https://www.gov.je/News/Pages/default.aspx');
  const out = [];
  const re = /<li>\s*<h2 class="title">\s*<a href="([^"]+)">([\s\S]*?)<\/a><\/h2>[\s\S]*?<dd>([^<]+)<\/dd>[\s\S]*?<div class="teaser">([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1].startsWith('http') ? m[1] : 'https://www.gov.je' + m[1];
    const title = stripTags(m[2]);
    const text = stripTags(m[4]);
    const dm = m[3].trim().match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    let time = null;
    let dateOnly = true;
    if (dm) {
      const mo = MONTHS.indexOf(dm[2].toLowerCase());
      if (mo >= 0) time = jerseyLocalToDate(+dm[3], mo, +dm[1], 0, 0).toISOString();
    }
    if (isStormy(title, text)) out.push({ source: 'gov.je', title, text: truncate(text, 260), url, time, dateOnly });
  }
  // Pull the "Update: 6pm Wednesday 21 October" time out of the homepage card for the storm page if present.
  const card = html.match(/<a class="articleLink" href="([^"]*Storm[^"]*)">[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  if (card) {
    const txt = stripTags(card[2]);
    const um = txt.match(/Update:?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\s+\w+day\s+(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i);
    const target = out.find((o) => o.url.toLowerCase().endsWith(card[1].toLowerCase()));
    if (target) {
      target.text = truncate(txt, 260);
      if (um) {
        let h = +um[1] % 12 + (um[3].toLowerCase() === 'pm' ? 12 : 0);
        const mo = MONTHS.indexOf(um[5].toLowerCase());
        const year = new Date().getUTCFullYear();
        if (mo >= 0) { target.time = jerseyLocalToDate(year, mo, +um[4], h, +(um[2] || 0)).toISOString(); target.dateOnly = false; }
      }
    }
  }
  return out;
}

// Jersey Met warnings become feed items too.
const GSY_WARNINGS_URL = 'https://prodgojweatherstorage.blob.core.windows.net/data/GuernseyWarningStatusXML.json';
async function metWarnings() {
  const [j, g] = await Promise.allSettled([fetchJSON(WARNINGS_URL), fetchJSON(GSY_WARNINGS_URL)]);
  if (j.status === 'rejected' && g.status === 'rejected') throw j.reason;
  const all = [];
  const seen = new Set();
  for (const [r, place] of [[j, 'Jersey'], [g, 'Guernsey']]) {
    if (r.status !== 'fulfilled') continue;
    for (const x of normaliseWarnings(r.value)) {
      const island = /shipping area/i.test(x.type) ? 'Channel Islands' : (x.island || place);
      const key = `${island}|${x.type}|${x.colour}|${x.issued}`;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ ...x, island });
    }
  }
  return all.map((x) => ({
    source: 'Jersey Met',
    title: `${x.colour.toUpperCase()} ${x.type.replace(/warning/i, '').trim()} warning${/channel islands/i.test(x.type) ? '' : ` – ${x.island}`}`,
    text: truncate([x.text, x.validity].filter(Boolean).join(' — '), 280),
    url: (x.island === 'Jersey' || x.island === 'Channel Islands' ? 'https://www.gov.je/weather/' : 'https://www.gov.je/weather/guernsey-forecast/') + '#' + encodeURIComponent((x.island + '-' + x.kind).toLowerCase()),
    time: x.issuedAt,
    warning: x.colour,
  }));
}

// Bluesky public search. public.api.bsky.app sometimes refuses cloud IPs, so fall back to api.bsky.app.
const BSKY_HOSTS = ['https://public.api.bsky.app', 'https://api.bsky.app'];
const BSKY_QUERIES = ['Storm Austen Jersey', 'Storm Austen Guernsey', 'Storm Austen', 'Jersey storm', 'Guernsey storm', 'from:gov.je', 'from:today.je storm'];
const LOCAL_HANDLES = /(\.je$|^gov\.gg$|^gov\.je$|bbcjersey|bbcguernsey|jerseyeveningpost|guernseypress|channel103|islandfm|bailiwick|localtoguernsey|jerseymet|guernseymet|thequarry)/i;
const LOCAL_WORDS = /\b(jersey|guernsey|alderney|sark|herm|st\.? peter port|st\.? sampson'?s?|vale|castel|bailiwick|aurigny|gov\.gg|states of guernsey|st\.? helier|channel islands?|gorey|st\.? brelade|st\.? aubin|st\.? ouen|grouville|trinity|st\.? clement|st\.? saviour|jsy|la rocque|elizabeth castle|states of jersey|gov\.je)\b/i;
const NOT_LOCAL = /new jersey|jersey shore|\bnj\b|jersey city|north jersey|south jersey|nor'?easter|philadelphia|atlantic city/i;
const STORMY = /austen|\bwinds?\b|windy|gale|gust|weather|flood|heavy rain|red warning|amber warning|met office|jersey met|power cut|fallen tree|high tide/i;
// Mirror accounts that just repost news we already pull directly.
const MIRROR = (handle, text) => /xmirror\.bot$|^localtoguernsey/i.test(handle) || (handle === 'today.je' && /^\[(BBC Jersey|JEP News|Jersey Evening Post|Bailiwick Express|GOV\.JE News)\]/i.test(text));

async function bskySearch(q) {
  let lastErr;
  for (const host of BSKY_HOSTS) {
    try {
      const url = `${host}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=40&sort=latest`;
      const d = await fetchJSON(url, { timeout: 6000, headers: { Accept: 'application/json' } });
      return d.posts || [];
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function bskyMedia(e) {
  if (!e) return [];
  const t = e.$type || '';
  if (t.startsWith('app.bsky.embed.recordWithMedia')) return bskyMedia(e.media);
  if (t.startsWith('app.bsky.embed.images')) return (e.images || []).slice(0, 4).map((i) => ({ type: 'photo', url: i.fullsize || i.thumb, thumb: i.thumb, alt: i.alt || '' }));
  if (t.startsWith('app.bsky.embed.video')) return e.thumbnail ? [{ type: 'video', url: e.thumbnail, thumb: e.thumbnail, alt: e.alt || '' }] : [];
  if (t.startsWith('app.bsky.embed.external') && e.external) return e.external.thumb ? [{ type: 'link', url: e.external.thumb, thumb: e.external.thumb, alt: e.external.title || '', link: e.external.uri, title: e.external.title || '' }] : [];
  return [];
}

async function bluesky() {
  const results = await Promise.allSettled(BSKY_QUERIES.map(bskySearch));
  if (results.every((r) => r.status === 'rejected')) throw results[0].reason;
  const seen = new Set();
  const out = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const p of r.value) {
      if (!p || seen.has(p.uri)) continue;
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
        media: bskyMedia(p.embed),
        platform: 'bsky',
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
        time: (p.record && p.record.createdAt) || p.indexedAt,
      });
    }
  }
  return out;
}

const SOURCES = [
  ['BBC Jersey', bbc],
  ['BBC Guernsey', bbcg],
  ['gov.je', govje],
  ['Jersey Met warnings', metWarnings],
  ['Jersey Evening Post', jep],
  ['Bailiwick Express', bex],
  ['The Quarry (Guernsey)', quarry],
  ['Bluesky', bluesky],
];

export async function getFeed() {
  const now = Date.now();
  const settled = await Promise.allSettled(SOURCES.map(([, fn]) => fn()));
  const sources = [];
  let items = [];
  settled.forEach((r, i) => {
    const name = SOURCES[i][0];
    if (r.status === 'fulfilled') {
      sources.push({ name, ok: true, count: r.value.length });
      items.push(...r.value);
    } else {
      sources.push({ name, ok: false, count: 0, error: String((r.reason && r.reason.message) || r.reason).slice(0, 200) });
    }
  });
  items = items
    .filter((i) => i.time && !isNaN(new Date(i.time)))
    .map((i) => {
      // never show items "from the future" because of clock skew
      if (new Date(i.time).getTime() > now) i.time = new Date(now).toISOString();
      return i;
    })
    .filter((i) => now - new Date(i.time).getTime() < MAX_AGE_MS);
  // Guernsey-only items show only when they genuinely matter.
  const GSY = /guernsey|alderney|\bsark\b|\bherm\b|st\.? peter port|gov\.gg|states of guernsey/i;
  const JSY = /jersey|st\.? helier|gov\.je|channel islands/i;
  const IMPORTANT = /power cut|outage|power (?:is )?off|without power|injur|damage|airport closed|closed airport|airport.{0,20}clos|cancel+ed (?:flight|sailing)|(?:flight|sailing)s? (?:are |have been )?cancel|aurigny|condor|dfds|brittany ferries|ferr(?:y|ies)|emergency|red warning|red wind|evacuat|flood/i;
  items = items.filter((i) => {
    const t = `${i.source} ${i.title || ''} ${i.text || ''} ${i.handle || ''}`;
    const gsyOnly = /guernsey|quarry/i.test(i.source) || i.island === 'Guernsey' || (GSY.test(t) && !JSY.test(`${i.title || ''} ${i.text || ''}`));
    return !gsyOnly || IMPORTANT.test(`${i.title || ''} ${i.text || ''}`);
  });
  // Drop exact duplicate URLs
  const seen = new Set();
  items = items.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
  items.sort((a, b) => new Date(b.time) - new Date(a.time));
  items = items.slice(0, 150);
  return { items, sources, generatedAt: new Date(now).toISOString() };
}
