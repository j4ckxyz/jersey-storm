# Jersey Storm Tracker

A single-page live tracker for Storm Austen in Jersey and Guernsey (October 2026). It shows a sourced "What's happening" summary, Jersey Met warnings and forecast (gusts, wind, rain), a timeline of grouped storm events, and a merged live feed of local news, gov.je, Jersey Met, Bluesky and X posts. All times are shown in Europe/Jersey time.

Live at **https://storm.jsylabs.uk** (Cloudflare Pages). The old Vercel deployment (https://jersey-storm-tracker.vercel.app) stays up until the switch is complete.

## File layout

```
index.html, app.js, style.css   Frontend (plain HTML/CSS/JS, no framework)
404.html                        Not-found page
summary.json                    "What's happening" box. Rewritten by the scheduled runs
x-posts.json                    X posts merged into the feed. Rewritten by the scheduled runs
events.json                     Grouped storm events for the timeline. Rewritten by the scheduled runs
functions/api/*.js              Cloudflare Pages Functions: /api/feed, /api/weather, /api/warnings, /api/obs, /api/travel, /api/x-avatar
lib/*.js                        Shared API logic (ES modules, web APIs only), used by both runtimes
lib/edge-cache.js               Cloudflare Cache API layer (stands in for Vercel's s-maxage)
build.mjs                       Copies the public files into dist/ and checks the data files
_headers                        Cloudflare Pages response headers for static files
wrangler.toml                   Cloudflare Pages config (output dir, compatibility date)
api/*.js, vercel.json           Legacy Vercel functions and config, kept until the switch
og.png, tools/og.html           Social share card (2400×1260) and its HTML source; the regenerate command is in og.html
tools/build_x_posts.py          Builds x-posts.json from saved X search results
tools/prepare_deploy.py         Legacy: prepares a Vercel direct-upload deployment
DATA.md                         Data contract: schemas for every JSON file and API
UPDATE.md                       Runbook for the scheduled refresh
```

## Deployment

Cloudflare Pages (free plan) is connected to this GitHub repo. **Every push to `main` builds and deploys production** at https://storm.jsylabs.uk. Pushes to other branches get preview URLs on `*.pages.dev`.

Pages project settings:

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `node build.mjs` |
| Build output directory | `dist` (also set by `pages_build_output_dir` in `wrangler.toml`) |
| Root directory | `/` |
| Custom domain | `storm.jsylabs.uk` |

`build.mjs` copies only the public files (the page, icons and the three data files) into `dist/`. As a result, `lib/`, `tools/`, `api/`, the Markdown files and the config are never served. The functions in `functions/` are deployed alongside the static files. Only `/api/*` requests run a function, so static files never use the daily request allowance. If `summary.json` or `x-posts.json` is broken, the build fails and Pages keeps serving the previous deployment. An invalid `events.json` only produces a warning, because the page falls back to the post feed.

`/api/feed` and `/api/warnings` are fresh for 1 minute per Cloudflare data centre and then served stale for up to 2 more while one background rebuild runs; `/api/weather` and `/api/travel` are cached for 2 minutes, `/api/obs` for 5 minutes (the tide table inside `/api/obs` for an hour), and `/api/x-avatar` for up to a week. This uses the Cache API (`lib/edge-cache.js`), so the upstream sites aren't hit on every visit. Browsers receive the same `Cache-Control` headers as they did from Vercel. The Cache API only works on the custom domain, not on `*.pages.dev`.

Everything stays within the free plan: there's no KV, D1 or other paid feature. Two limits to keep in mind are 500 builds a month, where each data commit is one build, and 100,000 function requests a day.

### Asset caching

The `storm.jsylabs.uk` zone has a Cloudflare **Browser Cache TTL** that overrides `_headers` for JS and CSS, which are then cached for 4 hours. It doesn't apply to the HTML at `/`. Without versioned names, iOS Safari would keep old JS and CSS next to a fresh page, leaving skeletons stuck, tiles empty and detailed-only cards visible. So:

- **Hashed names.** `node build.mjs` writes `app.<hash>.js`, `style.<hash>.css` and `bsky.<hash>.js` (the first 10 hex characters of the content's SHA-256) and points `dist/index.html` and `dist/404.html` at them. `app.js` imports bsky by its hashed name. The unhashed names are also written, with the same content, for HTML cached before a deploy.
- **Headers.** `_headers` gives the hashed files `max-age=31536000, immutable`, the HTML `no-cache, must-revalidate`, and the unhashed copies `max-age=0`.
- **Build check.** `index.html` carries `<meta name="build-id">`, and the built `app.js` carries the same `BUILD_ID`. If they differ, the page reloads once per build id, guarded by sessionStorage `storm-reloaded`, so it can't loop. A few seconds after load, the page also fetches `/` once and does the same if a newer build is live.
- **Reload button.** If our script fails during boot, or a part is still a skeleton after 15 s, the placeholders become "Something went wrong — tap to reload".

Local dev without a build, such as `python3 -m http.server`, serves the source files as they are. There, `BUILD_ID` is still the placeholder `__BUILD_ID__`, so the build checks are skipped.

## Run locally

The whole site, including the functions, runs with Wrangler:

```sh
npm run dev           # node build.mjs && npx wrangler@4 pages dev → http://localhost:8788
```

After changing any public file or data file, run `node build.mjs` again. Changes in `functions/` and `lib/` reload by themselves.

For the frontend only, any static server works (`python3 -m http.server 8000`). In that case `/api/feed` and `/api/weather` return 404, and the page shows the summary, events and X posts, with "Forecast unavailable".

## Automated updates

Until **Friday 23 October 2026 (night)**, the assistant's scheduled runs rewrite `summary.json`, `x-posts.json` and `events.json` every few hours. They follow `UPDATE.md`, and they only push data commits to `main`, which Cloudflare Pages then deploys. Don't hand-edit those three files during that window, because your changes will be overwritten. You can change the UI (`index.html`, `app.js`, `style.css`) freely, as long as it follows the contract in **[DATA.md](DATA.md)**.

See [DATA.md](DATA.md) for the data contract and [UPDATE.md](UPDATE.md) for the refresh process.
