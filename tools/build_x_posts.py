#!/usr/bin/env python3
"""Build /workspace/storm/x-posts.json from saved X API search results.

Usage:
  python3 tools/build_x_posts.py RAW1.txt [RAW2.txt ...]
  python3 tools/build_x_posts.py --print-ids

Each RAW file is the output of the `x` MCP tool `search_posts_all` (called with
write_to_file: true) using the fields listed in UPDATE.md. Files may contain
wrapper text around the JSON; the first JSON object in the file is used.

The script merges new posts with the existing x-posts.json, keeps only
Jersey/Guernsey storm-related posts from the last 5 days (max 60), and always
keeps any X post whose URL is cited in summary.json.
"""
import json, os, re, sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'x-posts.json')
SUMMARY = os.path.join(ROOT, 'summary.json')

# Accounts we trust as local/official. Storm-related posts from these are always kept.
OFFICIAL = {h.lower() for h in [
    'GovJersey', 'Jersey_Met', 'Jersey_MetCI', 'GuernseyMet', 'BBCJersey', 'BBCGuernsey', 'JEPnews',
    'ITVChannelTV', 'PortsofJersey', 'GuernseyPolice', 'JerseyPolice', 'GuernseyAirport', 'Channel103',
    'IslandFM', 'guernseypress', 'BailiwickExpress', 'bexjersey', 'bexguernsey', 'thequarrymedia',
    'JerseyWater', 'JECnews', 'StatesofGuernsey', 'GuernseyElectric', 'aurigny_air', 'Aurigny_Air',
]}
LOCAL = re.compile(r"\b(jersey|guernsey|alderney|sark|herm|channel islands?|st\.? helier|st\.? peter port|bailiwick)\b", re.I)
NOT_LOCAL = re.compile(r"new jersey|jersey shore|\bnj\b|jersey city|north jersey|south jersey|nor'?easter|philadelphia|atlantic city|guelph|melb storm", re.I)
STORMY = re.compile(r"austen|storm|\bwinds?\b|gale|gust|warning|flood|weather|schools? (?:will be |to )?clos|cancel|sailings?|flights?|power cut|fallen tree|met\b", re.I)


def load_json_blob(path):
    t = open(path, encoding='utf-8').read()
    i = t.find('{')
    if i < 0:
        return {}
    obj, _ = json.JSONDecoder().raw_decode(t[i:])
    return obj


def clean_text(p):
    text = p.get('text', '')
    ents = (p.get('entities') or {}).get('urls') or []
    for u in ents:
        short = u.get('url')
        if not short:
            continue
        if u.get('media_key') or 'pic.x.com' in (u.get('display_url') or ''):
            text = text.replace(short, '')
        else:
            text = text.replace(short, u.get('expanded_url') or u.get('display_url') or short)
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    return re.sub(r'[ \t]+\n', '\n', text).strip()


def convert(p, users, media):
    u = users.get(p.get('author_id'), {})
    handle = u.get('username', '')
    out_media = []
    for k in ((p.get('attachments') or {}).get('media_keys') or [])[:4]:
        m = media.get(k)
        if not m:
            continue
        url = m.get('url') or m.get('preview_image_url')
        if url:
            out_media.append({'type': m.get('type', 'photo'), 'url': url, 'thumb': url, 'alt': m.get('alt_text', '')})
    if not out_media:
        for e in (p.get('entities') or {}).get('urls') or []:
            imgs = e.get('images') or []
            if imgs and e.get('title'):
                out_media.append({'type': 'link', 'url': imgs[0]['url'], 'thumb': imgs[0]['url'], 'alt': e.get('title', ''),
                                  'link': e.get('unwound_url') or e.get('expanded_url'), 'title': e.get('title', '')})
                break
    avatar = (u.get('profile_image_url') or '').replace('_normal.', '_bigger.')
    return {
        'id': p['id'], 'source': 'X', 'platform': 'x',
        'author': u.get('name', handle), 'handle': handle, 'avatar': avatar,
        'text': clean_text(p), 'media': out_media,
        'time': p.get('created_at'),
        'url': p.get('url') or f'https://x.com/{handle}/status/{p["id"]}',
    }


def relevant(post):
    h = post['handle'].lower()
    t = post['text']
    if t.startswith('@'):
        return False
    if NOT_LOCAL.search(t):
        return False
    if h in OFFICIAL:
        return bool(STORMY.search(t))
    return bool(re.search(r'austen', t, re.I) and LOCAL.search(t))


def main(paths):
    cited = set()
    if os.path.exists(SUMMARY):
        cited = set(re.findall(r'https://x\.com/[A-Za-z0-9_]+/status/\d+', open(SUMMARY, encoding='utf-8').read()))
    existing = {}
    if os.path.exists(OUT):
        for p in json.load(open(OUT, encoding='utf-8')).get('posts', []):
            existing[p['id']] = p
    added = 0
    for path in paths:
        d = load_json_blob(path)
        inc = d.get('includes') or {}
        users = {u['id']: u for u in inc.get('users', [])}
        media = {m['media_key']: m for m in inc.get('media', [])}
        for p in d.get('data', []) or []:
            hist = p.get('edit_history_tweet_ids') or [p['id']]
            if hist and hist[-1] != p['id']:
                continue  # older version of an edited post
            post = convert(p, users, media)
            if relevant(post) or post['url'] in cited:
                if post['id'] not in existing:
                    added += 1
                existing[post['id']] = post
    cutoff = datetime.now(timezone.utc) - timedelta(days=5)
    posts = [p for p in existing.values()
             if p['url'] in cited or datetime.fromisoformat(p['time'].replace('Z', '+00:00')) >= cutoff]
    posts.sort(key=lambda p: p['time'], reverse=True)
    keep = posts[:60] + [p for p in posts[60:] if p['url'] in cited]
    out = {'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'posts': keep}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    missing = [c for c in cited if c not in {p['url'] for p in keep}]
    print(f'x-posts.json: {len(keep)} posts ({added} new).')
    if missing:
        print('WARNING: summary.json cites X posts not in x-posts.json (fetch them with get_posts_by_ids):', *missing, sep='\n  ')


if __name__ == '__main__':
    if sys.argv[1:2] == ['--print-ids']:
        # Comma-separated ids of every post in x-posts.json (for one get_posts_by_ids call, max 100).
        print(','.join(p['id'] for p in json.load(open(OUT, encoding='utf-8')).get('posts', [])[:100]))
        sys.exit(0)
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
