// Serves an X user's profile picture from our own origin, so content blockers
// that block pbs.twimg.com on third-party sites don't hide it.
//   ?u=<pbs.twimg.com profile image URL>  proxy a known avatar (no lookup)
//   ?id=<tweet id>                         look up the current avatar via the tweet
//                                          syndication API, then proxy it
// Only pbs.twimg.com/profile_images URLs are ever fetched, so this is not an open proxy.

const AVATAR = /^https:\/\/pbs\.twimg\.com\/profile_images\/[\w-]+\/[\w.-]+\.(jpe?g|png|webp|gif)$/i;
const MAX_BYTES = 2 * 1024 * 1024;

// Same token the embed widget computes for tweet-result.
const token = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

async function lookup(id) {
  const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token(id)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (jersey-storm-tracker)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`syndication ${r.status}`);
  const data = await r.json();
  const user = data.user || (data.tweet && data.tweet.user) || {};
  return String(user.profile_image_url_https || '').replace(/_normal(\.\w+)$/, '_bigger$1');
}

async function image(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.startsWith('image/')) throw new Error(`image ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('too big');
  return { type, buf };
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const id = String(q.id || '');
  const u = String(q.u || '');
  if (!(AVATAR.test(u) || /^\d{5,25}$/.test(id))) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(400).send('bad request');
  }
  try {
    const url = AVATAR.test(u) ? u : await lookup(id);
    if (!AVATAR.test(url)) throw new Error('no avatar');
    const { type, buf } = await image(url);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).send(buf);
  } catch (e) {
    // short cache so a blip at X doesn't stick, but repeat misses stay cheap
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(404).send('not found');
  }
};
