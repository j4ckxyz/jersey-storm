// Redirects to an X user's current profile picture, looked up through the
// public tweet syndication API (the one embedded tweets use). Takes ?id=<tweet id>.
// Only ever redirects to pbs.twimg.com, so it cannot be used as an open redirect.

// Same token the embed widget computes for tweet-result.
const token = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '');
  if (!/^\d{5,25}$/.test(id)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(400).send('bad id');
  }
  try {
    const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token(id)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (jersey-storm-tracker)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(`syndication ${r.status}`);
    const data = await r.json();
    const user = data.user || (data.tweet && data.tweet.user) || {};
    let url = String(user.profile_image_url_https || '');
    if (!/^https:\/\/pbs\.twimg\.com\//.test(url)) throw new Error('no avatar');
    url = url.replace(/_normal(\.\w+)$/, '_bigger$1');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Location', url);
    return res.status(302).end();
  } catch (e) {
    // short cache so a blip at X doesn't stick, but repeat misses stay cheap
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    return res.status(404).send('not found');
  }
};
