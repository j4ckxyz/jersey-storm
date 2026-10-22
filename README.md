# Jersey Storm Tracker

A single-page live tracker for Storm Austen in Jersey and Guernsey (October 2026). It shows a sourced "What's happening" summary, Jersey Met warnings and forecast (gusts, wind, rain), and a merged live feed of local news, gov.je, Jersey Met, Bluesky and X posts. All times are shown in Europe/Jersey time.

Live at **https://jersey-storm-tracker.vercel.app** (Vercel project `jersey-storm-tracker`).

## File layout

```
index.html, app.js, style.css   Frontend (plain HTML/CSS/JS, no build step)
summary.json                    "What's happening" box. Rewritten by the automated refresh
x-posts.json                    X posts merged into the feed. Rewritten by the automated refresh
api/feed.js                     GET /api/feed: news, gov.je, Jersey Met warnings, Bluesky
api/weather.js                  GET /api/weather: Jersey Met forecast and warnings
lib/feed.js, lib/weather.js, lib/util.js   Shared code for the functions (no dependencies)
tools/build_x_posts.py          Builds x-posts.json from saved X search results
tools/prepare_deploy.py         Validates the JSON files and prepares upload hashes (.deploy/)
vercel.json, package.json       Vercel config (Node 24, cache headers)
DATA.md                         Data contract: schemas for every JSON file and API
UPDATE.md                       Runbook for the automated refresh and redeploy
```

## Run locally

To get the full site, including the API functions:

```sh
npx vercel dev        # http://localhost:3000
```

For the frontend only, use a simple static server:

```sh
python3 -m http.server 8000   # or: npx serve .
```

With a static server, `summary.json` and `x-posts.json` load, but `/api/feed` and `/api/weather` are Vercel serverless functions and return 404. The page then shows the summary and X posts, with "Forecast unavailable" in the weather section. Use `vercel dev` (or the deployed site) to test the APIs.

## Deployment

The site is currently deployed by **Vercel direct upload** (files are uploaded and `create_deployment` is called; see `UPDATE.md`). There is no Git integration yet. It can later be linked to the GitHub repo https://github.com/j4ckxyz/jersey-storm so that pushes deploy automatically.

## Automated updates

Until **Friday 23 October 2026 (night)**, an automated assistant refreshes `summary.json` and `x-posts.json` every few hours and redeploys, following `UPDATE.md`. Don't hand-edit those two files in that window, because your changes will be overwritten. You can change the UI (`index.html`, `app.js`, `style.css`) freely, as long as it follows the contract in **[DATA.md](DATA.md)**.

See [DATA.md](DATA.md) for the data contract and [UPDATE.md](UPDATE.md) for the refresh process.
