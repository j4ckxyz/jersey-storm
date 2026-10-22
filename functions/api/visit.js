// /api/visit on Cloudflare Pages: a privacy-friendly count of unique visitors, stored in D1 (binding VISITS_DB).
//   GET  -> { count, token }                read only; the token is a short-lived HMAC-signed ticket
//   POST -> { count, counted }              body { id, t }: a random ID the browser keeps in localStorage + a cookie,
//                                           plus a token fetched at least 3 s (at most 30 min) earlier
// Only a SHA-256 hash of the ID is stored. A new ID only counts if it passes, in order: same-origin request checks
// (Origin, Referer, Sec-Fetch-Site), a browser User-Agent, a non-data-centre network (request.cf.asn), a valid
// unused token, a salted per-day IP (IPv6: its /64) + User-Agent dedupe, and rate limits on new counts per IP per
// day and per network (/24, IPv6 /48) per hour. Limits and dedupe keys are salted hashes kept for about a day;
// raw IPs are never stored. Over a limit the API answers 429 without counting. Tables are created on first use.
const COUNT_HOSTS = ['storm.jsylabs.uk', 'jersey-storm.pages.dev'];
const BOT_RE = /bot|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|whatsapp|curl|wget|python|httpclient|http-client|axios|node-fetch|undici|go-http|java\/|okhttp|libwww|phantom|puppeteer|playwright|selenium|cypress/i;
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const TOKEN_RE = /^(\d{13})\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;
const TOKEN_MIN_MS = 3e3, TOKEN_MAX_MS = 30 * 60e3;
const IP_DAY_MAX = 20; // new counts per IP (IPv6 /64) per day; Jersey ISPs put many households behind one IPv4
const NET_HOUR_MAX = 30; // new counts per /24 (IPv6 /48) per hour
// Cloud and hosting networks (AWS, Google Cloud, Azure, DigitalOcean, Hetzner, OVH, Linode, Oracle, Vultr,
// Scaleway, Contabo, Leaseweb, Alibaba, Tencent, netcup, ColoCrossing). Not Cloudflare, Fastly or Akamai:
// iCloud Private Relay users arrive through those.
const DC_ASNS = new Set([16509, 14618, 8987, 15169, 396982, 19527, 8075, 8068, 14061, 24940, 213230, 16276, 63949,
  31898, 20473, 12876, 51167, 60781, 16265, 28753, 45102, 132203, 197540, 36352]);

const schema = (p) => [
  `CREATE TABLE IF NOT EXISTS ${p}visitors (id_hash TEXT PRIMARY KEY, first_seen TEXT NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS ${p}daily (fp TEXT PRIMARY KEY, day TEXT NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS ${p}limits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, day TEXT NOT NULL) WITHOUT ROWID`,
  `CREATE TABLE IF NOT EXISTS ${p}meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO ${p}meta (k, v) VALUES ('count', '0')`,
  `INSERT OR IGNORE INTO ${p}meta (k, v) VALUES ('salt', lower(hex(randomblob(32))))`,
];

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

const enc = (s) => new TextEncoder().encode(s);
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Expand an IPv6 address and keep its first `groups` groups ("a:b:c:d::/64"); IPv4 stays whole or becomes its /24
function prefix(ip, groups, v4octets) {
  if (!ip.includes(':')) return v4octets === 4 ? ip : ip.split('.').slice(0, v4octets).join('.') + '.0/24';
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return full.slice(0, groups).map((x) => x.replace(/^0+(?=.)/, '')).join(':') + `::/${groups * 16}`;
}

async function withSchema(db, p, fn) {
  try { return await fn(); } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) throw e;
    await db.batch(schema(p).map((q) => db.prepare(q)));
    return fn();
  }
}

async function readMeta(db, p) {
  const { results } = await db.prepare(`SELECT k, v FROM ${p}meta WHERE k IN ('count', 'salt')`).all();
  const m = Object.fromEntries(results.map((r) => [r.k, r.v]));
  return { count: Number(m.count) || 0, salt: m.salt || '' };
}

const keys = new Map();
function hmacKey(secret) {
  if (!keys.has(secret)) keys.set(secret, crypto.subtle.digest('SHA-256', enc(`visit-token|${secret}`))
    .then((raw) => crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])));
  return keys.get(secret);
}
const sign = async (secret, ts, nonce, ua) => b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc(`v1|${ts}|${nonce}|${ua}`)));

async function makeToken(secret, ua) {
  const ts = String(Date.now());
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  return `${ts}.${nonce}.${await sign(secret, ts, nonce, ua)}`;
}

// -> nonce if the token is genuine, issued to this User-Agent, and between 3 s and 30 min old; otherwise null
async function checkToken(secret, token, ua) {
  const m = typeof token === 'string' && TOKEN_RE.exec(token);
  if (!m) return null;
  const age = Date.now() - Number(m[1]);
  if (age < TOKEN_MIN_MS || age > TOKEN_MAX_MS) return null;
  const want = await sign(secret, m[1], m[2], ua);
  let diff = want.length ^ m[3].length;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ m[3].charCodeAt(i);
  return diff ? null : m[2];
}

async function record(ctx, cfg, id, token, ua) {
  const db = ctx.env.VISITS_DB;
  const p = cfg.prefix;
  const now = new Date().toISOString();
  const day = now.slice(0, 10), hour = now.slice(0, 13);
  const { count, salt } = await readMeta(db, p);
  const nonce = await checkToken(ctx.env.VISIT_SECRET || salt, token, ua);
  if (!nonce) return [{ error: 'bad token' }, 403];

  const idHash = await sha256(`visit:${id}`);
  const seen = await db.prepare(`SELECT 1 AS x FROM ${p}visitors WHERE id_hash = ?`).bind(idHash).first('x');
  if (seen) return [{ count, counted: false }]; // this browser was already counted

  const once = (k) => db.prepare(`INSERT OR IGNORE INTO ${p}daily (fp, day) VALUES (?, ?)`).bind(k, day).run().then((r) => r.meta.changes > 0);
  if (!(await once(await sha256(`${salt}|nonce|${nonce}`)))) return [{ count, counted: false }, 429]; // token replayed

  const rememberId = () => db.prepare(`INSERT OR IGNORE INTO ${p}visitors (id_hash, first_seen) VALUES (?, ?)`).bind(idHash, day);
  // Same device on the same day under a fresh ID (private window, cleared storage)?
  if (!(await once(await sha256(`${salt}|${day}|${prefix(cfg.ip, 4, 4)}|${ua}`)))) {
    await rememberId().run();
    return [{ count, counted: false }];
  }

  const bump = (k) => db.prepare(`INSERT INTO ${p}limits (k, n, day) VALUES (?, 1, ?) ON CONFLICT (k) DO UPDATE SET n = n + 1 RETURNING n`).bind(k, day);
  const over = async (k, max) => { const h = await sha256(k); return (await withSchema(db, p, () => bump(h).first('n'))) > max; };
  if (await over(`${salt}|ip|${day}|${prefix(cfg.ip, 4, 4)}`, IP_DAY_MAX)) return [{ count, counted: false }, 429];
  if (await over(`${salt}|net|${hour}|${prefix(cfg.ip, 3, 3)}`, NET_HOUR_MAX)) return [{ count, counted: false }, 429];

  const [, bumped] = await db.batch([rememberId(), db.prepare(`UPDATE ${p}meta SET v = CAST(v AS INTEGER) + 1 WHERE k = 'count' RETURNING v`)]);
  if (Math.random() < 0.02) { // keep roughly one day of dedupe and limit rows
    const cut = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    ctx.waitUntil(db.batch([db.prepare(`DELETE FROM ${p}daily WHERE day < ?`).bind(cut), db.prepare(`DELETE FROM ${p}limits WHERE day < ?`).bind(cut)]).catch(() => {}));
  }
  return [{ count: Number(bumped.results[0].v) || 0, counted: true }];
}

export async function onRequest(ctx) {
  const { request: req, env } = ctx;
  const method = req.method;
  if (method !== 'GET' && method !== 'POST') return json({ error: 'method not allowed' }, 405, { Allow: 'GET, POST' });
  if (!env.VISITS_DB) return json({ error: 'not configured' }, 503);
  const db = env.VISITS_DB;
  const url = new URL(req.url);
  const cfg = {
    prefix: '',
    countHost: COUNT_HOSTS.includes(url.hostname),
    asn: Number(req.cf && req.cf.asn) || 0,
    ip: req.headers.get('CF-Connecting-IP') || '',
  };
  const ua = req.headers.get('User-Agent') || '';
  try {
    // TEMP, branch only, never merged: VISIT_TEST=1 counts preview/local hosts into separate t_ tables
    if (env.VISIT_TEST === '1') {
      cfg.prefix = 't_';
      cfg.countHost = /\.jersey-storm\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(url.hostname);
      if (req.headers.get('X-Test-ASN')) cfg.asn = Number(req.headers.get('X-Test-ASN'));
      if (req.headers.get('X-Test-IP')) cfg.ip = req.headers.get('X-Test-IP');
      const secret = req.headers.get('X-Test-Cleanup');
      if (secret && method === 'POST' && Date.now() < Number(env.VISIT_TEST_UNTIL || 0) && (await sha256(secret)) === env.VISIT_TEST_CLEANUP_SHA) {
        await db.batch(['visitors', 'daily', 'limits', 'meta'].map((t) => db.prepare(`DROP TABLE IF EXISTS t_${t}`)));
        return json({ dropped: true });
      }
    }
    if (method === 'GET') {
      const { count, salt } = await withSchema(db, cfg.prefix, () => readMeta(db, cfg.prefix));
      return json({ count, token: await makeToken(env.VISIT_SECRET || salt, ua) });
    }

    if (Number(req.headers.get('Content-Length') || 0) > 512) return json({ error: 'too large' }, 413);
    const text = await req.text();
    if (text.length > 512) return json({ error: 'too large' }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { /* fall through */ }
    const id = body && body.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) return json({ error: 'bad id' }, 400);

    const referer = req.headers.get('Referer');
    const site = req.headers.get('Sec-Fetch-Site');
    if (req.headers.get('Origin') !== url.origin || (referer && !referer.startsWith(url.origin + '/')) || (site && site !== 'same-origin')) {
      return json({ error: 'forbidden' }, 403);
    }
    const quiet = async () => json({ count: (await withSchema(db, cfg.prefix, () => readMeta(db, cfg.prefix))).count, counted: false });
    if (!cfg.countHost || !ua || BOT_RE.test(ua) || DC_ASNS.has(cfg.asn)) return quiet();
    const [out, status = 200] = await withSchema(db, cfg.prefix, () => record(ctx, cfg, id, body.t, ua));
    return json(out, status);
  } catch (e) {
    return json({ error: 'unavailable' }, 503);
  }
}
