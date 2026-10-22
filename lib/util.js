// Shared helpers for the API functions (no dependencies). ES module using only web APIs
// (fetch, AbortSignal, Intl), so it runs on Cloudflare Pages Functions and Vercel's Node runtime.
export const UA = 'Mozilla/5.0 (compatible; JerseyStormTracker/2.0; +https://storm.jsylabs.uk)';

export async function fetchText(url, { timeout = 5000, headers = {} } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Resolves like `promise`, or rejects after `ms`. fetchText's own timeout covers a single request; this caps a
// whole source, which may make several requests or spend time parsing.
export function withDeadline(promise, ms, name = 'source') {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${name} took longer than ${ms / 1000} s`)), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export async function fetchJSON(url, opts) {
  const t = await fetchText(url, opts);
  return JSON.parse(t.replace(/^\uFEFF/, ''));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', pound: '£' };
export function decode(s = '') {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENTITIES ? ENTITIES[n.toLowerCase()] : m));
}
export function stripTags(s = '') {
  return decode(decode(s).replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, ' ').replace(/<[^>]*>/g, ' ')).replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
export function parseRSS(xml) {
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
export function isStormy(...parts) {
  return STORM_RE.test(parts.filter(Boolean).join(' '));
}

export function truncate(s, n = 280) {
  s = (s || '').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// Convert a wall-clock time in Europe/Jersey to a Date (handles BST/GMT).
// Jersey follows UK clock rules: BST (UTC+1) from 01:00 UTC on the last Sunday in March until
// 01:00 UTC on the last Sunday in October. Worked out directly rather than with an Intl time-zone
// formatter, whose first use costs ~8 ms of CPU on a cold isolate (the Workers free plan allows 10 ms).
const lastSundayAt1UTC = (y, mo) => {
  const last = new Date(Date.UTC(y, mo + 1, 0));
  return Date.UTC(y, mo, last.getUTCDate() - last.getUTCDay(), 1);
};
export function jerseyLocalToDate(y, mo, d, h = 0, mi = 0) {
  const wall = Date.UTC(y, mo, d, h, mi);
  const bst = wall - 3600e3 >= lastSundayAt1UTC(y, 2) && wall < lastSundayAt1UTC(y, 9); // repeated 1am in October counts as GMT
  return new Date(wall - (bst ? 3600e3 : 0));
}
export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
