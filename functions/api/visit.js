// /api/visit on Cloudflare Pages: a privacy-friendly count of unique visitors, stored in D1 (binding VISITS_DB).
//   GET  -> { count }                       read only, used once a browser has been counted
//   POST -> { count, counted }              body { id }: a random ID the browser keeps in localStorage + a cookie
// Only a SHA-256 hash of the ID is stored. To limit inflation from private windows and cleared storage, a new ID
// is also checked against a salted hash of IP + User-Agent + day; those rows are kept for the current UTC day only
// and raw IPs are never stored. Bots, preview and local hosts are not counted. Tables are created on first use.
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS visitors (id_hash TEXT PRIMARY KEY, first_seen TEXT NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS daily (fp TEXT PRIMARY KEY, day TEXT NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
  "INSERT OR IGNORE INTO meta (k, v) VALUES ('count', '0')",
  "INSERT OR IGNORE INTO meta (k, v) VALUES ('salt', lower(hex(randomblob(32))))",
];
const COUNT_HOSTS = ['storm.jsylabs.uk', 'jersey-storm.pages.dev'];
const BOT_RE = /bot|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|whatsapp|curl|wget|python|httpclient|http-client|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|phantom|puppeteer|playwright|selenium|cypress/i;
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function withSchema(db, fn) {
  try { return await fn(); } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await db.batch(SCHEMA.map((q) => db.prepare(q)));
    return fn();
  }
}

const readCount = (db) => db.prepare("SELECT v FROM meta WHERE k = 'count'").first('v').then((v) => Number(v) || 0);

async function record(ctx, id) {
  const db = ctx.env.VISITS_DB;
  const req = ctx.request;
  const day = new Date().toISOString().slice(0, 10);
  const idHash = await sha256(`visit:${id}`);
  const added = await db.prepare('INSERT OR IGNORE INTO visitors (id_hash, first_seen) VALUES (?, ?)').bind(idHash, day).run();
  if (!added.meta.changes) return { count: await readCount(db), counted: false }; // this browser was already counted

  // New ID: is it the same device on the same day under a fresh ID (private window, cleared storage)?
  const salt = await db.prepare("SELECT v FROM meta WHERE k = 'salt'").first('v');
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const fp = await sha256(`${salt}|${day}|${ip}|${req.headers.get('User-Agent') || ''}`);
  const fresh = await db.prepare('INSERT OR IGNORE INTO daily (fp, day) VALUES (?, ?)').bind(fp, day).run();
  if (!fresh.meta.changes) return { count: await readCount(db), counted: false };

  const row = await db.prepare("UPDATE meta SET v = CAST(v AS INTEGER) + 1 WHERE k = 'count' RETURNING v").first('v');
  if (Math.random() < 0.02) ctx.waitUntil(db.prepare('DELETE FROM daily WHERE day < ?').bind(day).run().catch(() => {})); // keep only today
  return { count: Number(row) || 0, counted: true };
}

export async function onRequest(ctx) {
  const { request: req, env } = ctx;
  const method = req.method;
  if (method !== 'GET' && method !== 'POST') return json({ error: 'method not allowed' }, 405, { Allow: 'GET, POST' });
  if (!env.VISITS_DB) return json({ error: 'not configured' }, 503);
  const db = env.VISITS_DB;
  try {
    if (method === 'GET') return json({ count: await withSchema(db, () => readCount(db)) });

    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
    if (Number(req.headers.get('Content-Length') || 0) > 256) return json({ error: 'too large' }, 413);
    const text = await req.text();
    if (text.length > 256) return json({ error: 'too large' }, 413);
    let id;
    try { id = JSON.parse(text).id; } catch (e) { /* fall through */ }
    if (typeof id !== 'string' || !ID_RE.test(id)) return json({ error: 'bad id' }, 400);

    const ua = req.headers.get('User-Agent') || '';
    const countable = (COUNT_HOSTS.includes(url.hostname) || env.VISIT_COUNT_ANY_HOST === '1') && ua && !BOT_RE.test(ua);
    if (!countable) return json({ count: await withSchema(db, () => readCount(db)), counted: false });
    return json(await withSchema(db, () => record(ctx, id)));
  } catch (e) {
    return json({ error: 'unavailable' }, 503);
  }
}
