#!/usr/bin/env python3
"""Prepare a Vercel deployment of /workspace/storm.

For every deployable file this writes /workspace/storm/.deploy/<sha1>.b64 (the base64 body
for the user-Vercel `upload_file` tool) and prints:
  1. one line per file: <path> <sha1> <size> <b64 path>   (use for upload_file calls)
  2. the JSON `files` array for create_deployment           (also saved to .deploy/files.json)
It also sanity-checks summary.json and x-posts.json so a broken file is never deployed.
"""
import base64, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['index.html', 'style.css', 'app.js', 'summary.json', 'x-posts.json',
         'api/feed.js', 'api/weather.js', 'api/x-avatar.js', 'lib/util.js', 'lib/feed.js', 'lib/weather.js',
         'vercel.json', 'package.json',
         'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png']

def check():
    s = json.load(open(os.path.join(ROOT, 'summary.json'), encoding='utf-8'))
    assert s.get('headline') and s.get('updatedAt') and isinstance(s.get('sections'), list), 'summary.json needs headline, updatedAt, sections'
    x = json.load(open(os.path.join(ROOT, 'x-posts.json'), encoding='utf-8'))
    assert isinstance(x.get('posts'), list), 'x-posts.json needs a posts list'
    for p in x['posts']:
        for k in ('id', 'handle', 'text', 'time', 'url'):
            assert k in p, f'x-posts.json post missing {k}: {p.get("url")}'

def main():
    check()
    out = os.path.join(ROOT, '.deploy')
    os.makedirs(out, exist_ok=True)
    files = []
    for f in FILES:
        data = open(os.path.join(ROOT, f), 'rb').read()
        sha = hashlib.sha1(data).hexdigest()
        b64 = os.path.join(out, sha + '.b64')
        open(b64, 'w').write(base64.b64encode(data).decode())
        files.append({'file': f, 'sha': sha, 'size': len(data)})
        print(f, sha, len(data), b64)
    json.dump(files, open(os.path.join(out, 'files.json'), 'w'), indent=1)
    print(json.dumps(files))

if __name__ == '__main__':
    main()
