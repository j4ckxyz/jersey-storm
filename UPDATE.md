# Storm Austen tracker: refresh the summary and X posts, then redeploy

This file is self-contained. A scheduled run should follow it from top to bottom with no other context.

- **Live site:** https://jersey-storm-tracker.vercel.app
- **Source on the box:** `/workspace/storm`
- **Vercel team id:** `team_4Zwj8htiiiDOxCcGuNkAULWj`
- **Vercel project:** `jersey-storm-tracker`, id `prj_1QryeYNBSUyMxaOjrvRoUtjDRKFd`. There is no Git repo; deploy straight from files.

## Hard rules (never break these)
1. **Nothing that costs money.** No paid add-ons, plan or team changes, domains, Pro features, build-machine upgrades (`buildMachine`), Observability Plus, and so on. Only `upload_file`, `create_deployment` and read-only Vercel tools are needed.
2. **Touch only the `jersey-storm-tracker` project.** Never deploy to, edit, pause or delete any other Vercel project. Don't change project settings beyond what `create_deployment` below sends.
3. **X and Bluesky: reads only.** Never post, reply, like, repost, follow or DM.
4. **Facts must come from real sources, and every claim needs an inline link.** If something can't be verified, leave it out. Never invent numbers, times or closures.
5. All times shown to people are **Europe/Jersey** time (BST, UTC+1, until 25 Oct 2026; GMT, UTC+0, afterwards).

## What lives where
| File | Purpose | Edit on refresh? |
|---|---|---|
| `summary.json` | The "What's happening" box at the top of the page | **Yes** |
| `x-posts.json` | X posts merged into the feed (the site has no X API key) | **Yes** (regenerate with the script) |
| `events.json` | Grouped storm events shown as the timeline under "Latest updates" (format in `DATA.md`) | **Yes** (the assistant's scheduled runs rewrite it) |
| `tools/build_x_posts.py` | Builds `x-posts.json` from saved X search results | No |
| `tools/prepare_deploy.py` | Validates the JSON files and computes sha1 and size for upload | No |
| `index.html`, `app.js`, `style.css` | Frontend | No |
| `api/feed.js`, `api/weather.js`, `lib/*.js` | Serverless functions (live news, Bluesky, Jersey Met) | No |
| `vercel.json`, `package.json` | Config | No |

The live news feed (BBC Jersey and Guernsey, gov.je, JEP, Bailiwick Express, The Quarry, Jersey Met warnings, Bluesky) and the weather update themselves. Only `summary.json`, `x-posts.json` and `events.json` need refreshing. The scheduled runs also rewrite `events.json`; the page polls it every 2 minutes and falls back to the plain post feed if it is missing or empty.

---

## Step 1: Research the current situation (read only)
Collect facts for **Jersey and Guernsey** (and Alderney or Sark where relevant): what has happened, what's expected next, closures and disruption (schools, flights, ferries, roads, power, emergency services), and official advice.

Check these sources. Read the article pages, not just headlines:
- `curl -s https://jersey-storm-tracker.vercel.app/api/feed` lists the latest items with links from every feed source, so start here.
- `curl -s https://prodgojweatherstorage.blob.core.windows.net/data/JerseyWarningStatusXML.json` and `.../GuernseyWarningStatusXML.json` give the official warnings (colour, issued time, text).
- `curl -s https://prodgojweatherstorage.blob.core.windows.net/data/jerseyForecast.json` and `.../guernseyForecast.json` give the forecast text with gusts.
- gov.je: https://www.gov.je/News/2026/Pages/StormAustenUpdates.aspx, plus the news listing at https://www.gov.je/News/Pages/default.aspx
- States of Guernsey: https://www.gov.gg/news (it had no storm item at 07:45 on 22 Oct)
- BBC RSS feeds: https://feeds.bbci.co.uk/news/world/europe/jersey/rss.xml and https://feeds.bbci.co.uk/news/world/europe/guernsey/rss.xml
- https://jerseyeveningpost.com/feed/, https://www.bailiwickexpress.com/feed/, https://www.thequarry.media/rss/, and guernseypress.com articles found through WebSearch
- Operators: Aurigny, Condor/DFDS, Brittany Ferries, Ports of Jersey, Guernsey Ports, Jersey Electricity, Guernsey Electricity, Jersey Water (use WebSearch or WebFetch)
- **X** (see Step 2) and Bluesky (included in `/api/feed`)
- WebSearch, for example: `Storm Austen Jersey latest`, `Storm Austen Guernsey latest`, `Storm Austen Aurigny`, `Storm Austen power cut Jersey`

A quick way to pull readable text from an article page:
```bash
python3 - "$URL" <<'PY'
import re,sys,html,urllib.request
x=urllib.request.urlopen(urllib.request.Request(sys.argv[1],headers={'User-Agent':'Mozilla/5.0'}),timeout=20).read().decode('utf-8','ignore')
x=re.sub(r'(?s)<(script|style|noscript|svg|nav|footer)[^>]*>.*?</\1>','',x)
print('\n'.join(t for t in (html.unescape(re.sub('<[^>]+>','',p)).strip() for p in re.findall(r'(?s)<(?:p|h1|h2|li)[^>]*>(.*?)</(?:p|h1|h2|li)>',x)) if len(t)>25)[:6000])
PY
```

## Step 2: Refresh `x-posts.json` (do this on every run)
Use the **`x`** MCP namespace (public read tools). Read the schema first with `GetDynamicTools {"namespace":"x"}`. If `x` is unavailable, use `user-X` search tools, still read only. X rate limits are small (about 30 reads a minute), so use 2 or 3 searches.

**2a. Run these searches.** For each one, call `CallDynamicTool` with `namespace: "x"`, `toolName: "search_posts_all"` and **`write_to_file: true`**, and note each saved file path. Set `start_time` to about 3 days ago in UTC, e.g. `2026-10-21T00:00:00Z`.

Common arguments:
```json
{"max_results": 25, "sort_order": "recency", "start_time": "<UTC ISO, ~3 days ago>",
 "post.fields": "created_at,author_id,text,attachments,entities,edit_history_tweet_ids",
 "expansions": "author_id,attachments.media_keys",
 "user.fields": "username,name,profile_image_url",
 "media.fields": "url,preview_image_url,type,width,height,alt_text"}
```
Queries:
1. `(from:GovJersey OR from:Jersey_Met OR from:Jersey_MetCI OR from:GuernseyMet OR from:BBCJersey OR from:BBCGuernsey OR from:JEPnews OR from:ITVChannelTV OR from:PortsofJersey OR from:GuernseyPolice OR from:JerseyPolice OR from:GuernseyAirport) (storm OR Austen OR wind OR gale OR gusts OR warning OR schools OR closed OR cancelled OR flights OR sailings OR flooding OR trees OR power) -is:retweet`
2. `("Storm Austen" OR #StormAusten) (Jersey OR Guernsey OR "Channel Islands" OR Alderney OR Sark OR "St Helier" OR "St Peter Port") -"New Jersey" -is:retweet`
3. (Optional) a narrower query for a breaking topic, e.g. `"power cut" (Jersey OR Guernsey) -is:retweet`

**2b. Build the file:**
```bash
cd /workspace/storm && python3 tools/build_x_posts.py /workspace/agent-tools/<file1>.txt /workspace/agent-tools/<file2>.txt
```
The script merges with the existing `x-posts.json`. It keeps only posts from trusted local accounts that are storm-related, and posts that mention both "Austen" and a Jersey/Guernsey place. It drops New Jersey and similar, replies, and older versions of edited posts. It keeps the last 5 days (60 posts at most) and always keeps posts cited in `summary.json`.

**2c. Enrich the posts.** The search endpoint sometimes drops `entities` and `attachments`, which means missing images and raw t.co links. Fix this with one lookup:
```bash
python3 tools/build_x_posts.py --print-ids   # prints comma-separated ids
```
Then call `CallDynamicTool` with `namespace: "x"`, `toolName: "get_posts_by_ids"`, `write_to_file: true` and arguments `{"ids": "<printed ids>", ...same post/user/media fields and expansions as above}`, and rebuild:
```bash
python3 tools/build_x_posts.py /workspace/agent-tools/<lookup file>.txt
```
If the script warns that `summary.json` cites X posts that aren't in `x-posts.json`, add those ids to a `get_posts_by_ids` call and rebuild.

Skim the result and remove obviously irrelevant posts by hand if needed:
```bash
python3 -c "import json;[print(p['time'][:16],p['handle'],'|',p['text'][:100].replace('\n',' ')) for p in json.load(open('/workspace/storm/x-posts.json'))['posts']]"
```

## Step 3: Edit `summary.json`
The format (keep these keys):
```json
{
 "updatedAt": "2026-10-22T07:45:00+01:00",
 "headline": "One or two plain-English sentences with [source](https://...) links.",
 "sections": [
  {"title": "So far", "points": ["... ([BBC](https://...))", "..."]},
  {"title": "What's expected", "points": ["..."]},
  {"title": "Travel & closures", "points": ["..."]},
  {"title": "Official advice", "points": ["..."]}
 ],
 "posts": ["https://x.com/<handle>/status/<id>", "https://bsky.app/profile/<handle>/post/<rkey>"]
}
```
- `updatedAt`: the **current** time as ISO 8601 with the Jersey offset (`+01:00` until 25 Oct 2026, then `+00:00`). The page shows "Updated HH:MM, Day" and flags the summary as possibly out of date after 6 hours.
- Text supports only `**bold**` and `[label](https://url)` links. Everything else is escaped.
- **Every** claim ends with at least one inline source link. Cover both Jersey and Guernsey. Put the newest facts first, keep each point short, and say "as of <time/date>" for things that may have changed. Remove anything that's no longer true, such as expired warnings or reopened services.
- The first section is always shown. The rest sit behind "Show full summary". Aim for 3 to 5 points per section.
- `posts`: 1 to 3 key official posts to show as native cards. X URLs must exist in `x-posts.json`. Bluesky URLs only show if that post is currently in `/api/feed`.
- Validate: `python3 -c "import json;json.load(open('/workspace/storm/summary.json'))"`

## Step 4: Prepare the deployment files
```bash
cd /workspace/storm && python3 tools/prepare_deploy.py
```
This validates both JSON files. For each deployable file it prints `<path> <sha1> <size> <b64 path>`, then the JSON `files` array, which is also saved to `/workspace/storm/.deploy/files.json`. Fix any assertion error before continuing.

## Step 5: Upload with the user-Vercel MCP
Read the schema once: `GetDynamicTools {"namespace":"user-Vercel","toolName":"upload_file"}`.

Make one call for **every** line printed in Step 4. Run them in parallel. Re-uploading unchanged files is harmless.
```json
CallDynamicTool {
 "namespace": "user-Vercel", "toolName": "upload_file",
 "mcpDetails": {"description": "Upload <path> for the storm tracker deployment"},
 "arguments": {
   "teamId": "team_4Zwj8htiiiDOxCcGuNkAULWj",
   "contentLength": <size>,
   "xVercelDigest": "<sha1>",
   "requestBody": "$file:/workspace/storm/.deploy/<sha1>.b64"
 }
}
```
(`$file:` makes the tool send the base64 file contents. A success returns `{"urls":[...]}`.)

## Step 6: Create the production deployment
```json
CallDynamicTool {
 "namespace": "user-Vercel", "toolName": "create_deployment",
 "mcpDetails": {"description": "Create a production deployment of the storm tracker in the jersey-storm-tracker project"},
 "arguments": {
   "teamId": "team_4Zwj8htiiiDOxCcGuNkAULWj",
   "skipAutoDetectionConfirmation": "1",
   "forceNew": "1",
   "requestBody": {
     "name": "jersey-storm-tracker",
     "project": "prj_1QryeYNBSUyMxaOjrvRoUtjDRKFd",
     "target": "production",
     "projectSettings": {"framework": null, "buildCommand": null, "installCommand": null, "outputDirectory": null, "devCommand": null, "rootDirectory": null},
     "files": <paste the JSON array from /workspace/storm/.deploy/files.json>
   }
 }
}
```
- The deployment must include **all 18 files** (everything listed in `FILES` in `tools/prepare_deploy.py`) every time, because each deployment is a full snapshot.
- A `missing_files` error means an upload was skipped. Upload the listed sha(s) and retry.
- Don't add `buildMachine`, `customEnvironmentSlugOrId` or anything else.

## Step 7: Verify (logged out)
Production usually updates within 10–60 seconds. Poll until the new summary shows:
```bash
B=https://jersey-storm-tracker.vercel.app
for i in $(seq 1 20); do curl -s "$B/summary.json?v=$RANDOM" | grep -q '"updatedAt": "<the value you set>"' && echo LIVE && break; sleep 10; done
for p in / /summary.json /x-posts.json /api/feed /api/weather; do curl -s -o /dev/null -w "$p %{http_code}\n" "$B$p"; done
curl -s $B/api/feed | python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d['items']),'items');print([(s['name'],s['ok']) for s in d['sources']])"
curl -s $B/x-posts.json | python3 -c "import json,sys;print(len(json.load(sys.stdin)['posts']),'X posts')"
```
All five paths must return 200. Optionally take a headless screenshot to check the box:
`google-chrome --headless=new --no-sandbox --virtual-time-budget=10000 --window-size=1280,1600 --screenshot=/tmp/live.png $B/`

If production is broken, roll back by redeploying the previous good file set: run Step 6 again with the previous `files.json`, or use `create_deployment` with `deploymentId` set to the last good deployment id and `target: "production"`. Don't change any project settings.

## Report
Report the live URL check (status codes), the summary text you published, the number of X posts and feed items, and any source that failed.
