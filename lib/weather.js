import { fetchJSON, jerseyLocalToDate, MONTHS } from './util.js';

export const FORECAST_URL = 'https://prodgojweatherstorage.blob.core.windows.net/data/jerseyForecast.json';
export const WARNINGS_URL = 'https://prodgojweatherstorage.blob.core.windows.net/data/JerseyWarningStatusXML.json';

// Parse "Issued at 02:44 UTC Thursday 22 October 2026" or "Issued at 2:28 a.m. Thursday 22 October 2026.".
// When the text gives a time but no date, the date comes from `fileDate` (the warnings file's own lastChecked);
// without that, there's no reliable date, so it returns null rather than guessing today.
function parseIssued(s, fileDate) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?|UTC|GMT|BST)?(?:\s*\w*day\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}))?/i);
  if (!m) return null;
  let h = +m[1];
  const mi = +m[2];
  const suf = (m[3] || '').toLowerCase().replace(/\./g, '');
  if (suf === 'pm' && h < 12) h += 12;
  if (suf === 'am' && h === 12) h = 0;
  const utc = suf === 'utc' || suf === 'gmt';
  const at = (y, mo, d) => (utc ? new Date(Date.UTC(y, mo, d, h, mi)) : jerseyLocalToDate(y, mo, d, h, mi));
  let d;
  if (m[4]) {
    const mo = MONTHS.indexOf(m[5].toLowerCase());
    if (mo < 0) return null;
    d = at(+m[6], mo, +m[4]);
  } else {
    const f = fileDate ? new Date(fileDate) : null;
    if (!f || isNaN(f)) return null;
    // the file's calendar date (UTC for a UTC time, else Jersey's), and a warning can't be issued after the check
    const parts = utc ? [f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()]
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Jersey', year: 'numeric', month: '2-digit', day: '2-digit' }).format(f).split('-').map((x, i) => +x - (i === 1 ? 1 : 0));
    d = at(...parts);
    if (d - f > 3600e3) d = new Date(d - 864e5);
  }
  return isNaN(d) ? null : d.toISOString();
}

export function normaliseWarnings(w) {
  const fileDate = w && w.lastChecked;
  const out = [];
  if (!w || typeof w !== 'object') return out;
  const kinds = [
    ['WindWarning', 'WindWarningData', 'Wind'],
    ['ThunderWarning', 'ThunderWarningData', 'Thunderstorm'],
    ['ThunderstormWarningALD', 'ThunderstormWarningALDData', 'Thunderstorm'],
    ['TideWarning', 'TideWarningData', 'Tide'],
    ['SnowWarning', 'SnowWarningData', 'Snow'],
    ['SnowAlert', 'SnowAlertData', 'Snow'],
    ['IceWarning', 'IceWarningData', 'Ice'],
  ];
  for (const [flag, dataKey, label] of kinds) {
    if (!w[flag] || !w[dataKey]) continue;
    const d = w[dataKey];
    out.push({
      type: d.WarningType || `${label} warning`,
      island: d.Island || '',
      kind: label,
      colour: String(d.Colour || '').toLowerCase() || 'yellow',
      issued: d.Issued || '',
      issuedAt: parseIssued(d.Issued, fileDate),
      validity: String(d.Validity || '').replace(/\s+/g, ' ').trim(),
      text: d.WarningMessage || d.WarningText || '',
      impacts: Array.isArray(d.Impacts) ? d.Impacts : [],
      extra: d.ExtraInfo || '',
    });
  }
  return out;
}

const n = (v) => {
  const x = parseFloat(String(v ?? '').replace(/[^\d.-]/g, ''));
  return isNaN(x) ? null : x;
};
function gustsFrom(...texts) {
  let max = null;
  for (const t of texts) {
    for (const m of String(t || '').matchAll(/gusts?\s+(?:of\s+|up\s+to\s+|to\s+)*(\d{2,3})\s*mph/gi)) max = Math.max(max ?? 0, +m[1]);
  }
  return max;
}

function normaliseForecast(f) {
  const days = (f.forecastDay || []).map((d) => {
    const periods = [
      ['Morning', d.morningDescripiton, d.morningWindDescripiton, d.windDirectionMorning, d.windSpeedForceMorning, d.windspeedMphMorning, d.rainProbMorning],
      ['Afternoon', d.afternoonDescripiton, d.afternoonWindDescripiton, d.windDirectionAfternoon, d.windSpeedForceAfternoon, d.windspeedMphAfternoon, d.rainProbAfternoon],
      ['Night', d.nightDescripiton, d.nightWindDescripiton, d.windDirectionEvening, d.windSpeedForceEvening, d.windspeedMphEvening, d.rainProbEvening],
    ].map(([name, desc, wind, dir, force, mph, rain]) => ({ name, desc: desc || '', wind: wind || '', dir: dir || '', force: force || '', mph: n(mph), rain: n(rain), gustMph: gustsFrom(wind) }));
    return {
      day: d.dayName,
      summary: d.summary || d.dayToolTip || '',
      icon: d.dayToolTip || '',
      max: n(d.maxTemp),
      min: n(d.minTemp),
      windDescription: d.windDescription || '',
      windDir: d.windDirection,
      windForce: d.windSpeed,
      windMph: n(d.windSpeedMPH),
      maxGustMph: gustsFrom(d.windDescription, d.morningWindDescripiton, d.afternoonWindDescripiton, d.nightWindDescripiton),
      maxRain: Math.max(...periods.map((p) => p.rain ?? 0)),
      sunrise: d.sunRise,
      sunset: d.sunSet,
      uv: d.uvIndex,
      periods,
    };
  });
  return {
    currentTemp: n(f.currentTemprature),
    issued: `${f.forecastTime || f.issuetime || ''} ${f.forecastDate || ''}`.trim(),
    days,
  };
}

// The page at gov.je/weather/jerseywarnings/ is a static Gatsby shell (it always reads "no weather warnings in force"
// in its HTML); its browser code fills the warnings in from WARNINGS_URL. So /api/warnings reads that same file.
export const WARNINGS_PAGE = 'https://www.gov.je/weather/jerseywarnings/';
const RANK = { red: 0, amber: 1, orange: 1, yellow: 2 };
export async function getWarnings() {
  const raw = await fetchJSON(WARNINGS_URL);
  const warnings = normaliseWarnings(raw)
    .sort((a, b) => (RANK[a.colour] ?? 3) - (RANK[b.colour] ?? 3))
    .map((w) => {
      // "Channel Islands Shipping Area Wind" → "Red wind warning · Channel Islands Shipping Area"
      const area = w.type.replace(new RegExp(`\\s*${w.kind}(\\s+warning)?$`, 'i'), '').trim();
      const title = `${w.colour[0].toUpperCase()}${w.colour.slice(1)} ${w.kind.toLowerCase()} warning${area ? ` · ${area}` : ''}`;
      return { colour: w.colour, title, issuedAt: w.issuedAt, summary: w.text, sea: /shipping|sea area|marine|inshore|waters|small craft/i.test(`${w.type} ${w.island}`) };
    });
  return { warnings, checkedAt: raw.lastChecked || null, source: WARNINGS_PAGE, generatedAt: new Date().toISOString() };
}

export async function getWeather() {
  const sources = { forecast: { ok: true } };
  let forecast = null;
  try { forecast = normaliseForecast(await fetchJSON(FORECAST_URL)); } catch (e) { sources.forecast = { ok: false, error: String(e && e.message || e) }; }
  return { forecast, sources, generatedAt: new Date().toISOString() };
}
