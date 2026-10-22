import { fetchJSON, jerseyLocalToDate, MONTHS } from './util.js';

export const FORECAST_URL = 'https://prodgojweatherstorage.blob.core.windows.net/data/jerseyForecast.json';
export const WARNINGS_URL = 'https://prodgojweatherstorage.blob.core.windows.net/data/JerseyWarningStatusXML.json';

// Parse "Issued at 02:44 UTC Thursday 22 October 2026" or "Issued at 2:28 a.m. Thursday 22 October 2026."
function parseIssued(s) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?|UTC|GMT|BST)?\s*\w*day\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!m) return null;
  let h = +m[1];
  const mi = +m[2];
  const suf = (m[3] || '').toLowerCase().replace(/\./g, '');
  if (suf === 'pm' && h < 12) h += 12;
  if (suf === 'am' && h === 12) h = 0;
  const mo = MONTHS.indexOf(m[5].toLowerCase());
  if (mo < 0) return null;
  const d = suf === 'utc' || suf === 'gmt' ? new Date(Date.UTC(+m[6], mo, +m[4], h, mi)) : jerseyLocalToDate(+m[6], mo, +m[4], h, mi);
  return isNaN(d) ? null : d.toISOString();
}

export function normaliseWarnings(w) {
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
      issuedAt: parseIssued(d.Issued),
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

export async function getWeather() {
  const [fc, wr] = await Promise.allSettled([fetchJSON(FORECAST_URL), fetchJSON(WARNINGS_URL)]);
  const sources = {
    forecast: fc.status === 'fulfilled' ? { ok: true } : { ok: false, error: String(fc.reason && fc.reason.message || fc.reason) },
    warnings: wr.status === 'fulfilled' ? { ok: true } : { ok: false, error: String(wr.reason && wr.reason.message || wr.reason) },
  };
  let forecast = null;
  try { if (fc.status === 'fulfilled') forecast = normaliseForecast(fc.value); } catch (e) { sources.forecast = { ok: false, error: 'parse: ' + e.message }; }
  let warnings = [];
  try { if (wr.status === 'fulfilled') warnings = normaliseWarnings(wr.value); } catch (e) { sources.warnings = { ok: false, error: 'parse: ' + e.message }; }
  return {
    forecast,
    warnings,
    warningsChecked: wr.status === 'fulfilled' ? wr.value.lastChecked || null : null,
    sources,
    generatedAt: new Date().toISOString(),
  };
}
