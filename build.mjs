// Builds dist/, the only folder Cloudflare Pages serves. Copying an allowlist (rather than serving the
// repo root) keeps lib/, tools/, api/, *.md and other internal files off the public site.
// No dependencies: `node build.mjs`. It also checks the data files, so a broken summary.json or
// x-posts.json fails the build and Pages keeps serving the previous deployment.
// It then content-hashes app.js, style.css and bsky.js (app.<hash>.js, ...) and points the HTML at those, so a
// browser can never pair a fresh page with yesterday's script: the Cloudflare zone's Browser Cache TTL keeps
// unversioned JS and CSS for up to 4 hours whatever _headers says. See "Asset caching" in README.md.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'dist';
const FILES = [
  'index.html', '404.html', 'app.js', 'style.css', '_headers',
  'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'og.png',
  'summary.json', 'x-posts.json', 'events.json', 'bsky.js',
];
const OPTIONAL = ['sources.json', 'config.json']; // see DATA.md, "Extending the data"

const json = (f) => JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, ''));
function check(cond, msg) { if (!cond) { console.error(`build: ${msg}`); process.exit(1); } }

const s = json('summary.json');
check(s.headline && s.updatedAt && Array.isArray(s.sections), 'summary.json needs headline, updatedAt and sections');
const x = json('x-posts.json');
check(Array.isArray(x.posts), 'x-posts.json needs a posts list');
for (const p of x.posts) for (const k of ['id', 'handle', 'text', 'time', 'url']) check(k in p, `x-posts.json post missing ${k}: ${p.url}`);
// events.json is optional for the page (it falls back to the post feed), so only warn
try { check(Array.isArray(json('events.json').events), 'events.json needs an events list'); } catch (e) { console.warn(`build: warning: events.json is not valid JSON (${e.message}); the page will show the post feed`); }

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of [...FILES, ...OPTIONAL.filter((f) => existsSync(f))]) cpSync(f, `${OUT}/${f}`);
console.log(`build: copied ${FILES.length} files to ${OUT}/`);

// --- content-hashed assets ---
const hash = (text, n = 10) => createHash('sha256').update(text).digest('hex').slice(0, n);
const read = (f) => readFileSync(`${OUT}/${f}`, 'utf8');
function swap(text, from, to, what) {
  check(text.includes(from), `${what} has no ${from} to rewrite`);
  return text.split(from).join(to);
}

// bsky.js first: app.js imports it by name, so its hashed name goes into app.js before app.js is hashed
const bsky = read('bsky.js');
const bskyName = `bsky.${hash(bsky)}.js`;
const css = read('style.css');
const cssName = `style.${hash(css)}.css`;
let app = swap(read('app.js'), "import('/bsky.js')", `import('/${bskyName}')`, 'app.js');
// one id for the whole set (from app.js before the id goes in, so it isn't circular); app.js compares it with the
// page's <meta name="build-id"> and reloads once if they differ
const buildId = hash([hash(bsky), hash(css), hash(app)].join(' '), 12);
app = swap(app, "const BUILD_ID = '__BUILD_ID__';", `const BUILD_ID = '${buildId}';`, 'app.js');
const appName = `app.${hash(app)}.js`;

// hashed copies, plus the unhashed names with the same content, so HTML cached before this deploy still loads
for (const [name, text] of [[bskyName, bsky], [cssName, css], [appName, app], ['app.js', app]]) writeFileSync(`${OUT}/${name}`, text);

const html = (f) => {
  let t = read(f);
  if (t.includes('href="/style.css"')) t = swap(t, 'href="/style.css"', `href="/${cssName}"`, f);
  if (t.includes('src="/app.js"')) t = swap(t, 'src="/app.js"', `src="/${appName}"`, f);
  if (f === 'index.html') t = swap(t, '<meta charset="utf-8">', `<meta charset="utf-8">\n<meta name="build-id" content="${buildId}">`, f);
  writeFileSync(`${OUT}/${f}`, t);
};
html('index.html');
html('404.html');
console.log(`build: ${appName}, ${cssName}, ${bskyName} · build ${buildId}`);
