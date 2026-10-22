const { getWeather } = require('../lib/weather');

module.exports = async (req, res) => {
  try {
    const data = await getWeather();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ forecast: null, warnings: [], sources: { error: String(e.message || e) }, generatedAt: new Date().toISOString() });
  }
};
