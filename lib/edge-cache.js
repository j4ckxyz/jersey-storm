// Cloudflare only: stands in for Vercel's CDN s-maxage and stale-while-revalidate using the Cache API
// (caches.default), so each data centre fetches the upstream sites at most once per s-maxage instead of once per
// visitor. Like Vercel's edge, browsers get the Cache-Control without the CDN-only directives.
//   - fresh (younger than s-maxage): served from cache.
//   - stale but within stale-while-revalidate: served from cache straight away, and rebuilt in the background
//     (ctx.waitUntil), so no visitor waits on a slow upstream site just because the copy expired.
//   - older, or not cached: built now.
// (The Cache API does nothing on *.pages.dev URLs; it works on the custom domain.)
const CLIENT_CC = 'X-Client-Cache-Control';
const STORED_AT = 'X-Stored-At';
const refreshing = new Set(); // keys this isolate is already rebuilding, so a burst of visitors starts one rebuild

const directive = (cc, name) => Number((new RegExp(`${name}=(\\d+)`).exec(cc) || [])[1]) || 0;

async function build(ctx, key, make) {
  const r = await make();
  const cc = r.headers['Cache-Control'] || '';
  const ttl = directive(cc, 's-maxage');
  const swr = directive(cc, 'stale-while-revalidate');
  const clientCC = cc.split(',').map((d) => d.trim()).filter((d) => d && !/^(s-maxage|stale-while-revalidate)=/.test(d)).join(', ');
  // _headers only covers static files, so add nosniff here to match vercel.json
  const headers = { ...r.headers, 'Cache-Control': clientCC, 'X-Content-Type-Options': 'nosniff' };
  const res = new Response(r.body, { status: r.status, headers });
  if (ttl > 0) {
    const stored = new Response(res.clone().body, {
      status: r.status,
      headers: { ...headers, 'Cache-Control': `public, max-age=${ttl + swr}`, [CLIENT_CC]: clientCC, [STORED_AT]: String(Date.now()), 'X-Fresh-For': String(ttl) },
    });
    ctx.waitUntil(cache().put(key, stored).catch(() => {}));
  }
  return res;
}
const cache = () => caches.default;

export async function serve(ctx, key, make) {
  const hit = await cache().match(key).catch(() => null);
  if (hit) {
    const age = (Date.now() - Number(hit.headers.get(STORED_AT) || 0)) / 1000;
    const fresh = age <= Number(hit.headers.get('X-Fresh-For') || 0);
    if (!fresh && !refreshing.has(key)) {
      refreshing.add(key);
      ctx.waitUntil(build(ctx, key, make).catch(() => {}).finally(() => refreshing.delete(key)));
    }
    const headers = new Headers(hit.headers);
    headers.set('Cache-Control', headers.get(CLIENT_CC) || 'no-store');
    headers.set('Age', String(Math.max(0, Math.round(age))));
    for (const h of [CLIENT_CC, STORED_AT, 'X-Fresh-For']) headers.delete(h);
    return new Response(hit.body, { status: hit.status, headers });
  }
  return build(ctx, key, make);
}
