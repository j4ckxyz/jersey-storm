# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The website is the product. There's no native app.

## Users

Jersey and Guernsey islanders following a storm as it happens. Most are on phones, many are older, and some are on weak signal or low battery while the storm is on. They come back again and again to answer three questions: how bad is it right now, what's closed or cancelled, and what's coming next.

## Product Purpose

A live, sourced storm tracker for Jersey (with Guernsey where it matters to Jersey readers). It brings together, on one page:
- the official warnings and forecast;
- a plain-English summary;
- a timeline of what's happened;
- the underlying local news and posts.

Islanders no longer have to check gov.je, Jersey Met, the BBC, the JEP, ferry and airline accounts and social media separately.

Success means a reader can see the current danger and the latest disruption at a glance, trust it, and open the original source in one tap.

It's a **reusable storm tracker**. Storm Austen (22–23 October 2026) is the first named storm it covers, and future storms should reuse it rather than starting again.

## Positioning

An unofficial, local, sourced view. Every factual claim links to its source, and nothing is invented. It groups many official and media sources into events and adds a human summary. It always points readers back to official advice (gov.je, Jersey Met) rather than replacing it.

## Operating Context

- Read on phones during the storm, often one-handed, sometimes in poor conditions (power cuts, weak mobile signal).
- Data refresh is part of the product:
  - Live feeds update themselves: BBC Jersey and Guernsey, gov.je, Jersey Met forecast and warnings, the JEP, Bailiwick Express, The Quarry and Bluesky.
  - The assistant's scheduled runs rewrite `summary.json`, `x-posts.json` and `events.json` every few hours while the storm is on. The runbook is `UPDATE.md`.
- All times are shown in Europe/Jersey time.

## Capabilities and Constraints

- **Surfaces:**
  - the "Right now" panel (gusts, warnings, latest item);
  - the "What's happening" summary, with Key updates;
  - a timeline of grouped events, with severity, category and sources;
  - the full post and news feed behind "Show all posts";
  - the Jersey Met forecast;
  - useful links and emergency information.
- **Data contract:** `DATA.md` defines every JSON shape and API. The UI must tolerate missing optional fields and fall back gracefully, for example from the events timeline to the post feed.
- **Stack:** plain HTML, CSS and JS, with no framework and no build step beyond copying files. Small serverless functions provide `/api/feed`, `/api/weather` and `/api/x-avatar`. It's hosted on Cloudflare Pages on the free plan at https://storm.jsylabs.uk, and every push to `main` deploys. Staying free is a constraint. The old Vercel deployment stays up until it's retired.
- **Terminology:** "warning" means a Jersey Met warning (yellow, amber or red). Marine and shipping warnings are kept separate from warnings on land.
- **Undecided:** how the tracker moves between storms. The storm name and storm-specific wording are currently hard-coded in places, for example the page title, the copy, and the feed's search terms and filters ("Austen"). It's also undecided what happens to a storm's page and data once it's over (archive or reset).

## Brand Commitments

- **Name:** "Storm Austen" for the current storm, presented as a Jersey and Guernsey tracker. It's an unofficial tracker, made in Jersey.
- **Voice:** neighbourly, steady, local. It should read like a trusted islander keeping everyone posted: warmer than a corporate news app, but calm and credible. Use island names and places (parishes, St Helier, St Peter Port, harbours) rather than generic tracker boilerplate.
- **Never alarmist.** Severity comes from official warnings, not from the product's own tone.
- British English throughout.

## Evidence on Hand

- **Real sources only:** Jersey Met (gov.je), BBC Jersey and Guernsey, the Jersey Evening Post, Bailiwick Express, The Quarry, Bluesky, X, and operator accounts such as DFDS, Aurigny, Ports of Jersey and Jersey Electricity.
- There are no testimonials, user numbers, partnerships or official endorsements. Future work must not imply any.

## Product Principles

1. **Glanceable first, detail on demand.** The current danger and the latest update come first; impacts, full summaries and sources are one tap away.
2. **Sourced or it doesn't ship.** Every claim links to where it came from. Leave out anything that can't be verified.
3. **Official advice leads.** The tracker supports gov.je and Jersey Met rather than competing with them. Emergency guidance stays easy to find.
4. **Works when things are bad.** Low bandwidth, low battery and flaky connections are the normal case during a storm, not an edge case. Degrade gracefully when a source fails.
5. **Built to outlast one storm.** Prefer choices that carry over to the next named storm.

## Accessibility & Inclusion

- WCAG AA contrast, tap targets of at least 44px, body text of at least 16px, and comfortable one-handed use on a small phone.
- Many readers are older. Prefer plain language and clear labels over clever wording.
- Light on the network: no heavy fonts or assets.
