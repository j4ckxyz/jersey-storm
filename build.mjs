// Builds dist/, the only folder Cloudflare Pages serves. Copying an allowlist (rather than serving the
// repo root) keeps lib/, tools/, api/, *.md and other internal files off the public site.
// No dependencies: `node build.mjs`. It also checks the data files, so a broken summary.json or
// x-posts.json fails the build and Pages keeps serving the previous deployment.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const OUT = 'dist';
const FILES = [
  'index.html', '404.html', 'app.js', 'style.css', '_headers',
  'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'og.png',
  'summary.json', 'x-posts.json', 'events.json',
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
