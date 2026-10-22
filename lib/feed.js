import { fetchText, fetchJSON, parseRSS, isStormy, stripTags, truncate, jerseyLocalToDate, MONTHS, withDeadline } from './util.js';
import { normaliseWarnings, WARNINGS_URL } from './weather.js';
import { QUERIES, searchUrl, toItems, guernseyRule } from '../bsky.js';

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

// Bluesky search. The queries and the filter live in /bsky.js, shared with the browser, which polls Bluesky
// itself every minute; this server copy is the fallback when the browser can't reach Bluesky.
async function bluesky() {
  const results = await Promise.allSettled(QUERIES.map((q) => fetchJSON(searchUrl(q), { timeout: 5000, headers: { Accept: 'application/json' } })));
  if (results.every((r) => r.status === 'rejected')) throw results[0].reason;
  return toItems(results.flatMap((r) => (r.status === 'fulfilled' && Array.isArray(r.value.posts) ? r.value.posts : [])));
}

// [name, fetcher, deadline in ms]. Each source gets its own deadline, so one slow site only drops its own items
// instead of holding up the whole response; the slowest normal source answers in about 1.5 s.
const SOURCES = [
  ['BBC Jersey', bbc, 5000],
  ['BBC Guernsey', bbcg, 5000],
  ['gov.je', govje, 6000],
  ['Jersey Met warnings', metWarnings, 4000],
  ['Jersey Evening Post', jep, 5000],
  ['Bailiwick Express', bex, 5000],
  ['The Quarry (Guernsey)', quarry, 5000],
  ['Bluesky', bluesky, 6000],
];

export async function getFeed() {
  const now = Date.now();
  const settled = await Promise.allSettled(SOURCES.map(([name, fn, ms]) => withDeadline(fn(), ms, name)));
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
  // Guernsey-only items show only when they genuinely matter (rule shared with the browser, in /bsky.js).
  items = items.filter(guernseyRule);
  // Drop exact duplicate URLs
  const seen = new Set();
  items = items.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
  items.sort((a, b) => new Date(b.time) - new Date(a.time));
  items = items.slice(0, 150);
  return { items, sources, generatedAt: new Date(now).toISOString() };
}
