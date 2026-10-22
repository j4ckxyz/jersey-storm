// Shared helpers for the serverless functions (no dependencies).
const UA = 'Mozilla/5.0 (compatible; JerseyStormTracker/2.0; +https://jersey-storm-tracker.vercel.app)';

async function fetchText(url, { timeout = 8000, headers = {} } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchJSON(url, opts) {
  const t = await fetchText(url, opts);
  return JSON.parse(t.replace(/^\uFEFF/, ''));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', pound: '£' };
function decode(s = '') {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m));
}
function stripTags(s = '') {
  return decode(decode(s).replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, ' ').replace(/<[^>]*>/g, ' ')).replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function parseRSS(xml) {
  const items = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml))) {
    const it = m[0];
    const title = stripTags(tag(it, 'title'));
    let link = stripTags(tag(it, 'link')) || stripTags(tag(it, 'guid'));
    const date = stripTags(tag(it, 'pubDate')) || stripTags(tag(it, 'dc:date'));
    const desc = stripTags(tag(it, 'description'));
    const time = date ? new Date(date) : null;
    items.push({ title, link, text: desc, time: time && !isNaN(time) ? time.toISOString() : null });
  }
  return items;
}

// Storm/weather relevance filter for news.
// Storm/weather relevance filter for news: needs a core storm/weather word.
const STORM_RE = /\b(storm|storms|austen|wind|winds|windy|gale|gales|gust|gusts|gusting|weather|met office|jersey met|flood|flooding|heavy rain|rainfall|red warning|amber warning|yellow warning|wind warning|fallen trees?|trees? down|power cuts?|high tide)\b/i;
function isStormy(...parts) {
  return STORM_RE.test(parts.filter(Boolean).join(' '));
}

function truncate(s, n = 280) {
  s = (s || '').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// Convert a wall-clock time in Europe/Jersey to a Date (handles BST/GMT).
function jerseyLocalToDate(y, mo, d, h = 0, mi = 0) {
  const guess = Date.UTC(y, mo, d, h, mi);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Jersey', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asLocal = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return new Date(guess - (asLocal - guess));
}
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

module.exports = { UA, fetchText, fetchJSON, decode, stripTags, parseRSS, isStormy, truncate, jerseyLocalToDate, MONTHS };
