// Live observations for the "Right now" tiles and the detailed view: the latest Jersey Airport METAR
// (aviationweather.gov), St Helier tide times (the gov.je tide table) and the update times of Jersey Met's
// radar, satellite and wind-and-wave images. Each part fails on its own; the page hides what's missing.
import { fetchJSON, jerseyLocalToDate, UA } from './util.js';

const METAR_URL = 'https://aviationweather.gov/api/data/metar?ids=EGJJ&format=json&hours=4';
// The gov.je tide table page (https://www.gov.je/weather/tidetimes/) loads its data from this function; the code is
// the public one in that page's own script.
const TIDES_URL = 'https://prd-eun-goj-weather-site-rg.azurewebsites.net/api/GetTides?code=l1Rh9oPZ2dTyseXOkBCa69ZryuKaUjAGT0ZzkoGrDGhu4E3rvX5ZOg==&page=0';
const IMG_BASE = 'https://sojpublicdata.blob.core.windows.net/jerseymet/';
// The newest frame of each loop on gov.je/weather: Radar10 is the latest radar, Satellite10 the latest satellite,
// and "Wind Waves 2018 49" is the T+0 wind-and-wave chart.
const IMAGES = { radar: 'Radar10.JPG', satellite: 'Satellite10.JPG', waves: 'Wind%20Waves%202018%2049.png' };

// Small TTL cache: the data centre's Cache API where there is one (Cloudflare), else this instance's memory.
const memo = new Map();
async function cached(name, ttl, load) {
  const key = `https://cache.internal/${name}`;
  const m = memo.get(key);
  if (m && Date.now() - m.at < ttl * 1000) return m.value;
  const edge = typeof caches !== 'undefined' && caches.default;
  if (edge) {
    const hit = await edge.match(key).catch(() => null);
    if (hit) { const value = await hit.json(); memo.set(key, { at: Date.now(), value }); return value; }
  }
  const value = await load();
  memo.set(key, { at: Date.now(), value });
  if (edge) await edge.put(key, new Response(JSON.stringify(value), { headers: { 'Cache-Control': `public, max-age=${ttl}`, 'Content-Type': 'application/json' } })).catch(() => {});
  return value;
}

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
// METAR visibility group in metres ("6000", "9999" = 10 km or more), from the raw report
function visibilityM(raw) {
  const m = String(raw || '').match(/\bKT\b(?:\s+\d{3}V\d{3})?\s+(\d{4})(?:NDV)?\b/) || String(raw || '').match(/\s(\d{4})\s/);
  return m ? +m[1] : null;
}

function normaliseMetar(list) {
  const obs = (Array.isArray(list) ? list : []).filter((o) => o && o.icaoId === 'EGJJ' && num(o.obsTime)).sort((a, b) => b.obsTime - a.obsTime);
  if (!obs.length) throw new Error('no EGJJ report');
  const o = obs[0];
  // pressure change over about the last 3 hours (METARs are every 30 minutes)
  const target = o.obsTime - 3 * 3600;
  const past = obs.filter((p) => num(p.altim) != null && p.obsTime <= target + 600).sort((a, b) => Math.abs(a.obsTime - target) - Math.abs(b.obsTime - target))[0];
  return {
    time: new Date(o.obsTime * 1000).toISOString(),
    windDir: num(o.wdir), // degrees true; null when variable ("VRB")
    windKt: num(o.wspd),
    gustKt: num(o.wgst),
    visibilityM: visibilityM(o.rawOb),
    tempC: num(o.temp),
    dewC: num(o.dewp),
    pressureHpa: num(o.altim),
    pressureChange: past && num(o.altim) != null ? { hpa: Math.round((o.altim - past.altim) * 10) / 10, hours: Math.round((o.obsTime - past.obsTime) / 360) / 10 } : null,
    weather: typeof o.wxString === 'string' ? o.wxString : '',
    clouds: Array.isArray(o.clouds) ? o.clouds.filter((c) => c && c.cover).map((c) => ({ cover: c.cover, baseFt: num(c.base) })) : [],
    raw: typeof o.rawOb === 'string' ? o.rawOb : '',
  };
}

// [{date:"2026-10-22T00:00:00", tideTimes:[{time:"04:22", height:"8.4", highLow:"High water"}]}] → times in Jersey local time
function normaliseTides(days) {
  const out = [];
  for (const d of Array.isArray(days) ? days : []) {
    const dm = String(d && d.date || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dm) continue;
    for (const t of Array.isArray(d.tideTimes) ? d.tideTimes : []) {
      const tm = String(t && t.time || '').match(/^(\d{1,2}):(\d{2})$/);
      const h = parseFloat(t && t.height);
      if (!tm || isNaN(h)) continue;
      out.push({ at: jerseyLocalToDate(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2]).toISOString(), high: /high/i.test(t.highLow || t.highLowShort || ''), heightM: h });
    }
  }
  if (!out.length) throw new Error('no tide times');
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

async function imageTimes() {
  const out = {};
  await Promise.all(Object.entries(IMAGES).map(async ([k, file]) => {
    const url = IMG_BASE + file;
    try {
      const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
      const lm = r.ok && r.headers.get('Last-Modified');
      out[k] = { url, updatedAt: lm && !isNaN(new Date(lm)) ? new Date(lm).toISOString() : null };
    } catch (e) { out[k] = { url, updatedAt: null }; }
  }));
  return out;
}

export async function getObs() {
  const [m, t, i] = await Promise.allSettled([
    fetchJSON(METAR_URL).catch(() => fetchJSON(METAR_URL)).then(normaliseMetar), // one retry: the API has brief 502s
    cached('tides-v1', 3600, async () => normaliseTides(await fetchJSON(TIDES_URL))),
    imageTimes(),
  ]);
  const ok = (r) => (r.status === 'fulfilled' ? { ok: true } : { ok: false, error: String(r.reason && r.reason.message || r.reason) });
  // from early today onwards: enough for "next high tide" and today's and tomorrow's table
  const from = Date.now() - 24 * 3600e3;
  return {
    metar: m.status === 'fulfilled' ? m.value : null,
    tides: t.status === 'fulfilled' ? t.value.filter((x) => new Date(x.at) >= from).slice(0, 12) : null,
    images: i.status === 'fulfilled' ? i.value : null,
    sources: { metar: ok(m), tides: ok(t), images: ok(i) },
    generatedAt: new Date().toISOString(),
  };
}
