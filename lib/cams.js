// Live webcams: which ipcamlive.com server and stream each camera is on right now. ipcamlive's own player page
// (player.php) writes these into its script as `address = 'http://s46.ipcamlive.com/'` and `streamid = '…'`; they
// change when a camera reconnects, so they're read fresh rather than hard-coded. The page has no CORS headers,
// hence this function. It returns JSON only: the browser then plays the HLS stream straight from ipcamlive (which
// sends Access-Control-Allow-Origin: *), so no video ever passes through here. The camera list is fixed, so this
// can't be used to fetch anything else.
import { fetchText, withDeadline } from './util.js';

export const CAMS = ['69b3d2ab49e7d', '69b43d50d3820', '5cd3eb0ba2d30', '667152e6e359f'];

async function stream(alias) {
  const html = await fetchText(`https://g2.ipcamlive.com/player/player.php?alias=${alias}`, { timeout: 5000 });
  // the page sets several addresses (player and fallback hosts); the stream server is the last sNN one
  const hosts = [...html.matchAll(/address\s*=\s*'https?:\/\/(s\d{1,4}\.ipcamlive\.com)\/'/g)].map((m) => m[1]);
  const id = (html.match(/streamid\s*=\s*'([a-z0-9]{8,40})'/) || [])[1];
  if (!hosts.length || !id) throw new Error('camera offline or page changed');
  const base = `https://${hosts[hosts.length - 1]}/streams/${id}`;
  return { alias, ok: true, hls: `${base}/stream.m3u8`, snapshot: `${base}/snapshot.jpg` };
}

export async function getCams() {
  const res = await Promise.allSettled(CAMS.map((a) => withDeadline(stream(a), 7000, a)));
  return {
    cams: res.map((r, i) => (r.status === 'fulfilled' ? r.value : { alias: CAMS[i], ok: false, error: String((r.reason && r.reason.message) || r.reason).slice(0, 200) })),
    generatedAt: new Date().toISOString(),
  };
}
