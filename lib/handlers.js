// Runtime-neutral responses for the API routes: { status, headers, body }.
// api/*.js (Vercel) and functions/api/*.js (Cloudflare Pages) only translate these to their runtime.
import { getFeed } from './feed.js';
import { getWarnings, getWeather } from './weather.js';
import { getObs } from './obs.js';
import { getTravel } from './travel.js';

export { avatarResponse } from './x-avatar.js';

const JSON_TYPE = 'application/json; charset=utf-8';
const LIVE_CACHE = 'public, max-age=60, s-maxage=120, stale-while-revalidate=600';
const FIVE_MIN_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'; // the edge asks upstream at most every 5 min
// The feed and warnings are what people refresh for: fresh for a minute per data centre, then served stale for up
// to 2 more minutes while one background rebuild runs (lib/edge-cache.js), so nobody waits on the upstream sites.
const FEED_CACHE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=120';
const WARNINGS_CACHE = 'public, max-age=30, s-maxage=60, stale-while-revalidate=120';

export async function feedResponse() {
  try {
    return { status: 200, headers: { 'Cache-Control': FEED_CACHE, 'Content-Type': JSON_TYPE }, body: JSON.stringify(await getFeed()) };
  } catch (e) {
    const body = { items: [], sources: [{ name: 'feed', ok: false, error: String(e.message || e) }], generatedAt: new Date().toISOString() };
    return { status: 200, headers: { 'Cache-Control': 'no-store', 'Content-Type': JSON_TYPE }, body: JSON.stringify(body) };
  }
}

export async function weatherResponse() {
  try {
    return { status: 200, headers: { 'Cache-Control': LIVE_CACHE, 'Content-Type': JSON_TYPE }, body: JSON.stringify(await getWeather()) };
  } catch (e) {
    const body = { forecast: null, sources: { error: String(e.message || e) }, generatedAt: new Date().toISOString() };
    return { status: 200, headers: { 'Cache-Control': 'no-store', 'Content-Type': JSON_TYPE }, body: JSON.stringify(body) };
  }
}

// On failure: 502 with no-store, so the page hides the banner and the next poll tries again.
export async function warningsResponse() {
  try {
    return { status: 200, headers: { 'Cache-Control': WARNINGS_CACHE, 'Content-Type': JSON_TYPE }, body: JSON.stringify(await getWarnings()) };
  } catch (e) {
    return { status: 502, headers: { 'Cache-Control': 'no-store', 'Content-Type': JSON_TYPE }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
}

// METAR changes every 30 minutes; the tide part is cached for an hour inside getObs.
export async function obsResponse() {
  try {
    const obs = await getObs();
    // a part that failed is retried after a minute rather than held for five
    const partial = Object.values(obs.sources).some((x) => !x.ok);
    return { status: 200, headers: { 'Cache-Control': partial ? 'public, max-age=30, s-maxage=60' : FIVE_MIN_CACHE, 'Content-Type': JSON_TYPE }, body: JSON.stringify(obs) };
  } catch (e) {
    return { status: 502, headers: { 'Cache-Control': 'no-store', 'Content-Type': JSON_TYPE }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
}

// Flights and sailings change minute to minute during disruption: 2 minutes at the edge, like /api/feed.
export async function travelResponse() {
  try {
    const t = await getTravel();
    const partial = Object.values(t.sources).some((x) => !x.ok);
    return { status: 200, headers: { 'Cache-Control': partial ? 'public, max-age=30, s-maxage=60' : LIVE_CACHE, 'Content-Type': JSON_TYPE }, body: JSON.stringify(t) };
  } catch (e) {
    return { status: 502, headers: { 'Cache-Control': 'no-store', 'Content-Type': JSON_TYPE }, body: JSON.stringify({ error: String(e.message || e) }) };
  }
}
