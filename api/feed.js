const { getFeed } = require('../lib/feed');

module.exports = async (req, res) => {
  try {
    const data = await getFeed();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ items: [], sources: [{ name: 'feed', ok: false, error: String(e.message || e) }], generatedAt: new Date().toISOString() });
  }
};
