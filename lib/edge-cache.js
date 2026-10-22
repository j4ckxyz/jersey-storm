// Cloudflare only: stands in for Vercel's CDN s-maxage using the Cache API (caches.default), so each
// data centre fetches the upstream sites at most once per s-maxage instead of once per visitor.
// Like Vercel's edge, browsers get the Cache-Control without the CDN-only s-maxage and
// stale-while-revalidate directives; the edge copy is kept for s-maxage seconds.
// (The Cache API does nothing on *.pages.dev URLs; it works on the custom domain.)
const CLIENT_CC = 'X-Client-Cache-Control';

export async function serve(ctx, key, build) {
  const cache = caches.default;
  const hit = await cache.match(key).catch(() => null);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set('Cache-Control', headers.get(CLIENT_CC) || 'no-store');
    headers.delete(CLIENT_CC);
    return new Response(hit.body, { status: hit.status, headers });
  }
  const r = await build();
  const cc = r.headers['Cache-Control'] || '';
  const ttl = Number((/s-maxage=(\d+)/.exec(cc) || [])[1]);
  const clientCC = cc.split(',').map((d) => d.trim()).filter((d) => d && !/^(s-maxage|stale-while-revalidate)=/.test(d)).join(', ');
  // _headers only covers static files, so add nosniff here to match vercel.json
  const headers = { ...r.headers, 'Cache-Control': clientCC, 'X-Content-Type-Options': 'nosniff' };
  const res = new Response(r.body, { status: r.status, headers });
  if (ttl > 0) {
    const stored = new Response(res.clone().body, { status: r.status, headers: { ...headers, 'Cache-Control': `public, max-age=${ttl}`, [CLIENT_CC]: clientCC } });
    ctx.waitUntil(cache.put(key, stored).catch(() => {}));
  }
  return res;
}
