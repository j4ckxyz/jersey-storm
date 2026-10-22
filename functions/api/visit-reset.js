// TEMPORARY, branch only, never merged: clears visitor-counter test rows. Preview hosts only, secret-gated, expires.
const HASH = '5d22d46a1bca5d55fbc1766f17510ce6913ec57e64b9877b8d038b9e80b0db9c';
const EXPIRES = 1792693377000;
async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function onRequestPost({ request, env }) {
  const host = new URL(request.url).hostname;
  if (Date.now() > EXPIRES || !host.endsWith('.jersey-storm.pages.dev')) return new Response('gone', { status: 410 });
  if ((await sha256(request.headers.get('X-Reset-Key') || '')) !== HASH) return new Response('forbidden', { status: 403 });
  const db = env.VISITS_DB;
  await db.batch([db.prepare('DELETE FROM visitors'), db.prepare('DELETE FROM daily'), db.prepare("UPDATE meta SET v = '0' WHERE k = 'count'")]);
  const r = await db.prepare("SELECT (SELECT count(*) FROM visitors) AS visitors, (SELECT count(*) FROM daily) AS daily, (SELECT v FROM meta WHERE k = 'count') AS count").first();
  return Response.json(r);
}
