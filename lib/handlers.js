// Runtime-neutral responses for the API routes: { status, headers, body }.
// api/*.js (Vercel) and functions/api/*.js (Cloudflare Pages) only translate these to their runtime.
import { getFeed } from './feed.js';
import { getWarnings, getWeather } from './weather.js';

export { avatarResponse } from './x-avatar.js';

const JSON_TYPE = 'application/json; charset=utf-8';
const LIVE_CACHE = 'public, max-age=60, s-maxage=120, stale-while-revalidate=600';
const WARNINGS_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'; // the edge asks gov.je at most every 5 min

export async function feedResponse() {
  try {
    return { status: 200, headers: { 'Cache-Control': LIVE_CACHE, 'Content-Type': JSON_TYPE }, body: JSON.stringify(await getFeed()) };
  } catch (e) {
    const body = { items: [], sources: [{ name: 'feed', ok: false, error: String(e.message || e) }], generatedAt: new Date().toISOString() };
    return { status: 200, headers: { 'Cache-Control': 'no-store', 'Content-Type': JSON_TYPE }, body: JSON.stringify(body) };
  }
}

export async function weatherResponse() {
  try {
    return { status: 200, headers: { 'Cache-Control': LIVE_CACHE, 'Content-Type': JSON_TYPE }, body: JSON.stringify(await getWeather()) };
  } catch (e) {
    const body = { forecast: null, warnings: [], sources: { error: String(e.message || e) }, generatedAt: new Date().toISOString() };
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
