(() => {
  'use strict';
  const TZ = 'Europe/Jersey';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');
  const isUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
  const safeColor = (c) => (typeof c === 'string' && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(c) ? c : '');

  // --- optional site config (/config.json); every field falls back to today's behaviour ---
  let config = { theme: {}, refresh: {}, features: {}, filters: null };
  const feature = (k) => config.features[k] !== false;

  // --- source registry: built-in defaults, overridden per key by /sources.json ---
  const BUILTIN_SOURCES = {
    'Jersey Met': { domain: 'gov.je', color: '#d0021b', kind: 'warning', region: 'channel-islands', official: true },
    'gov.je': { domain: 'gov.je', color: '#1b5e9e', kind: 'official', region: 'jersey', official: true },
    'BBC Jersey': { domain: 'bbc.co.uk', color: '#bb1919', kind: 'news', region: 'jersey' },
    'BBC Guernsey': { domain: 'bbc.co.uk', color: '#bb1919', kind: 'news', region: 'guernsey' },
    // its /favicon.ico is a blank 198-byte icon, so use the favicon service directly
    'Jersey Evening Post': { domain: 'jerseyeveningpost.com', favicon: 'https://www.google.com/s2/favicons?domain=jerseyeveningpost.com&sz=64', color: '#1d4f91', kind: 'news', region: 'jersey' },
    'Bailiwick Express': { domain: 'bailiwickexpress.com', color: '#7a3db8', kind: 'news', region: 'channel-islands' },
    'The Quarry (Guernsey)': { domain: 'thequarry.media', color: '#2f6f4f', kind: 'news', region: 'guernsey' },
    Bluesky: { domain: 'bsky.app', color: '#1185fe', kind: 'social' },
    X: { domain: 'x.com', color: '#111111', kind: 'social' },
  };
  let customSources = {};
  const SOURCE_ORDER = Object.keys(BUILTIN_SOURCES);
  function src(name) {
    const s = { label: name, priority: 50, ...(BUILTIN_SOURCES[name] || {}), ...((customSources && customSources[name]) || {}) };
    if (typeof s.priority !== 'number') s.priority = 50;
    return s;
  }

  // --- favicons: favicon → domain/favicon.ico → favicon service → icon/letter ---
  const favResolved = new Map(); // source name → working URL, or '' when none loads
  function letterHTML(s) {
    const c = String(s.label || '?').trim().slice(0, 1).toUpperCase() || '?';
    const color = safeColor(s.color);
    return `<span class="fav fav-l" aria-hidden="true"${color ? ` style="--c:${color}"` : ''}>${esc(c)}</span>`;
  }
  function iconHTML(s) {
    if (typeof s.icon === 'string' && s.icon && s.icon.length <= 8 && !/[<>]/.test(s.icon)) return `<span class="fav fav-e" aria-hidden="true">${esc(s.icon)}</span>`;
    return letterHTML(s);
  }
  function faviconHTML(name, itemFav) {
    const s = src(name);
    if (!feature('favicons')) return iconHTML(s);
    let chain;
    if (favResolved.has(name)) chain = favResolved.get(name) ? [favResolved.get(name)] : [];
    else {
      const dom = typeof s.domain === 'string' && /^[a-z0-9.-]+$/i.test(s.domain) ? s.domain : '';
      chain = [itemFav, s.favicon, dom && `https://${dom}/favicon.ico`, dom && `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dom)}&sz=64`].filter(isUrl);
    }
    if (!chain.length) return iconHTML(s);
    const [first, ...rest] = chain;
    return `<img class="fav" src="${esc(first)}" data-fb="${esc(rest.join(' '))}" data-fav="${esc(name)}" data-ff="${esc(iconHTML(s))}" width="16" height="16" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }
  // One delegated handler replaces inline onerror attributes.
  // data-fb: space-separated fallback URLs; data-ff: fallback HTML; data-gone: "self" | "parent".
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    const fb = (img.dataset.fb || '').split(' ').filter(Boolean);
    if (fb.length) { img.dataset.fb = fb.slice(1).join(' '); img.src = fb[0]; return; }
    if (img.dataset.fav) favResolved.set(img.dataset.fav, '');
    if (img.dataset.ff) img.outerHTML = img.dataset.ff;
    else if (img.dataset.gone === 'parent' && img.parentNode) img.parentNode.remove();
    else img.remove();
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.dataset.fav && !favResolved.has(img.dataset.fav)) favResolved.set(img.dataset.fav, img.currentSrc || img.src);
  }, true);

  // --- time helpers (always Europe/Jersey) ---
  const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const hourOf = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d);
  const hm = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  function dayLabel(d) {
    const now = new Date();
    const k = dayKey(d);
    if (k === dayKey(now)) return 'Today';
    if (k === dayKey(new Date(now - 864e5))) return 'Yesterday';
    if (k === dayKey(new Date(+now + 864e5))) return 'Tomorrow';
    return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  }
  function ago(d) {
    const s = Math.round((Date.now() - d) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }
  // events.json display format (DATA.md): "3:10pm" today, "Thu 22 Oct, 3:10pm" otherwise
  const yearOf = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric' }).format(d);
  const clock = (d) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }) // en-US: en-GB gives "0:00pm" at noon
    .format(d).replace(/\s/g, '').toLowerCase();
  function dateLabel(d) {
    const s = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(',', '');
    return yearOf(d) === yearOf(new Date()) ? s : `${s} ${yearOf(d)}`;
  }
  function fmtTime(iso, now = new Date()) {
    const d = new Date(iso);
    return dayKey(d) === dayKey(now) ? clock(d) : `${dateLabel(d)}, ${clock(d)}`;
  }
  // "10:19–10:32am", "11:30am–2:18pm", "Wed 21 Oct, 6:15–8:00pm", "Tue 20 Oct, 4:05pm – Wed 21 Oct, 9:37pm"
  function fmtRange(a, b, now = new Date()) {
    const s = new Date(a);
    const e = new Date(b);
    if (isNaN(e) || dayKey(s) === dayKey(e) && clock(s) === clock(e)) return fmtTime(a, now);
    if (dayKey(s) !== dayKey(e)) return `${dateLabel(s)}, ${clock(s)} – ${dateLabel(e)}, ${clock(e)}`;
    const cs = clock(s);
    const ce = clock(e);
    const r = `${cs.slice(-2) === ce.slice(-2) ? cs.slice(0, -2) : cs}–${ce}`;
    return dayKey(s) === dayKey(now) ? r : `${dateLabel(s)}, ${r}`;
  }
  const TIME_FMT = {
    item: (d) => `${hm(d)} · ${ago(d)}`,
    date: (d) => dayLabel(d),
    post: (d) => `${hm(d)} · ${dayLabel(d)} · ${ago(d)}`,
    ago: (d) => ago(d),
  };
  const timeHTML = (iso, fmt) => `<time datetime="${esc(iso)}" data-fmt="${fmt}">${esc(TIME_FMT[fmt](new Date(iso)))}</time>`;
  function updateTimes() {
    for (const t of $$('time[data-fmt]')) {
      const d = new Date(t.getAttribute('datetime'));
      if (!isNaN(d) && TIME_FMT[t.dataset.fmt]) t.textContent = TIME_FMT[t.dataset.fmt](d);
    }
  }

  const mobile = window.matchMedia('(max-width: 899px)');
  let feedData = null; // merged: {items, sources}
  let apiFeed = null;
  let xPosts = [];
  let summaryData = null;
  let wxData = null;
  let eventsData = null; // normalised /events.json, or null to show the post feed instead
  const eventsMode = () => !!(eventsData && eventsData.events.length);
  let activeSource = 'All';
  const seenUrls = new Set();
  let firstLoad = true;

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  const getOptional = (url) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  const ICON = {
    check: '<svg class="ok-ic" viewBox="0 0 24 24" aria-label="Official source" role="img"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/></svg>',
  };

  // --- native-looking post cards (X and Bluesky share one design) ---
  const ICON_X = '<svg class="plat" viewBox="0 0 24 24" aria-label="X" role="img"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  const ICON_BSKY = '<svg class="plat" viewBox="0 0 600 530" aria-label="Bluesky" role="img"><path fill="#1185fe" d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-.0174-2.9357-1.1937.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"/></svg>';
  const isPost = (it) => it.platform === 'x' || it.platform === 'bsky' || it.source === 'Bluesky' || it.source === 'X';
  function initials(name) { const c = String(name || '').trim().slice(0, 1).toUpperCase(); return /[A-Z0-9]/.test(c) ? c : '?'; }
  function mediaHTML(media) {
    if (!Array.isArray(media) || !media.length) return '';
    const link = media.find((m) => m.type === 'link');
    if (link && media.length === 1) {
      return `<div class="pcard-link"><img src="${esc(safeUrl(link.thumb || link.url))}" alt="" loading="lazy" referrerpolicy="no-referrer"><div>${esc(link.title || link.alt || '')}</div></div>`;
    }
    const imgs = media.filter((m) => m.type !== 'link').slice(0, 4);
    if (!imgs.length) return '';
    return `<div class="pmedia n${imgs.length}">${imgs.map((m) => `<div class="pm"><img src="${esc(safeUrl(m.thumb || m.url))}" alt="${esc(m.alt || '')}" loading="lazy" referrerpolicy="no-referrer" data-gone="parent">${m.type === 'video' || m.type === 'animated_gif' ? '<span class="play" aria-hidden="true">▶</span>' : ''}</div>`).join('')}</div>`;
  }
  const disp = (it) => (it && it.display && typeof it.display === 'object' ? it.display : {});
  const importance = (it) => (['low', 'high', 'critical'].includes(disp(it).importance) ? disp(it).importance : 'normal');
  function itemClasses(it, isNew) {
    return [importance(it) !== 'normal' ? `imp-${importance(it)}` : '', isNew ? 'new' : ''].filter(Boolean).join(' ');
  }
  function tagsHTML(it) {
    const tags = Array.isArray(disp(it).tags) ? disp(it).tags.filter((t) => typeof t === 'string' && t).slice(0, 5) : [];
    return tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '';
  }
  // X avatars load from our own origin (/api/x-avatar proxies pbs.twimg.com), because content
  // blockers often block pbs.twimg.com on third-party sites. Order: stored URL via the proxy,
  // fresh syndication lookup via the proxy, the stored URL direct, then the initial.
  function xAvatarChain(it) {
    const m = String(it.id || '').match(/^\d+$/) || String(it.url || '').match(/\/status\/(\d+)/);
    const stored = /^https:\/\/pbs\.twimg\.com\/profile_images\//.test(it.avatar || '') ? it.avatar : '';
    return [
      stored ? `/api/x-avatar?u=${encodeURIComponent(stored)}` : '',
      m ? `/api/x-avatar?id=${m[1] || m[0]}` : '',
      it.avatar ? safeUrl(it.avatar) : '',
    ];
  }
  function avatarHTML(it, cls = 'av') {
    const x = it.platform === 'x' || it.source === 'X';
    const name = it.author || it.handle;
    const ff = `<span class="${cls} av-f">${initials(name)}</span>`;
    const chain = (x ? xAvatarChain(it) : [it.avatar ? safeUrl(it.avatar) : '']).filter((u) => u && u !== '#');
    if (!chain.length) return ff;
    const [first, ...rest] = chain;
    return `<img class="${cls}" src="${esc(first)}" data-fb="${esc(rest.join(' '))}" alt="" loading="lazy" referrerpolicy="no-referrer" data-ff="${esc(ff)}">`;
  }
  function postCardHTML(it, extraCls = '') {
    const x = it.platform === 'x' || it.source === 'X';
    const name = it.author || it.handle;
    const av = avatarHTML(it);
    return `<a class="pcard ${x ? 'is-x' : 'is-bsky'} ${extraCls}" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">
      <div class="phead">${av}<div class="pwho"><span class="pname">${esc(name)}</span><span class="phandle">@${esc(it.handle)}</span></div>${x ? ICON_X : ICON_BSKY}</div>
      <div class="ptext">${esc(it.text)}</div>
      ${mediaHTML(it.media)}
      ${tagsHTML(it)}
      <div class="pfoot">${timeHTML(it.time, 'post')}<span>View on ${x ? 'X' : 'Bluesky'} ↗</span></div>
    </a>`;
  }
  function itemHTML(it, isNew) {
    const s = src(it.source);
    const d = disp(it);
    const title = it.title || (isPost(it) ? it.author || (it.handle ? '@' + it.handle : '') : '');
    const warn = it.warning ? `<span class="badge ${esc(it.warning)}">${esc(it.warning)}</span>` : '';
    const img = isUrl(d.image) ? `<img class="thumb" src="${esc(d.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
    return `<a class="item ${itemClasses(it, isNew)}" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">
      <div class="meta">${faviconHTML(it.source, it.favicon)}<span class="src">${esc(s.label)}</span>${s.official ? ICON.check : ''}${warn}${d.pinned ? '<span class="pin">Pinned</span>' : ''}${timeHTML(it.time, it.dateOnly ? 'date' : 'item')}</div>
      <div class="item-body"><div>
        ${title ? `<h3 class="title">${esc(title)}</h3>` : ''}
        ${it.text ? `<p class="text">${esc(it.text)}</p>` : ''}
        ${tagsHTML(it)}
      </div>${img}</div>
    </a>`;
  }

  function visibleByConfig(it) {
    const s = src(it.source);
    if (s.hidden === true) return false;
    const f = config.filters;
    if (!f || !Array.isArray(f.regions) || !f.regions.length) return true;
    const region = disp(it).region || s.region;
    if (!region || f.regions.includes(region)) return true;
    if (f.showGuernseyOnlyIfImportant && region === 'guernsey') return ['high', 'critical'].includes(importance(it));
    return false;
  }

  function mergeFeed() {
    if (!apiFeed && !xPosts.length) return;
    const items = [...((apiFeed && apiFeed.items) || [])];
    const cutoff = Date.now() - 5 * 864e5;
    for (const p of xPosts) if (new Date(p.time) >= cutoff) items.push({ ...p, source: 'X', platform: 'x' });
    const seen = new Set();
    const merged = items
      .filter((i) => i && i.url && i.time && !isNaN(new Date(i.time)))
      .filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
      .filter(visibleByConfig)
      .sort((a, b) => new Date(b.time) - new Date(a.time));
    const sources = [...((apiFeed && apiFeed.sources) || [])];
    sources.push(xPosts.length ? { name: 'X', ok: true, count: xPosts.filter((p) => new Date(p.time) >= cutoff).length } : { name: 'X', ok: false, count: 0 });
    feedData = { items: merged, sources };
  }

  function renderFilters() {
    const counts = {};
    for (const i of feedData.items) counts[i.source] = (counts[i.source] || 0) + 1;
    const rank = (n) => (SOURCE_ORDER.includes(n) ? SOURCE_ORDER.indexOf(n) : 99);
    const names = Object.keys(counts).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    if (activeSource !== 'All' && !names.includes(activeSource)) activeSource = 'All';
    $('#filters').innerHTML = [
      `<button type="button" data-src="All" aria-pressed="${activeSource === 'All'}">All <span class="cnt">${feedData.items.length}</span></button>`,
      ...names.map((n) => `<button type="button" data-src="${esc(n)}" aria-pressed="${n === activeSource}">${faviconHTML(n)}${esc(src(n).label)} <span class="cnt">${counts[n]}</span></button>`),
    ].join('');
  }

  function groupItems(items) {
    const groups = [];
    let cur = null;
    for (const it of items) {
      const d = new Date(it.time);
      const key = it.dateOnly ? dayLabel(d) : `${dayLabel(d)}|${hourOf(d)}:00`;
      if (!cur || cur.key !== key) { cur = { key, items: [] }; groups.push(cur); }
      cur.items.push(it);
    }
    // within an hour: pinned first, then source priority, then newest (sort is stable)
    const rank = (it) => (disp(it).pinned ? 1000 : 0) + src(it.source).priority;
    for (const g of groups) g.items.sort((a, b) => rank(b) - rank(a) || new Date(b.time) - new Date(a.time));
    return groups;
  }

  function renderFeed() {
    mergeFeed();
    if (!feedData) return;
    renderFilters();
    const items = feedData.items.filter((i) => activeSource === 'All' || i.source === activeSource);
    let newCount = 0;
    if (!items.length) {
      $('#feed').innerHTML = '<div class="card empty muted">No storm updates found right now. Check back soon.</div>';
    } else {
      let html = '';
      for (const g of groupItems(items)) {
        const [day, hour] = g.key.split('|');
        html += `<div class="hour"><b>${esc(day)}</b>${hour ? esc(hour) : ''}</div>`;
        for (const it of g.items) {
          const isNew = !firstLoad && !seenUrls.has(it.url);
          if (isNew) newCount++;
          html += isPost(it) && feature('postCards') ? postCardHTML(it, itemClasses(it, isNew)) : itemHTML(it, isNew);
        }
      }
      $('#feed').innerHTML = html;
    }
    for (const it of feedData.items) seenUrls.add(it.url);
    firstLoad = false;
    renderSources();
    renderSummaryPosts();
    renderNow();
    applyMode();
    if (newCount && !eventsMode()) showNewPill(newCount);
  }

  function renderSources() {
    const all = feedData.sources || [];
    const bad = all.filter((s) => !s.ok);
    const good = all.filter((s) => s.ok);
    const el = $('#feed-sources');
    const wasOpen = el.open;
    el.innerHTML = `<summary>Sources: ${good.length} live${bad.length ? ` · <span class="err">unavailable: ${esc(bad.map((s) => s.name).join(', '))}</span>` : ''} ▾</summary>
      <div class="src-list">${good.map((s) => `<span class="src-chip good"><span class="dot"></span>${esc(s.name)} (${esc(s.count)})</span>`).join('')}${bad.map((s) => `<span class="src-chip bad" title="${esc(s.error || '')}"><span class="dot"></span>${esc(s.name)}</span>`).join('')}</div>`;
    el.open = wasOpen;
  }

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-src]');
    if (!b) return;
    activeSource = b.dataset.src;
    renderFeed();
  });

  // --- "N new updates" pill when new items arrive while scrolled down ---
  const pill = $('#new-pill');
  const listEl = () => (eventsMode() ? $('#ev-list') : $('#feed'));
  function showNewPill(n, noun = 'update') {
    if (mobile.matches && document.body.dataset.active !== 'updates') return;
    if (listEl().getBoundingClientRect().top > 0) return; // top of the list already visible
    pill.textContent = `↑ ${n} new ${noun}${n === 1 ? '' : 's'}`;
    pill.hidden = false;
  }
  pill.addEventListener('click', () => {
    pill.hidden = true;
    $('#feed-h').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('scroll', () => { if (!pill.hidden && listEl().getBoundingClientRect().top > 0) pill.hidden = true; }, { passive: true });

  // --- summary box (static /summary.json) ---
  function md(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  }
  const STATUS = { calm: 'Calm', watch: 'Watch', warning: 'Warning', severe: 'Severe', easing: 'Easing', over: 'Over' };
  function renderSummary() {
    const box = $('#summary');
    const s = summaryData;
    const sec = $('#summary-sec');
    if (!s || !s.headline || !feature('summaryBox')) { sec.hidden = true; return; }
    const d = new Date(s.updatedAt);
    const valid = !isNaN(d);
    const stale = valid && Date.now() - d > 6 * 3600e3;
    const upd = valid ? `Updated ${hm(d)}, ${new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long' }).format(d)}${stale ? ' · may be out of date' : ''}` : '';
    const hls = (Array.isArray(s.highlights) ? s.highlights : []).filter((h) => h && (h.label || h.value)).slice(0, 8);
    const hlHTML = hls.length
      ? `<div class="highlights">${hls.map((h) => {
          const inner = `<span class="hl-v">${esc(h.value)}</span><span class="hl-l">${esc(h.label)}</span>`;
          return isUrl(h.source) ? `<a class="hl" href="${esc(h.source)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="hl">${inner}</div>`;
        }).join('')}</div>`
      : '';
    const secs = Array.isArray(s.sections) ? s.sections : [];
    const secIcon = (ic) => (typeof ic === 'string' && ic.length <= 8 && /[^\x00-\x7F]/.test(ic) ? `<span aria-hidden="true">${esc(ic)}</span>` : '');
    const secHTML = (sec) => `<h3>${secIcon(sec.icon)}${esc(sec.title)}</h3><ul>${(sec.points || []).map((p) => `<li>${md(p)}</li>`).join('')}</ul>`;
    const first = secs.slice(0, 1).map(secHTML).join('');
    const rest = secs.slice(1).map(secHTML).join('');
    const posts = Array.isArray(s.posts) ? s.posts : [];
    const wasOpen = box.querySelector('details') && box.querySelector('details').open;
    const updEl = $('#sum-upd');
    updEl.textContent = upd;
    updEl.className = `small ${stale ? 'err' : 'muted'}`;
    box.innerHTML = `<p class="sum-lead">${md(s.headline)}</p>
      ${hlHTML}
      ${first}
      ${rest || posts.length ? `<details${wasOpen ? ' open' : ''}><summary>Show full summary ${ICON.chev}</summary>${rest}<div id="sum-posts" class="sum-posts"></div></details>` : ''}`;
    sec.hidden = false;
    renderSummaryPosts();
  }
  function renderSummaryPosts() {
    const el = document.getElementById('sum-posts');
    if (!el || !summaryData) return;
    // any linked item (tweet, Bluesky post, article, gov.je notice...), newest first
    const pool = [...xPosts.map((p) => ({ ...p, source: 'X', platform: 'x' })), ...((apiFeed && apiFeed.items) || []), ...((feedData && feedData.items) || [])];
    const urls = [...new Set(Array.isArray(summaryData.posts) ? summaryData.posts : [])];
    const cards = urls.map((u) => pool.find((p) => p.url === u)).filter((c) => c && c.time && !isNaN(new Date(c.time)))
      .sort((a, b) => new Date(b.time) - new Date(a.time));
    el.innerHTML = cards.length ? `<h3>Key updates</h3>${cards.map((c) => (isPost(c) && feature('postCards') ? postCardHTML(c) : itemHTML(c, false))).join('')}` : '';
  }

  // --- grouped storm events (/events.json); the post feed is the fallback and sits behind "Show all posts" ---
  const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const EV_CAT = {
    warning: ['Warning', svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>')],
    weather: ['Weather', svg('<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>')],
    travel: ['Travel', svg('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>')],
    power: ['Power', svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>')],
    closures: ['Closures', svg('<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20M14 12v.01"/>')],
    damage: ['Damage', svg('<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>')],
    emergency: ['Emergency', svg('<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21h14v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2zM12 2v1M21 12h1M2 12h1M4.9 4.9l.7.7M19.1 4.9l-.7.7"/>')],
    advice: ['Advice', svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>')],
    other: ['Update', svg('<circle cx="12" cy="12" r="3"/>')],
  };
  const EV_SEV = ['info', 'notable', 'major'];
  const EV_SRC = { x: 'X', bluesky: 'Bluesky', bbc: 'BBC', jep: 'JEP', gov: 'gov.je', facebook: 'Facebook', web: 'Web', other: 'Web' };
  const EV_AREA = { guernsey: 'Guernsey', both: 'Jersey & Guernsey' };
  const EV_FILTERS = { all: 'All', major: 'Major', travel: 'Travel', power: 'Power', closures: 'Closures', weather: 'Weather' };
  const evMatches = (ev, f) => f === 'all' || (f === 'major' ? ev.severity === 'major' : f === 'weather' ? ev.category === 'weather' || ev.category === 'warning' : ev.category === f);
  const okTime = (t) => typeof t === 'string' && !isNaN(new Date(t));

  let evRaw = '';
  let evKey = '';
  let evFilter = 'all';
  let evGuernsey = (() => { try { return localStorage.getItem('events-guernsey') !== '0'; } catch (e) { return true; } })();
  const openEvents = new Set((() => { try { return JSON.parse(sessionStorage.getItem('open-events')) || []; } catch (e) { return []; } })());
  const seenEvents = new Set();
  let evFirstLoad = true;
  let postsOpen = false;

  function normEvents(d) {
    if (!d || !Array.isArray(d.events)) return null;
    const events = d.events
      .filter((e) => e && typeof e.id === 'string' && e.id && e.title && okTime(e.start))
      .map((e) => ({
        ...e,
        end: okTime(e.end) ? e.end : e.start,
        category: EV_CAT[e.category] ? e.category : 'other',
        severity: EV_SEV.includes(e.severity) ? e.severity : 'info',
        sources: (Array.isArray(e.sources) ? e.sources : []).filter((s) => s && typeof s === 'object'),
      }));
    return { updated: d.updated, events };
  }

  // X/Bluesky: the author's avatar (from the post pool when we have it); articles: the site's favicon
  function evSourceIcon(s) {
    if (s.type === 'x' || s.type === 'bluesky') {
      const x = s.type === 'x';
      const p = (x ? xPosts : (apiFeed && apiFeed.items) || []).find((i) => i.url === s.url) || {};
      return avatarHTML({ platform: x ? 'x' : 'bsky', source: x ? 'X' : 'Bluesky', url: s.url, id: p.id, avatar: p.avatar, author: s.publisher, handle: s.author }, 'av av-xs');
    }
    const known = { bbc: 'BBC Jersey', jep: 'Jersey Evening Post', gov: 'gov.je' }[s.type];
    if (known) return faviconHTML(known);
    let host = '';
    try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch (e) { /* no icon */ }
    const ff = letterHTML({ label: s.publisher || host, color: '' });
    if (!host || !feature('favicons')) return ff;
    return `<img class="fav" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64" data-ff="${esc(ff)}" width="16" height="16" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  }

  function evSourceHTML(s, n) {
    const social = s.type === 'x' || s.type === 'bluesky';
    return `<li><a class="evs" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">
      <span class="evs-n">${n}</span><span class="evs-ic">${evSourceIcon(s)}</span>
      <span class="evs-who"><b>${esc(s.publisher || s.author || 'Source')}</b>${social && s.author ? `<span class="evs-at">@${esc(s.author)}</span>` : ''}<span class="stype">${EV_SRC[s.type] || 'Web'}</span></span>
      ${okTime(s.time) ? `<time datetime="${esc(s.time)}">${esc(fmtTime(s.time))}</time>` : ''}
      ${s.title ? `<span class="evs-t">${esc(s.title)}</span>` : ''}<span class="sr-only"> (opens in a new tab)</span>
    </a></li>`;
  }

  function eventHTML(ev, i, isNew) {
    const [catLabel, catIcon] = EV_CAT[ev.category];
    const open = openEvents.has(ev.id);
    const sev = ev.severity === 'info' ? '<span class="sr-only">Info:</span>' : `<span class="ev-sev">${ev.severity === 'major' ? 'Major' : 'Notable'}</span>`;
    // [n] refs become superscript links to sources[n-1]; out-of-range refs stay as text
    const details = esc(ev.details).replace(/\[(\d+)\]/g, (m, n) => {
      const s = ev.sources[n - 1];
      return s && s.url ? `<sup><a class="ref" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" aria-label="Source ${n}: ${esc(s.publisher || '')}">${n}</a></sup>` : m;
    });
    const srcs = ev.sources.map((s, j) => evSourceHTML(s, j + 1)).join('');
    return `<article class="ev sev-${ev.severity}${open ? ' open' : ''}${isNew ? ' new' : ''}" data-id="${esc(ev.id)}">
      <div class="ev-head">
        <div class="ev-meta">${sev}<span class="ev-cat">${catIcon}${catLabel}</span>${EV_AREA[ev.area] ? `<span class="ev-area">${EV_AREA[ev.area]}</span>` : ''}<time datetime="${esc(ev.start)}">${esc(fmtRange(ev.start, ev.end))}</time></div>
        <h3 class="ev-h"><button class="ev-btn" type="button" aria-expanded="${open}" aria-controls="evb-${i}">${esc(ev.title)}</button></h3>
        ${ev.summary ? `<p class="ev-sum">${esc(ev.summary)}</p>` : ''}
        ${ICON.chev}
      </div>
      <div class="ev-body" id="evb-${i}"><div class="ev-inner"><div class="ev-content">
        ${ev.details ? `<p class="ev-details">${details}</p>` : ''}
        ${srcs ? `<h4 class="evs-h">Sources</h4><ol class="evs-list">${srcs}</ol>` : ''}
      </div></div></div>
    </article>`;
  }

  // Which mode the updates column is in: events timeline (posts collapsed) or the post feed as before.
  function applyMode() {
    const on = eventsMode();
    $('#events').hidden = !on;
    $('#all-posts').hidden = on && !postsOpen;
    const n = feedData ? feedData.items.length : 0;
    const t = $('#posts-toggle');
    t.setAttribute('aria-expanded', String(postsOpen));
    t.innerHTML = `${postsOpen ? 'Hide all posts' : `Show all posts${n ? ` <span class="cnt">${n}</span>` : ''}`} ${ICON.chev}`;
    if (!on && feedData) {
      $('#feed-count').textContent = `${feedData.items.length} updates`;
      $('#feed-count').className = 'muted small';
    }
  }

  function renderEvents() {
    if (!eventsMode()) { evKey = ''; applyMode(); return; }
    const now = new Date();
    const upd = okTime(eventsData.updated) ? new Date(eventsData.updated) : null;
    const stale = !!upd && now - upd > 6 * 3600e3;
    // skip identical re-renders so polling doesn't reset focus or images; the day is in the key for "Today" labels
    const key = [evRaw, evFilter, evGuernsey, stale, dayKey(now)].join('|');
    if (key === evKey) return;
    evKey = key;

    const cnt = $('#feed-count');
    cnt.textContent = upd ? `Updated ${fmtTime(eventsData.updated, now)}${stale ? ' · may be out of date' : ''}` : '';
    cnt.className = `small ${stale ? 'err' : 'muted'}`;

    // keep keyboard focus on the same control across a re-render
    const a = document.activeElement;
    const focusSel = a && a.closest && (a.dataset.evf ? `[data-evf="${a.dataset.evf}"]` : a.classList.contains('ev-btn') ? a.closest('.ev').dataset.id : null);

    const inArea = eventsData.events.filter((e) => evGuernsey || e.area !== 'guernsey');
    $('#ev-filters').innerHTML = Object.entries(EV_FILTERS).map(([k, label]) =>
      `<button type="button" data-evf="${k}" aria-pressed="${k === evFilter}">${label} <span class="cnt">${inArea.filter((e) => evMatches(e, k)).length}</span></button>`).join('');

    const list = inArea.filter((e) => evMatches(e, evFilter));
    let newCount = 0;
    let html = '';
    let day = '';
    list.forEach((ev, i) => {
      const d = dayLabel(new Date(ev.end)); // events arrive newest first by end, so group by end day
      if (d !== day) { day = d; html += `<div class="hour"><b>${esc(d)}</b></div>`; }
      const isNew = !evFirstLoad && !seenEvents.has(ev.id);
      if (isNew) newCount++;
      html += eventHTML(ev, i, isNew);
    });
    $('#ev-list').innerHTML = html || '<div class="card empty muted">No events match this filter.</div>';
    for (const e of eventsData.events) seenEvents.add(e.id);
    evFirstLoad = false;

    if (focusSel) {
      const el = focusSel.startsWith('[') ? $(focusSel) : $$('#ev-list .ev').find((c) => c.dataset.id === focusSel)?.querySelector('.ev-btn');
      if (el) el.focus({ preventScroll: true });
    }
    applyMode();
    if (newCount) showNewPill(newCount, 'event');
  }

  $('#ev-list').addEventListener('click', (e) => {
    const b = e.target.closest('.ev-btn');
    if (!b) return;
    const card = b.closest('.ev');
    const open = !card.classList.contains('open');
    card.classList.toggle('open', open);
    card.classList.remove('new');
    b.setAttribute('aria-expanded', String(open));
    if (open) openEvents.add(card.dataset.id); else openEvents.delete(card.dataset.id);
    try { sessionStorage.setItem('open-events', JSON.stringify([...openEvents])); } catch (err) { /* private mode */ }
  });
  $('#ev-filters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-evf]');
    if (!b) return;
    evFilter = b.dataset.evf;
    renderEvents();
  });
  const gsy = $('#ev-gsy');
  gsy.checked = evGuernsey;
  gsy.addEventListener('change', () => {
    evGuernsey = gsy.checked;
    try { localStorage.setItem('events-guernsey', evGuernsey ? '1' : '0'); } catch (e) { /* private mode */ }
    renderEvents();
  });
  $('#posts-toggle').addEventListener('click', () => {
    postsOpen = !postsOpen;
    applyMode();
  });

  // --- weather (/api/weather) ---
  const sev = (mph) => (mph >= 70 ? 'sev-red' : mph >= 50 ? 'sev-amber' : mph >= 40 ? 'sev-yellow' : '');
  const val = (v, unit = '') => (v == null || v === '' ? '—' : `${v}${unit}`);

  const RANK = { red: 0, amber: 1, orange: 1, yellow: 2 };
  const byColour = (a, b) => (RANK[a.colour] ?? 3) - (RANK[b.colour] ?? 3);
  // Marine warnings (e.g. "Channel Islands Shipping Area Wind") must not read as a warning for the island itself.
  const isSea = (w) => /shipping|sea area|marine|inshore|waters|small craft/i.test(`${w.type || ''} ${w.island || ''}`);
  function warnRowHTML(w) {
    const c = String(w.colour || 'yellow').toLowerCase();
    const name = isSea(w) ? `${w.kind || 'Wind'} warning` : w.type || `${w.kind || ''} warning`;
    const where = !isSea(w) && w.island && !String(name).includes(w.island) ? ` · ${w.island}` : '';
    return `<details class="wrow ${esc(c)}" data-k="${esc(`${w.type}|${w.island}`)}">
      <summary>
        <span class="badge ${esc(c)}">${esc(c)}</span>
        <span class="w-main"><span class="w-name">${esc(name)}${esc(where)}</span>${w.text ? `<span class="w-text">${esc(w.text)}</span>` : ''}</span>
        ${ICON.chev}
      </summary>
      <div class="w-body">
        ${w.validity ? `<p>${esc(w.validity)}</p>` : ''}
        ${Array.isArray(w.impacts) && w.impacts.length ? `<ul>${w.impacts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${w.extra ? `<p>${esc(w.extra)}</p>` : ''}
        <p class="small muted">${w.issued ? `${esc(w.issued)} · ` : ''}<a href="https://www.gov.je/weather/" target="_blank" rel="noopener noreferrer">Jersey Met ↗</a></p>
      </div>
    </details>`;
  }

  // Highest period gust over today and tomorrow, with a plain-language "when".
  function peakGust(f) {
    let best = null;
    f.days.slice(0, 2).forEach((d, i) => (Array.isArray(d.periods) ? d.periods : []).forEach((p) => {
      if (!p.gustMph || (best && p.gustMph <= best.mph)) return;
      const n = String(p.name || '').toLowerCase();
      const when = i === 0 ? (n === 'night' ? 'tonight' : `this ${n}`) : `tomorrow ${n}`;
      best = { mph: p.gustMph, when };
    }));
    if (best) return best;
    const d = f.days.slice(0, 2).reduce((a, b) => ((b.maxGustMph || 0) > (a.maxGustMph || 0) ? b : a));
    return d.maxGustMph ? { mph: d.maxGustMph, when: d === f.days[0] ? 'today' : 'tomorrow' } : null;
  }

  function renderNow() {
    const el = $('#now');
    const f = wxData && wxData.forecast;
    const pill = summaryData && feature('statusPill') && STATUS[summaryData.status] ? `<span class="pill st-${esc(summaryData.status)}">${STATUS[summaryData.status]}</span>` : '';

    let line = '<div class="skel line"></div>';
    if (f && Array.isArray(f.days) && f.days.length) {
      const pk = peakGust(f);
      line = pk
        ? `<p class="now-line ${sev(pk.mph)}">Gusts up to <b>${pk.mph}&nbsp;mph</b> ${esc(pk.when)}</p>`
        : `<p class="now-line">${esc(f.days[0].summary || 'No strong gusts in the forecast')}</p>`;
      if (pk && f.days[0].summary) line += `<p class="now-sub">Today: ${esc(f.days[0].summary)}</p>`;
    } else if (wxData) {
      line = '<p class="now-line">Forecast unavailable</p><p class="now-sub"><a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Check Jersey Met ↗</a></p>';
    }

    let warn = '';
    if (wxData) {
      const all = Array.isArray(wxData.warnings) ? wxData.warnings : [];
      const land = all.filter((w) => !isSea(w)).sort(byColour);
      const sea = all.filter(isSea).sort(byColour);
      const failed = wxData.sources && wxData.sources.warnings && wxData.sources.warnings.ok === false;
      const none = failed
        ? '<p class="w-none">Couldn\'t check warnings. <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Jersey Met ↗</a></p>'
        : '<p class="w-none">No warnings in force</p>';
      warn = `<div class="wgroup"><h3 class="wg-h">On land</h3>${land.length ? land.map(warnRowHTML).join('') : none}</div>`;
      if (sea.length) warn += `<div class="wgroup"><h3 class="wg-h">At sea <span>for boats and shipping</span></h3>${sea.map(warnRowHTML).join('')}</div>`;
    }

    const latest = feedData && feedData.items.find((i) => !i.dateOnly);
    const latestHTML = latest
      ? `<a class="latest" href="${esc(safeUrl(latest.url))}" target="_blank" rel="noopener noreferrer">
          <span class="l-meta"><b>Latest</b>${isPost(latest)
            ? `${avatarHTML(latest, 'av av-s')}${esc(latest.author || latest.handle)}`
            : `${faviconHTML(latest.source, latest.favicon)}${esc(src(latest.source).label)}`} · ${timeHTML(latest.time, 'ago')}</span>
          <span class="l-title">${esc(latest.title || latest.text)}</span>
        </a>`
      : '';

    // keep whatever the reader opened or closed across refreshes
    const prev = new Map($$('#now details[data-k]').map((d) => [d.dataset.k, d.open]));
    el.innerHTML = `<div class="now-head"><h2 id="now-h">Right now</h2>${pill}</div>
      <div class="now-main">${line}</div>
      ${warn ? `<div class="now-warn">${warn}</div>` : ''}
      ${latestHTML}`;
    $$('#now details[data-k]').forEach((d) => { if (prev.has(d.dataset.k)) d.open = prev.get(d.dataset.k); });
  }

  function renderWeather(wx) {
    wxData = wx;
    renderNow();
    const f = wx.forecast;
    const chip = $('#gust-chip');
    if (!f || !Array.isArray(f.days) || !f.days.length) {
      chip.hidden = true;
      $('#weather').innerHTML = `<div class="card err">Forecast unavailable right now. <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Open Jersey Met</a></div>`;
      return;
    }
    const today = f.days[0];
    const next = f.days[1];
    // Highest gust mentioned for today/tonight or tomorrow
    const gustDay = [today, next].filter(Boolean).reduce((a, b) => ((b.maxGustMph || 0) > (a.maxGustMph || 0) ? b : a));
    const gust = gustDay.maxGustMph;
    if (gust) { chip.innerHTML = `<span class="gc-l">Gusts </span>${gust} mph`; chip.className = `gust-chip ${sev(gust)}`; chip.hidden = false; } else chip.hidden = true;

    const periods = Array.isArray(today.periods) ? today.periods : [];
    const sunBits = [today.sunrise && `Sunrise ${esc(today.sunrise)}`, today.sunset && `Sunset ${esc(today.sunset)}`, today.uv && `UV ${esc(today.uv)}`].filter(Boolean);
    let html = `<div class="card cond ${sev(gust || 0)}">
      <div class="cond-top"><div>
        <div class="cond-big">${gust ? `${gust}<small>mph</small>` : '—'}</div>
        <div class="cond-lbl"><b>Max gusts forecast</b> · ${esc(gustDay.day)}${gust ? '' : ' · none mentioned'}</div>
      </div></div>
      <div class="stats">
        <div class="stat"><b>${f.currentTemp != null ? Math.round(f.currentTemp) + '°C' : '—'}</b><span>Now</span></div>
        <div class="stat"><b>${val(today.windMph, ' mph')}</b><span>Wind ${esc(today.windDir || '')} ${esc(today.windForce || '')}</span></div>
        <div class="stat"><b>${val(today.maxRain, '%')}</b><span>Rain chance</span></div>
      </div>
      ${today.summary ? `<p class="cond-sum">${esc(today.summary)}</p>` : ''}
    </div>`;
    if (periods.length) {
      html += `<div class="card"><h3>${esc(today.day)}</h3>
        <div class="periods">${periods.map((p) => `<div class="period">
          <div><div class="pn">${esc(p.name)}</div><div class="pd">${esc(p.desc)}</div>${p.wind ? `<div class="pd ${p.gustMph >= 50 ? 'hi' : ''}">${esc(p.wind)}</div>` : ''}</div>
          <div class="pw"><b>${val(p.mph, ' mph')} ${esc(p.dir || '')}</b>${p.gustMph ? `<span class="${p.gustMph >= 50 ? 'hi' : ''}">gusts ${p.gustMph}</span><br>` : ''}<span class="muted">${val(p.rain, '%')} rain</span></div>
        </div>`).join('')}</div>
        ${sunBits.length ? `<div class="sun">${sunBits.map((b) => `<span>${b}</span>`).join('')}</div>` : ''}
      </div>`;
    }
    const later = f.days.slice(1, 6);
    if (later.length) {
      const maxG = Math.max(90, ...later.map((d) => d.maxGustMph || d.windMph || 0));
      html += `<div class="card"><h3>Next few days</h3><div class="days">
        ${later.map((d) => {
          const g = d.maxGustMph || d.windMph || 0;
          return `<div class="day">
            <div class="day-n">${esc(d.day)}</div>
            <div class="day-t">${val(d.max, '°')} <span>${val(d.min, '°')}</span></div>
            ${d.summary ? `<div class="day-s">${esc(d.summary)}</div>` : ''}
            <div class="day-w"><span>${val(d.windMph, ' mph')} ${esc(d.windDir || '')}</span><span class="bar"><i class="${sev(g)}" style="width:${Math.round((g / maxG) * 100)}%"></i></span><span class="${d.maxGustMph >= 50 ? 'hi' : ''}">${d.maxGustMph ? `gusts ${d.maxGustMph}` : ''}</span><span>${val(d.maxRain, '%')} rain</span></div>
          </div>`;
        }).join('')}
      </div>
      ${next && next.windDescription ? `<p class="wind-desc"><strong>${esc(next.day)}:</strong> ${esc(next.windDescription)}</p>` : ''}
      </div>`;
    }
    html += `<p class="issued">Jersey Met forecast issued ${esc(f.issued)} · <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">gov.je/weather ↗</a></p>`;
    $('#weather').innerHTML = html;
  }

  // --- status + loading ---
  let lastOk = null;
  function setStatus(ok, msg) {
    $('#live-dot').className = 'dot ' + (ok ? 'ok' : 'err');
    $('#updated').innerHTML = msg; // msg is built from our own strings and times only
  }

  async function loadX() {
    try { xPosts = ((await getJSON('/x-posts.json')).posts || []).filter((p) => p && p.url && p.time); } catch (e) { /* keep previous */ }
  }
  async function loadSummary() {
    try { summaryData = await getJSON('/summary.json'); renderSummary(); renderNow(); } catch (e) { /* keep previous */ }
  }
  async function loadFeed() {
    const xp = loadX();
    try {
      apiFeed = await getJSON('/api/feed');
      await xp;
      renderFeed();
      lastOk = new Date();
      setStatus(true, `<span class="gc-l">Live · </span>Updated ${hm(lastOk)}`);
    } catch (e) {
      await xp;
      if (xPosts.length) renderFeed();
      if (!feedData) $('#feed').innerHTML = '<div class="card empty err">Could not load updates. Retrying shortly…</div>';
      setStatus(false, lastOk ? `Offline? Last update ${hm(lastOk)}` : 'Could not load updates');
    }
  }
  // Network errors keep the events we have; a missing, invalid or empty file falls back to the post feed.
  async function loadEvents() {
    let r;
    try { r = await fetch('/events.json', { cache: 'no-cache' }); } catch (e) { if (!eventsData) applyMode(); return; }
    const text = r.ok ? await r.text().catch(() => '') : '';
    try { eventsData = text ? normEvents(JSON.parse(text)) : null; } catch (e) { eventsData = null; }
    evRaw = text;
    renderEvents();
  }
  async function loadWeather() {
    try {
      renderWeather(await getJSON('/api/weather'));
    } catch (e) {
      if (!$('#weather .card')) $('#weather').innerHTML = '<div class="card err">Forecast unavailable. <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Open Jersey Met</a></div>';
    }
  }

  const refreshBtn = $('#refresh');
  async function refreshAll() {
    refreshBtn.classList.add('spinning');
    await Promise.allSettled([loadSummary(), loadEvents(), loadFeed(), loadWeather()]);
    refreshBtn.classList.remove('spinning');
  }
  refreshBtn.addEventListener('click', refreshAll);

  // --- theme: auto (follows OS) / light / dark, persisted ---
  const THEMES = ['auto', 'light', 'dark'];
  const themeBtn = $('#theme-toggle');
  const storedTheme = () => { try { return localStorage.getItem('theme'); } catch (e) { return null; } };
  function applyTheme(t, persist) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
    if (persist) { try { t === 'auto' ? localStorage.removeItem('theme') : localStorage.setItem('theme', t); } catch (e) { /* private mode */ } }
    const metas = $$('meta[name="theme-color"]');
    metas.forEach((m) => {
      if (!m.dataset.orig) m.dataset.orig = m.content;
      m.content = t === 'auto' ? m.dataset.orig : t === 'dark' ? '#15171b' : '#f6f7f9';
    });
    themeBtn.innerHTML = ICON[t];
    themeBtn.setAttribute('aria-label', `Theme: ${t}. Click to change`);
    themeBtn.title = `Theme: ${t === 'auto' ? 'auto (follows system)' : t}`;
  }
  const currentTheme = () => document.documentElement.dataset.theme || 'auto';
  themeBtn.addEventListener('click', () => applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length], true));
  applyTheme(currentTheme(), false);

  // --- mobile views: Updates / Forecast / Info (desktop shows all) ---
  const VIEWS = ['updates', 'forecast', 'info'];
  function setView(v, scroll) {
    if (!VIEWS.includes(v)) v = 'updates';
    document.body.dataset.active = v;
    $$('.tabbar button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.go === v)));
    history.replaceState(null, '', v === 'updates' ? location.pathname + location.search : `#${v}`);
    if (scroll) {
      if (mobile.matches) window.scrollTo({ top: 0 });
      else if (v !== 'updates') document.getElementById(v).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  $('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-go]');
    if (b) setView(b.dataset.go, true);
  });
  $('#gust-chip').addEventListener('click', () => setView('forecast', true));
  if (location.hash) setView(location.hash.slice(1), mobile.matches);

  // --- optional extension files, then first load ---
  Promise.all([getOptional('/config.json'), getOptional('/sources.json')]).then(([cfg, srcs]) => {
    if (cfg && typeof cfg === 'object') {
      config = { ...config, ...cfg, theme: { ...(cfg.theme || {}) }, refresh: { ...(cfg.refresh || {}) }, features: { ...(cfg.features || {}) } };
      if (typeof cfg.title === 'string' && cfg.title) $('#site-title').textContent = cfg.title;
      if (typeof cfg.subtitle === 'string' && cfg.subtitle) { $('#subtitle').textContent = cfg.subtitle; $('#subtitle').hidden = false; }
      const accent = safeColor(config.theme.accent);
      if (accent) document.documentElement.style.setProperty('--accent', accent);
      if (!storedTheme() && ['light', 'dark'].includes(config.theme.mode)) applyTheme(config.theme.mode, false);
    }
    if (srcs && srcs.sources && typeof srcs.sources === 'object') customSources = srcs.sources;
  }).finally(() => {
    const secs = (v, d) => (typeof v === 'number' && v >= 30 ? v : d) * 1000;
    const feedEvery = secs(config.refresh.feedSeconds, 180);
    const wxEvery = secs(config.refresh.weatherSeconds, 300);
    const eventsEvery = secs(config.refresh.eventsSeconds, 120);
    refreshAll();
    setInterval(loadEvents, eventsEvery);
    setInterval(loadFeed, feedEvery);
    setInterval(loadWeather, wxEvery);
    setInterval(loadSummary, wxEvery);
  });

  // refresh relative times every minute, and refresh on return to the tab
  setInterval(() => { updateTimes(); renderEvents(); }, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!lastOk || Date.now() - lastOk > 60 * 1000)) refreshAll();
  });
})();
