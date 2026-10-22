// Vercel only: writes a { status, headers, body } result from lib/handlers.js to the Node response.
// The leading underscore stops Vercel deploying this file as a function.
export function send(res, r) {
  for (const [k, v] of Object.entries(r.headers)) res.setHeader(k, v);
  res.status(r.status).send(typeof r.body === 'string' ? r.body : Buffer.from(r.body));
}
