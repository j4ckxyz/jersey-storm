// Getting on and off the island: Jersey Airport flights and St Helier harbour sailings, from the same public
// JSON files that jerseyairport.com and ports.je load in the browser. Both CDNs cache hard, so like those
// sites we add a time parameter to get the current file.
import { fetchJSON, jerseyLocalToDate } from './util.js';

const FLIGHTS_URL = 'https://cdn.ports.je/data/airportArrivals48h.json'; // arrivals and departures, 48 hours
// ports.je's own arrivals-departures page reads this "test-cdn" host; there's no copy on cdn.ports.je
const HARBOUR_URL = 'https://test-cdn.ports.je/data/GetHarbourLive.json';
const bust = (url) => `${url}?t=${Date.now()}`;

// "2026-10-22 07:05" or "2026-10-22T07:05:00" in Jersey local time → ISO, or null
function localIso(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? jerseyLocalToDate(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).toISOString() : null;
}
const text = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const title = (s) => text(s).toLowerCase().replace(/(^|[\s(-])\S/g, (c) => c.toUpperCase());

function flightKind(status, at) {
  const s = status.toLowerCase();
  if (/cancel/.test(s)) return 'cancelled';
  if (/divert/.test(s)) return 'diverted';
  if (/delay/.test(s)) return 'delayed';
  if (/landed|airborne|departed/.test(s)) return 'done';
  const est = s.match(/estimated\s+(\d{1,2}):(\d{2})/);
  if (est && at) {
    // "Estimated 09:49" on the scheduled day; 15+ minutes late counts as delayed
    const d = new Date(at);
    const local = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Jersey', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).split(':').map(Number);
    const late = (+est[1] * 60 + +est[2]) - (local[0] * 60 + local[1]);
    if (late >= 15 && late < 12 * 60) return 'delayed';
  }
  return 'ok';
}

function normaliseFlights(d) {
  if (!d || (!Array.isArray(d.FlightArrivalDetails) && !Array.isArray(d.FlightDepartureDetails))) throw new Error('unexpected flights file');
  const rows = (list, dir) => (Array.isArray(list) ? list : []).map((f) => {
    const at = localIso(f.Date);
    const status = text(f.Status) || 'As scheduled';
    return { dir, at, flight: text(f.Flightnumber), airline: text(f.Airline), place: text(dir === 'arr' ? f.From : f.To), status, kind: flightKind(status, at) };
  }).filter((f) => f.at && f.flight);
  return {
    updated: text(d.Updated), // "22 Oct 2026 21:15", Jersey time, as the site shows it
    flights: [...rows(d.FlightArrivalDetails, 'arr'), ...rows(d.FlightDepartureDetails, 'dep')].sort((a, b) => a.at.localeCompare(b.at)),
  };
}

const PASSENGER = /PAX|HSC/i; // RORO PAX: car and passenger ferry; RORO HSC: fast passenger craft
function normaliseHarbour(d) {
  if (!d || !Array.isArray(d.HarbourData)) throw new Error('unexpected harbour file');
  const seen = new Set();
  const sailings = d.HarbourData.map((x) => {
    const dir = /^ARR/i.test(x.MoveType) ? 'arr' : 'dep';
    const move = text(x.MovementStatus).toUpperCase();
    const st = text(x.Status).toLowerCase();
    const kind = move === 'CANCELLED' || st === 'cancelled' ? 'cancelled' : move === 'COMPLETED' || /arrived|departed/.test(st) ? 'done' : /delay/.test(st) || move === 'PENDING' ? 'delayed' : 'ok';
    const at = localIso(x.Scheduled);
    return {
      dir,
      at,
      estimated: localIso(x.Estimated),
      vessel: title(x.Vessel),
      port: title(dir === 'arr' ? x.FromPort : x.ToPort),
      passenger: PASSENGER.test(x.VisitReason || ''),
      status: kind === 'cancelled' ? 'Cancelled' : kind === 'done' ? (dir === 'arr' ? 'Arrived' : 'Departed') : kind === 'delayed' ? 'Delayed' : st === 'estimated' ? 'Expected' : 'Scheduled',
      reason: text(x.DelayReason),
      kind,
    };
  }).filter((s) => {
    const k = `${s.dir}|${s.vessel}|${s.at}`;
    return s.at && s.vessel && !seen.has(k) && seen.add(k);
  }).sort((a, b) => a.at.localeCompare(b.at));
  return { updated: localIso(d.Updated), sailings };
}

export async function getTravel() {
  const [f, h] = await Promise.allSettled([
    fetchJSON(bust(FLIGHTS_URL)).then(normaliseFlights),
    fetchJSON(bust(HARBOUR_URL)).then(normaliseHarbour),
  ]);
  const ok = (r) => (r.status === 'fulfilled' ? { ok: true } : { ok: false, error: String(r.reason && r.reason.message || r.reason) });
  return {
    flights: f.status === 'fulfilled' ? f.value : null,
    harbour: h.status === 'fulfilled' ? h.value : null,
    sources: { flights: ok(f), harbour: ok(h) },
    generatedAt: new Date().toISOString(),
  };
}
