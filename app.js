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
  const hourLabel = (d) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: true }).format(d).replace(/\s/g, '').toLowerCase(); // "2pm"
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
  // One way to write times and wind speeds, whatever the source wrote: "14:43 UTC" and "5.30pm" become Jersey time
  // like "3:43pm", and knots get mph alongside ("60kt (69 mph)", "20–30 knots (23–35 mph)").
  const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const mph = (kt) => Math.round(kt * 1.15078);
  function tidy(s) {
    return String(s ?? '')
      .replace(/\b(\d{1,2}):(\d{2})\s*(?:UTC|GMT)\b((?:\s+on)?\s+\w+day\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}))?/g, (m, h, mi, rest, dd, mon, yy) => {
        const now = new Date();
        const mo = mon ? MONTH_NAMES.indexOf(mon.toLowerCase()) : -1;
        const d = mo >= 0 ? new Date(Date.UTC(+yy, mo, +dd, +h, +mi)) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), +h, +mi));
        return isNaN(d) ? m : clock(d) + (rest || '');
      })
      .replace(/\b(\d{1,2})[.:](\d{2})\s?([ap])\.?m\b\.?/gi, (m, h, mi, ap) => `${+h}:${mi}${ap.toLowerCase()}m`)
      .replace(/\b(\d{1,3})(?:\s*(?:–|-|to)\s*(\d{1,3}))?\s?(knots|kts|kt)\b(?!\s*\(\d)/gi, (m, a, b) => `${m} (${b ? `${mph(a)}–${mph(b)}` : mph(a)} mph)`);
  }
  // Raw links in source text become just the site ("bit.ly/…"); markdown links "[label](url)" are left alone.
  // (No regex look-behind: Safari before 16.4 can't parse one, which would stop the whole script.)
  const shortUrls = (s) => String(s ?? '').replace(/https?:\/\/(?:www\.)?([^\s/)]+)(\/[^\s)]*)?/g, (m, host, path, at, str) =>
    (str.slice(at - 2, at) === '](' ? m : host + (path && path.length > 1 ? '/…' : '')));
  const plain = (s) => shortUrls(tidy(s));
  // "07:12" (24-hour) → "7:12am"; anything else is left as it is
  const clock24 = (s) => String(s ?? '').replace(/^(\d{1,2}):(\d{2})$/, (m, h, mi) => `${+h % 12 || 12}:${mi}${+h < 12 ? 'am' : 'pm'}`);
  const TIME_FMT = {
    item: (d) => `${clock(d)} · ${ago(d)}`,
    date: (d) => dayLabel(d),
    post: (d) => `${clock(d)} · ${dayLabel(d)} · ${ago(d)}`,
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

  // --- motion: short transitions that explain a change of state; all skipped under reduced motion ---
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
  // Crossfade a whole-page change (theme, mobile tab) where View Transitions exist; otherwise apply it directly.
  function withTransition(update) {
    if (!document.startViewTransition || reduceMotion.matches) { update(); return; }
    document.startViewTransition(update);
  }
  // --- haptics: a light tap under the finger on phones, like native controls ---
  // Android (and any browser with navigator.vibrate) gets a short vibration. iOS Safari has no vibrate API, but
  // toggling an <input type="checkbox" switch> (iOS 18+) plays the system selection haptic, so a hidden one is
  // clicked during the tap. Both only work inside a user gesture, which is where these calls run.
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function haptic(strong) {
    if (!coarsePointer.matches) return;
    if (typeof navigator.vibrate === 'function') { try { navigator.vibrate(strong ? 18 : 10); } catch (e) { /* blocked */ } return; }
    if (!isIOS) return;
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.append(input);
    document.head.append(label);
    label.click();
    label.remove();
  }
  const HAPTIC_FIRM = '#refresh';
  const HAPTIC_LIGHT = '.ev-btn, #ev-filters button, #filters button, #theme-toggle, .tabbar button, #posts-toggle, #new-pill, #gust-chip, .tile, #detail-btn, #mode-toggle, .img-tabs button, #travel-sum, details > summary';
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest(HAPTIC_FIRM)) haptic(true);
    else if (e.target.closest(HAPTIC_LIGHT)) haptic(false);
  }, true);

  // FLIP: note where each keyed row ([data-k]) sits, re-render, then glide rows from their old place to the new one.
  const rowTops = (root) => new Map([...root.querySelectorAll('[data-k]')].map((el) => [el.dataset.k, el.getBoundingClientRect().top]));
  function glide(root, before) {
    if (!before || reduceMotion.matches || !Element.prototype.animate) return;
    const vh = window.innerHeight;
    let entering = 0;
    for (const el of root.querySelectorAll('[data-k]')) {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue; // off screen: nothing to see
      const was = before.get(el.dataset.k);
      const dy = was == null ? null : was - r.top;
      if (dy == null || Math.abs(dy) > vh) {
        el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: Math.min(entering++, 6) * 28, easing: EASE_OUT, fill: 'backwards' });
      } else if (Math.abs(dy) > 1) {
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 340, easing: EASE_OUT });
      }
    }
  }
  // Skeleton → content: the first real render of a part fades in (opacity only, so nothing moves).
  function fadeIn(nodes) {
    if (reduceMotion.matches || !Element.prototype.animate) return;
    for (const n of nodes) if (n) n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
  }
  // A live number that changed since the last refresh rolls up into place, so the change gets noticed.
  const lastNums = new Map();
  function tick(key, el, value) {
    const was = lastNums.get(key);
    lastNums.set(key, value);
    if (was === undefined || was === value || !el || reduceMotion.matches || !el.animate) return;
    el.animate([{ opacity: 0, transform: 'translateY(0.45em)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE_OUT });
  }
  let feedData = null; // merged: {items, sources}
  let apiFeed = null;
  let xPosts = [];
  let summaryData = null;
  let wxData = null;
  // set once each source has answered (or failed), so skeletons give way to content or an error message
  let wxTried = false;
  let feedTried = false;
  let eventsTried = false;
  let eventsData = null; // normalised /events.json, or null to show the post feed instead
  const eventsMode = () => !!(eventsData && eventsData.events.length);
  let activeSource = 'All';
  const seenUrls = new Set();
  let firstLoad = true;
  let detailed = (() => { try { return localStorage.getItem('view-mode') === 'detailed'; } catch (e) { return false; } })();

  // Keep what the reader is looking at in place while content above it re-renders (an innerHTML swap
  // defeats the browser's own scroll anchoring). Call before the change; call the returned function after.
  function anchor() {
    if (window.scrollY < 8) return () => {};
    const y = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hdr')) || 60) + 12;
    // prefer a card to a day heading: new cards arrive just under the heading, so the heading itself doesn't move
    let el = null;
    for (let dy = 0; dy < 240 && !el; dy += 24) {
      const hit = document.elementFromPoint(window.innerWidth / 2, y + dy);
      el = hit && hit.closest('[data-k]:not(.hour)');
    }
    if (!el) { const hit = document.elementFromPoint(window.innerWidth / 2, y); el = hit && hit.closest('[id]'); }
    if (!el || el === document.body) return () => {};
    const scope = el.dataset.k && el.parentElement.closest('[id]');
    const sel = el.dataset.k ? `${scope ? `#${CSS.escape(scope.id)} ` : ''}[data-k="${CSS.escape(el.dataset.k)}"]` : `#${CSS.escape(el.id)}`;
    const top = el.getBoundingClientRect().top;
    return () => {
      const now = document.querySelector(sel);
      const dy = now ? now.getBoundingClientRect().top - top : 0;
      if (Math.abs(dy) > 1) window.scrollBy(0, dy);
    };
  }
  const bust = (url) => `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

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
    return `<div class="pmedia n${imgs.length}">${imgs.map((m) => `<div class="pm"><img src="${esc(safeUrl(m.thumb || m.url))}" alt="${esc(m.alt || '')}" loading="lazy" referrerpolicy="no-referrer" data-gone="parent">${m.type === 'video' || m.type === 'animated_gif' ? '<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg></span>' : ''}</div>`).join('')}</div>`;
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
  function postCardHTML(it, extraCls = '', k = '') {
    const x = it.platform === 'x' || it.source === 'X';
    const name = it.author || it.handle;
    const av = avatarHTML(it);
    return `<a class="pcard ${x ? 'is-x' : 'is-bsky'} ${extraCls}"${k ? ` data-k="${esc(k)}"` : ''} href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">
      <div class="phead">${av}<div class="pwho"><span class="pname">${esc(name)}</span><span class="phandle">@${esc(it.handle)}</span></div>${x ? ICON_X : ICON_BSKY}</div>
      <div class="ptext">${esc(shortUrls(it.text))}</div>
      ${mediaHTML(it.media)}
      ${tagsHTML(it)}
      <div class="pfoot">${timeHTML(it.time, 'post')}<span>View on ${x ? 'X' : 'Bluesky'}<span class="ext" aria-hidden="true"></span></span></div>
    </a>`;
  }
  function itemHTML(it, isNew, k = '') {
    const s = src(it.source);
    const d = disp(it);
    const title = it.title || (isPost(it) ? it.author || (it.handle ? '@' + it.handle : '') : '');
    const warn = it.warning ? `<span class="badge ${esc(it.warning)}">${esc(it.warning)}</span>` : '';
    const img = isUrl(d.image) ? `<img class="thumb" src="${esc(d.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
    return `<a class="item ${itemClasses(it, isNew)}"${k ? ` data-k="${esc(k)}"` : ''} href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">
      <div class="meta">${faviconHTML(it.source, it.favicon)}<span class="src">${esc(s.label)}</span>${s.official ? ICON.check : ''}${warn}${d.pinned ? '<span class="pin">Pinned</span>' : ''}${timeHTML(it.time, it.dateOnly ? 'date' : 'item')}</div>
      <div class="item-body"><div>
        ${title ? `<h3 class="title">${esc(plain(title))}</h3>` : ''}
        ${it.text ? `<p class="text">${esc(plain(it.text))}</p>` : ''}
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
      const key = it.dateOnly ? dayLabel(d) : `${dayLabel(d)}|${hourLabel(d)}`;
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
    const fix = anchor();
    let newCount = 0;
    if (!items.length) {
      $('#feed').innerHTML = '<div class="card empty muted">No storm updates found right now. Check back soon.</div>';
    } else {
      let html = '';
      for (const g of groupItems(items)) {
        const [day, hour] = g.key.split('|');
        html += `<div class="hour"><b>${esc(day)}</b>${hour ? ` ${esc(hour)}` : ''}</div>`;
        for (const it of g.items) {
          const isNew = !firstLoad && !seenUrls.has(it.url);
          if (isNew) newCount++;
          const k = `u:${it.url}`;
          html += isPost(it) && feature('postCards') ? postCardHTML(it, itemClasses(it, isNew), k) : itemHTML(it, isNew, k);
        }
      }
      $('#feed').innerHTML = html;
    }
    fix();
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
    el.innerHTML = `<summary>Sources: ${good.length} live${bad.length ? ` · <span class="err">unavailable: ${esc(bad.map((s) => s.name).join(', '))}</span>` : ''}${ICON.chev}</summary>
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
  function showNewPill(n) {
    if (mobile.matches && document.body.dataset.active !== 'updates') return;
    if (listEl().getBoundingClientRect().top > 0) return; // top of the list already visible
    pill.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>${n} new update${n === 1 ? '' : 's'}`;
    pill.hidden = false;
  }
  pill.addEventListener('click', () => {
    pill.hidden = true;
    $('#feed-h').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('scroll', () => { if (!pill.hidden && listEl().getBoundingClientRect().top > 0) pill.hidden = true; }, { passive: true });

  // --- summary box (static /summary.json) ---
  function md(s) {
    return esc(tidy(s))
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
    const upd = valid ? `Updated ${fmtTime(s.updatedAt)}${stale ? ' · may be out of date' : ''}` : '';
    const hls = (Array.isArray(s.highlights) ? s.highlights : []).filter((h) => h && (h.label || h.value)).slice(0, 8);
    const hlHTML = hls.length
      ? `<div class="highlights">${hls.map((h) => {
          const inner = `<span class="hl-v">${esc(tidy(h.value))}</span><span class="hl-l">${esc(tidy(h.label))}</span>`;
          return isUrl(h.source) ? `<a class="hl" href="${esc(h.source)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="hl">${inner}</div>`;
        }).join('')}</div>`
      : '';
    const secs = Array.isArray(s.sections) ? s.sections : [];
    const secIcon = (ic) => (typeof ic === 'string' && ic.length <= 8 && /[^\x00-\x7F]/.test(ic) ? `<span aria-hidden="true">${esc(ic)}</span>` : '');
    const secHTML = (sec) => `<h3>${secIcon(sec.icon)}${esc(sec.title)}</h3><ul>${(sec.points || []).map((p) => `<li>${md(p)}</li>`).join('')}</ul>`;
    // the first 3 points of the first section stay visible; the rest of it and the other sections sit behind "Show more"
    const lead = secs[0] || { points: [] };
    const leadPts = Array.isArray(lead.points) ? lead.points : [];
    const first = secs.length ? secHTML({ ...lead, points: leadPts.slice(0, 3) }) : '';
    const more = leadPts.length > 3 ? `<ul class="sum-cont">${leadPts.slice(3).map((pt) => `<li>${md(pt)}</li>`).join('')}</ul>` : '';
    const rest = more + secs.slice(1).map(secHTML).join('');
    const posts = Array.isArray(s.posts) ? s.posts : [];
    const wasOpen = box.querySelector('details') && box.querySelector('details').open;
    const updEl = $('#sum-upd');
    updEl.textContent = upd;
    updEl.className = `small ${stale ? 'err' : 'muted'}`;
    const wasBusy = box.hasAttribute('aria-busy');
    const fix = anchor();
    box.removeAttribute('aria-busy');
    box.innerHTML = `<p class="sum-lead">${md(s.headline)}</p>
      ${hlHTML}
      ${first}
      ${rest || posts.length ? `<details${wasOpen ? ' open' : ''}><summary>Show more ${ICON.chev}</summary>${rest}<div id="sum-posts" class="sum-posts"></div></details>` : ''}`;
    sec.hidden = false;
    if (wasBusy) fadeIn([...box.children]);
    renderSummaryPosts();
    fix();
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
  // own-property lookups, so values like "constructor" in the data fall back instead of hitting Object.prototype
  const pick = (map, k) => (typeof k === 'string' && Object.hasOwn(map, k) ? map[k] : undefined);
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
  let evGlide = false; // set by filter and area changes so the next render animates the list

  // --- "New since your last visit": event ids this device saw last time (ignored after a week, e.g. a new storm) ---
  // The baseline is pinned for the tab session, so a reload doesn't clear the marks.
  const lastVisit = (() => {
    try {
      let raw = sessionStorage.getItem('visit-base');
      if (raw === null) { raw = localStorage.getItem('seen-events') || ''; sessionStorage.setItem('visit-base', raw); }
      const v = raw ? JSON.parse(raw) : null;
      return v && Array.isArray(v.ids) && okTime(v.at) && Date.now() - new Date(v.at) < 7 * 864e5 ? { ids: new Set(v.ids), at: v.at } : null;
    } catch (e) { return null; }
  })();
  const unseen = (ev) => !!lastVisit && !lastVisit.ids.has(ev.id);
  function saveSeen() {
    if (!seenEvents.size) return;
    try { localStorage.setItem('seen-events', JSON.stringify({ ids: [...seenEvents], at: new Date().toISOString() })); } catch (e) { /* private mode */ }
  }
  const SEV_RANK = { major: 0, notable: 1, info: 2 };

  function normEvents(d) {
    if (!d || !Array.isArray(d.events)) return null;
    const events = d.events
      .filter((e) => e && typeof e.id === 'string' && e.id && e.title && okTime(e.start))
      .map((e) => ({
        ...e,
        end: okTime(e.end) ? e.end : e.start,
        category: pick(EV_CAT, e.category) ? e.category : 'other',
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
    const known = pick({ bbc: 'BBC Jersey', jep: 'Jersey Evening Post', gov: 'gov.je' }, s.type);
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
      <span class="evs-who"><b>${esc(s.publisher || s.author || 'Source')}</b>${social && s.author ? `<span class="evs-at">@${esc(s.author)}</span>` : ''}<span class="stype">${pick(EV_SRC, s.type) || 'Web'}</span></span>
      ${okTime(s.time) ? `<time datetime="${esc(s.time)}">${esc(fmtTime(s.time))}</time>` : ''}
      ${s.title ? `<span class="evs-t">${esc(plain(s.title))}</span>` : ''}<span class="sr-only"> (opens in a new tab)</span>
    </a></li>`;
  }

  // Built only when a card opens: collapsed cards would otherwise load every avatar (one function call each).
  function evSourcesHTML(ev) {
    const srcs = ev.sources.map((s, j) => evSourceHTML(s, j + 1)).join('');
    return srcs ? `<h4 class="evs-h">Sources</h4><ol class="evs-list">${srcs}</ol>` : '';
  }

  function eventHTML(ev, i, isNew) {
    const [catLabel, catIcon] = EV_CAT[ev.category];
    const open = openEvents.has(ev.id);
    const sev = ev.severity === 'info' ? '<span class="sr-only">Info:</span>' : `<span class="ev-sev">${ev.severity === 'major' ? 'Major' : 'Notable'}</span>`;
    // [n] refs become superscript links to sources[n-1]; out-of-range refs stay as text
    const details = esc(plain(ev.details)).replace(/\[(\d+)\]/g, (m, n) => {
      const s = ev.sources[n - 1];
      return s && s.url ? `<sup><a class="ref" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer" aria-label="Source ${n}: ${esc(s.publisher || '')}">${n}</a></sup>` : m;
    });
    return `<article class="ev sev-${ev.severity}${open ? ' open' : ''}${isNew ? ' new' : ''}" data-id="${esc(ev.id)}" data-k="ev:${esc(ev.id)}">
      <div class="ev-head">
        <div class="ev-meta">${unseen(ev) ? '<span class="ev-new">New</span>' : ''}${sev}<span class="ev-cat">${catIcon}${catLabel}</span>${pick(EV_AREA, ev.area) ? `<span class="ev-area">${pick(EV_AREA, ev.area)}</span>` : ''}<time datetime="${esc(ev.start)}">${esc(fmtRange(ev.start, ev.end))}</time></div>
        <h3 class="ev-h"><button class="ev-btn" type="button" aria-expanded="${open}" aria-controls="evb-${i}">${esc(plain(ev.title))}</button></h3>
        ${ev.summary ? `<p class="ev-sum">${esc(plain(ev.summary))}</p>` : ''}
        ${ICON.chev}
      </div>
      <div class="ev-body" id="evb-${i}"><div class="ev-inner"><div class="ev-content">
        ${ev.details ? `<p class="ev-details">${details}</p>` : ''}
        ${open ? evSourcesHTML(ev) : ''}
      </div></div></div>
    </article>`;
  }

  // Which mode the updates column is in: events timeline (posts collapsed) or the post feed as before.
  function applyMode() {
    if (!eventsTried) return; // the timeline skeleton holds the space until events.json answers
    $('#ev-list').removeAttribute('aria-busy');
    const on = eventsMode();
    $('#events').hidden = !on;
    $('#all-posts').hidden = on && (!postsOpen || !detailed);
    const n = feedData ? feedData.items.length : 0;
    const t = $('#posts-toggle');
    t.hidden = !detailed;
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

    // within each day (events arrive newest first by end), Major comes first, then Notable, then the rest
    const byDay = [];
    for (const e of inArea.filter((x) => evMatches(x, evFilter))) {
      const k = dayKey(new Date(e.end));
      if (!byDay.length || byDay[byDay.length - 1].k !== k) byDay.push({ k, items: [] });
      byDay[byDay.length - 1].items.push(e);
    }
    const list = byDay.flatMap((g) => g.items.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]));
    let newCount = 0;
    let html = '';
    let day = '';
    const fresh = list.filter(unseen).length;
    if (fresh) html += `<div class="since" data-k="since">${fresh} new since your last visit at ${esc(fmtTime(lastVisit.at, now))}</div>`;
    list.forEach((ev, i) => {
      const d = dayLabel(new Date(ev.end)); // events arrive newest first by end, so group by end day
      if (d !== day) { day = d; html += `<div class="hour" data-k="day:${esc(d)}"><b>${esc(d)}</b></div>`; }
      const isNew = !evFirstLoad && !seenEvents.has(ev.id);
      if (isNew) newCount++;
      html += eventHTML(ev, i, isNew);
    });
    const before = evGlide ? rowTops($('#ev-list')) : null;
    const firstPaint = $('#ev-list').hasAttribute('aria-busy');
    evGlide = false;
    const fix = anchor();
    $('#ev-list').innerHTML = html || '<div class="card empty muted">No events match this filter.</div>';
    fix();
    glide($('#ev-list'), before);
    if (firstPaint) fadeIn([...$('#ev-list').children].slice(0, 10));
    for (const e of eventsData.events) seenEvents.add(e.id);
    evFirstLoad = false;
    saveSeen();

    if (focusSel) {
      const el = focusSel.startsWith('[') ? $(focusSel) : $$('#ev-list .ev').find((c) => c.dataset.id === focusSel)?.querySelector('.ev-btn');
      if (el) el.focus({ preventScroll: true });
    }
    applyMode();
    if (newCount) showNewPill(newCount);
  }

  $('#ev-list').addEventListener('click', (e) => {
    const b = e.target.closest('.ev-btn');
    if (!b) return;
    const card = b.closest('.ev');
    const open = !card.classList.contains('open');
    const content = card.querySelector('.ev-content');
    if (open && !content.querySelector('.evs-list')) {
      const ev = eventsData && eventsData.events.find((x) => x.id === card.dataset.id);
      if (ev) content.insertAdjacentHTML('beforeend', evSourcesHTML(ev));
    }
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
    evGlide = true;
    renderEvents();
  });
  const gsy = $('#ev-gsy');
  gsy.checked = evGuernsey;
  gsy.addEventListener('change', () => {
    haptic(false); // on change rather than click, so tapping the label doesn't tap twice
    evGuernsey = gsy.checked;
    try { localStorage.setItem('events-guernsey', evGuernsey ? '1' : '0'); } catch (e) { /* private mode */ }
    evGlide = true;
    renderEvents();
  });
  $('#posts-toggle').addEventListener('click', () => {
    postsOpen = !postsOpen;
    applyMode();
  });

  // --- weather (/api/weather) ---
  const sev = (mph) => (mph >= 70 ? 'sev-red' : mph >= 50 ? 'sev-amber' : mph >= 40 ? 'sev-yellow' : '');
  const val = (v, unit = '') => (v == null || v === '' ? '—' : `${v}${unit}`);

  // --- warning banner (/api/warnings): the most serious Jersey Met warning; hidden when none is in force ---
  const WARN_COLOURS = ['red', 'amber', 'orange', 'yellow'];
  let warnData = null;
  let warnOkAt = 0;
  function renderBanner() {
    const el = $('#warn-banner');
    const ws = warnData && Array.isArray(warnData.warnings) ? warnData.warnings.filter((w) => w && w.title) : [];
    const fix = anchor();
    el.classList.remove('pending');
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
    if (!ws.length) { el.hidden = true; fix(); return; }
    const w = ws[0];
    const c = WARN_COLOURS.includes(w.colour) ? w.colour : 'yellow';
    const meta = [okTime(w.issuedAt) && `Issued ${fmtTime(w.issuedAt)}`, ws.length > 1 && `+${ws.length - 1} more`].filter(Boolean).join(' · ');
    el.className = `warn-banner ${c}`;
    if (isUrl(warnData.source)) el.href = warnData.source;
    el.innerHTML = `<span class="badge ${c}">${esc(c)}</span>
      <span class="wb-main"><b class="wb-title">${esc(w.title)}</b>${w.summary ? `<span class="wb-sum">${esc(tidy(w.summary))}</span>` : ''}
      <span class="wb-meta">${meta ? `${esc(meta)} · ` : ''}Jersey Met<span class="ext" aria-hidden="true"></span></span></span>`;
    el.hidden = false;
    fix();
  }
  async function loadWarnings() {
    try { warnData = await getJSON(bust('/api/warnings')); warnOkAt = Date.now(); } catch (e) {
      if (Date.now() - warnOkAt > 30 * 60e3) warnData = null; // a passing blip keeps the last warning; a long outage hides it
    }
    renderBanner();
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

  const SK_NOW = {
    main: '<div class="sk sk-display"></div><div class="sk sk-text"></div><div class="sk sk-text sk-w60 sk-wrap2"></div>',
    latest: '<div class="latest" aria-hidden="true"><div class="sk sk-label"></div><div class="sk sk-text"></div><div class="sk sk-text sk-w60"></div></div>',
  };
  function renderNow() {
    const el = $('#now-live');
    const f = wxData && wxData.forecast;
    const pill = summaryData && feature('statusPill') && STATUS[summaryData.status] ? `<span class="pill st-${esc(summaryData.status)}">${STATUS[summaryData.status]}</span>` : '';

    let line = SK_NOW.main;
    let peakMph = null;
    if (f && Array.isArray(f.days) && f.days.length) {
      const pk = peakGust(f);
      peakMph = pk ? pk.mph : null;
      line = pk
        ? `<p class="now-line ${sev(pk.mph)}">Gusts up to <b>${pk.mph}&nbsp;mph</b> ${esc(pk.when)}</p>`
        : `<p class="now-line">${esc(f.days[0].summary || 'No strong gusts in the forecast')}</p>`;
      if (pk && f.days[0].summary) line += `<p class="now-sub">Today: ${esc(f.days[0].summary)}</p>`;
    } else if (wxData || wxTried) {
      line = '<p class="now-line">Forecast unavailable</p><p class="now-sub"><a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Check Jersey Met<span class="ext" aria-hidden="true"></span></a></p>';
    }

    const latest = feedData && feedData.items.find((i) => !i.dateOnly);
    const latestHTML = latest
      ? `<a class="latest" href="${esc(safeUrl(latest.url))}" target="_blank" rel="noopener noreferrer">
          <span class="l-meta"><b>Latest</b>${isPost(latest)
            ? `${avatarHTML(latest, 'av av-s')}${esc(latest.author || latest.handle)}`
            : `${faviconHTML(latest.source, latest.favicon)}${esc(src(latest.source).label)}`} · ${timeHTML(latest.time, 'ago')}</span>
          <span class="l-title">${esc(plain(latest.title || String(latest.text || '').replace(/https?:\/\/\S+/g, '').trim() || latest.text))}</span>
        </a>`
      : feedTried ? '' : SK_NOW.latest;

    const wasSk = ['.now-main', '.latest'].filter((sel) => el.querySelector(`${sel} .sk`));
    const fix = anchor();
    el.innerHTML = `<div class="now-head"><h2 id="now-h">Next 24 hours</h2>${pill}</div>
      <div class="now-main">${line}</div>
      ${latestHTML}`;
    fix();
    fadeIn(wasSk.map((sel) => el.querySelector(sel)).filter((n) => n && !n.querySelector('.sk')));
    tick('peak', el.querySelector('.now-line b'), peakMph);
  }

  // one line of jargon help beside the forecast (standard Beaufort mean speeds)
  const KEY_HTML = `<details class="key"><summary>What F9, knots, veering and backing mean ${ICON.chev}</summary>
    <p>F numbers are the Beaufort scale of average wind: F7 near gale 32–38 mph, F8 gale 39–46 mph, F9 severe gale 47–54 mph, F10 storm 55–63 mph. Gusts are stronger. 1 knot ≈ 1.15 mph. Veering: the wind turns clockwise (south to west). Backing: anticlockwise.</p></details>`;
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
    if (gust) { chip.innerHTML = `<span class="gc-l">Gusts </span>${gust} mph`; chip.className = `gust-chip ${sev(gust)}`; chip.hidden = false; tick('chip', chip, gust); } else chip.hidden = true;

    const periods = Array.isArray(today.periods) ? today.periods : [];
    const sunBits = [today.sunrise && `Sunrise ${esc(clock24(today.sunrise))}`, today.sunset && `Sunset ${esc(clock24(today.sunset))}`, today.uv && `UV ${esc(today.uv)}`].filter(Boolean);
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
    html += KEY_HTML;
    html += `<p class="issued">Jersey Met forecast issued ${esc(tidy(f.issued))} · <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">gov.je/weather<span class="ext" aria-hidden="true"></span></a></p>`;
    const firstPaint = !!$('#weather .skel');
    const keyOpen = !!$('#weather details.key[open]');
    $('#weather').innerHTML = html;
    if (keyOpen) $('#weather details.key').open = true;
    if (firstPaint) fadeIn([...$('#weather').children]);
    tick('cond', $('#weather .cond-big'), gust);
  }

  // --- observations (/api/obs): Jersey Airport METAR, St Helier tides, Jersey Met image times ---
  let obsData = null;
  let obsTried = false;
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = (deg) => COMPASS[Math.round(deg / 22.5) % 16];
  const ktMph = (kt) => `${mph(kt)} mph (${kt} kt)`;
  // drawn pointing down (where a north wind blows), so rotating by the "from" bearing shows where the wind is going
  const ARROW = (deg) => `<svg class="dir-arrow" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round(deg)}deg)"><path d="M12 3v18M5 14l7 7 7-7"/></svg>`;
  const WX_CODES = { TS: 'thunderstorm', SH: 'showers', RA: 'rain', DZ: 'drizzle', SN: 'snow', GR: 'hail', GS: 'small hail', BR: 'mist', FG: 'fog', HZ: 'haze', SQ: 'squalls', FC: 'funnel cloud' };
  function wxWords(code) {
    return String(code || '').split(/\s+/).filter(Boolean).map((g) => {
      const near = /^VC/.test(g);
      const body = g.replace(/^[-+]|^VC/g, '');
      const words = (body.match(/.{2}/g) || []).map((c) => WX_CODES[c]).filter(Boolean);
      if (!words.length) return '';
      const w = words.length > 1 && words[0] === 'showers' ? `${words.slice(1).join(' ')} showers` : words.join(' ');
      return `${g[0] === '-' ? 'light ' : g[0] === '+' ? 'heavy ' : ''}${w}${near ? ' nearby' : ''}`;
    }).filter(Boolean).join(', ');
  }
  const pressureTrend = (c) => (!c ? '' : Math.abs(c.hpa) < 1 ? 'steady' : c.hpa < 0 ? 'falling' : 'rising');
  const visText = (m) => (m == null ? '—' : m >= 9999 ? '10 km or more' : m >= 1000 ? `${Math.round(m / 100) / 10} km` : `${m} m`);
  function nextHigh(tides) {
    const now = Date.now();
    return (tides || []).find((t) => t.high && new Date(t.at) > now) || null;
  }
  function tileHTML(label, value, sub) {
    return `<span class="t-l">${label}</span><span class="t-v">${value}</span><span class="t-s">${sub}</span>`;
  }
  function renderObs() {
    const tiles = $('#tiles');
    const m = obsData && obsData.metar;
    const tide = obsData && nextHigh(obsData.tides);
    const set = (k, html) => {
      const el = tiles.querySelector(`[data-tile="${k}"]`);
      el.hidden = !html && obsTried; // a tile whose data failed disappears; before the first answer it keeps its skeleton
      if (html) el.innerHTML = html;
    };
    if (!obsTried) return;
    const fix = anchor();
    const firstPaint = tiles.hasAttribute('aria-busy');
    tiles.removeAttribute('aria-busy');
    set('wind', m && m.windKt != null && tileHTML('Wind', `${mph(m.windKt)}<small> mph (${m.windKt} kt)</small>`, m.gustKt ? `Gusts ${ktMph(m.gustKt)}` : 'No gusts reported'));
    set('dir', m && tileHTML('Direction', m.windDir == null ? 'Variable' : `${ARROW(m.windDir)}${compass(m.windDir)}`, m.windDir == null ? 'changing direction' : `from ${m.windDir}°`));
    const pc = m && m.pressureChange;
    const trend = pressureTrend(pc);
    set('pressure', m && m.pressureHpa != null && tileHTML('Pressure', `${trend === 'falling' ? '<span class="trend" aria-hidden="true">↓</span>' : trend === 'rising' ? '<span class="trend" aria-hidden="true">↑</span>' : ''}${m.pressureHpa}<small> hPa</small>`,
      pc ? `${trend}${trend === 'steady' ? '' : ` ${Math.abs(pc.hpa)} in ${pc.hours} h`}` : ''));
    set('tide', tide && tileHTML('High tide', esc(clock(new Date(tide.at))), `Next · ${tide.heightM.toFixed(1)} m${dayKey(new Date(tide.at)) === dayKey(new Date()) ? '' : ` · ${dayLabel(new Date(tide.at)).toLowerCase()}`}`));
    const all = [...tiles.children];
    tiles.hidden = all.every((t) => t.hidden);
    const t = $('#obs-time');
    if (m && okTime(m.time)) {
      const old = Date.now() - new Date(m.time) > 90 * 60e3;
      t.textContent = `Jersey Airport, observed ${fmtTime(m.time)}${old ? ' · may be out of date' : ''}`;
      t.className = `small ${old ? 'err' : 'muted'}`;
    } else t.textContent = '';
    if (firstPaint) fadeIn(all.filter((x) => !x.hidden));
    tick('obs-wind', tiles.querySelector('[data-tile="wind"] .t-v'), m && m.windKt);
    fix();
  }
  $('#tiles').addEventListener('click', (e) => {
    if (!e.target.closest('.tile')) return;
    setDetailed(true, true);
    $('#detail').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  });

  // --- detailed view: imagery, Windy, METAR readout, tides ---
  let imgTab = 'radar';
  const IMG_ALT = { radar: 'Jersey Met rain radar for the Channel Islands', satellite: 'Satellite picture of north-west Europe', waves: 'Jersey Met wind and wave chart for now' };
  function renderImage() {
    const im = obsData && obsData.images && obsData.images[imgTab];
    const img = $('#img-main');
    $$('.img-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.img === imgTab)));
    $('#img-panel').setAttribute('aria-labelledby', `tab-${imgTab}`);
    $('#img-none').hidden = !!(im || !obsTried);
    if (!im || !isUrl(im.url)) { img.hidden = true; $('#img-time').textContent = ''; return; }
    // the version in the URL changes only when Jersey Met uploads a new picture, so the browser re-downloads only then
    const v = okTime(im.updatedAt) ? +new Date(im.updatedAt) : Math.floor(Date.now() / 300e3);
    const src = `${im.url}?v=${v}`;
    if (img.getAttribute('src') !== src) img.src = src;
    img.alt = IMG_ALT[imgTab];
    img.hidden = false;
    $('#img-time').textContent = okTime(im.updatedAt) ? `Updated ${fmtTime(im.updatedAt)} · ` : '';
  }
  $('#img-main').addEventListener('error', () => { $('#img-main').hidden = true; $('#img-none').hidden = false; });
  $('.img-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-img]');
    if (!b) return;
    imgTab = b.dataset.img;
    renderImage();
  });
  $('.img-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const tabs = $$('.img-tabs [role="tab"]');
    const i = tabs.findIndex((b) => b.dataset.img === imgTab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    imgTab = next.dataset.img;
    renderImage();
    next.focus();
  });

  function renderMetar() {
    const el = $('#metar');
    const m = obsData && obsData.metar;
    if (!m) { el.innerHTML = `<h3>Jersey Airport observation</h3><p class="muted small">${obsTried ? 'Not available right now.' : 'Loading…'}</p>`; return; }
    const pc = m.pressureChange;
    const clouds = m.clouds.map((c) => `${{ FEW: 'few', SCT: 'scattered', BKN: 'broken', OVC: 'overcast' }[c.cover] || c.cover}${c.baseFt != null ? ` at ${c.baseFt.toLocaleString('en-GB')} ft` : ''}`).join(', ');
    const rows = [
      ['Wind', m.windKt == null ? '—' : `${ktMph(m.windKt)}${m.windDir == null ? ', variable' : `, from ${compass(m.windDir)} (${m.windDir}°)`}`],
      ['Gusts', m.gustKt ? ktMph(m.gustKt) : 'none reported'],
      ['Visibility', visText(m.visibilityM)],
      ['Weather', wxWords(m.weather) || 'nothing significant'],
      ['Temperature', m.tempC == null ? '—' : `${m.tempC}°C${m.dewC != null ? ` · dew point ${m.dewC}°C` : ''}`],
      ['Pressure', m.pressureHpa == null ? '—' : `${m.pressureHpa} hPa${pc ? ` · ${pressureTrend(pc)}${pressureTrend(pc) === 'steady' ? '' : ` ${Math.abs(pc.hpa)} hPa`} in ${pc.hours} h` : ''}`],
      ['Cloud', clouds || '—'],
    ];
    el.innerHTML = `<h3>Jersey Airport observation</h3>
      <dl class="readout">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="muted small">Observed ${esc(fmtTime(m.time))} · <a href="https://aviationweather.gov/data/metar/?ids=EGJJ" target="_blank" rel="noopener noreferrer">METAR EGJJ<span class="ext" aria-hidden="true"></span></a></p>
      ${m.raw ? `<details class="key"><summary>Raw report ${ICON.chev}</summary><p><code>${esc(m.raw)}</code></p></details>` : ''}`;
  }
  function renderTides() {
    const el = $('#tides');
    const ts = obsData && obsData.tides;
    if (!ts || !ts.length) { el.innerHTML = `<h3>Tides · St Helier</h3><p class="muted small">${obsTried ? 'Not available right now.' : 'Loading…'}</p>`; return; }
    const today = dayKey(new Date());
    const tomorrow = dayKey(new Date(Date.now() + 864e5));
    const next = nextHigh(ts);
    const days = [today, tomorrow].map((k) => ({ k, rows: ts.filter((t) => dayKey(new Date(t.at)) === k) })).filter((d) => d.rows.length);
    el.innerHTML = `<h3>Tides · St Helier</h3>${days.map((d) => `<h4>${d.k === today ? 'Today' : 'Tomorrow'}</h4>
      <table class="tide-t"><tbody>${d.rows.map((t) => `<tr${t === next ? ' class="next"' : ''}><td>${esc(clock(new Date(t.at)))}</td><td>${t.high ? 'High' : 'Low'}</td><td>${t.heightM.toFixed(1)} m</td></tr>`).join('')}</tbody></table>`).join('')}
      <p class="muted small">Predictions by the National Oceanography Centre via <a href="https://www.gov.je/weather/tidetimes/" target="_blank" rel="noopener noreferrer">gov.je<span class="ext" aria-hidden="true"></span></a>. Storm surge and waves can push water higher.</p>`;
  }
  function renderDetail() {
    if (!detailed) return; // nothing in the detailed view loads until someone opens it
    const fix = anchor();
    renderImage();
    renderMetar();
    renderTides();
    fix();
  }
  async function loadObs() {
    try { obsData = await getJSON(bust('/api/obs')); } catch (e) { /* keep what we had */ }
    obsTried = true;
    renderObs();
    renderDetail();
  }

  // --- Simple / Detailed view, remembered on this device ---
  // Two live maps share one frame, so only one third-party map loads at a time.
  // Blitzortung documents these parameters for embedding its map: https://map.blitzortung.org/mapexample.html
  const MAPS = {
    wind: {
      src: 'https://embed.windy.com/embed2.html?lat=49.214&lon=-2.131&detailLat=49.214&detailLon=-2.131&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=mph&metricTemp=%C2%B0C&radarRange=-1',
      title: 'Windy.com wind forecast map centred on Jersey',
      credit: 'Forecast model map from <a href="https://www.windy.com/49.214/-2.131?49.214,-2.131,8" target="_blank" rel="noopener noreferrer">Windy.com<span class="ext" aria-hidden="true"></span></a>, not Jersey Met.',
    },
    lightning: {
      src: 'https://map.blitzortung.org/index.php?interactive=0&NavigationControl=1&FullScreenControl=0&Cookies=0&InfoDiv=0&MenuButtonDiv=0&ScaleControl=1&LinksCheckboxChecked=0&MapStyle=3&MapStyleRangeValue=4&Advertisment=0#{z}/49.2/-2.1',
      title: 'Blitzortung.org live lightning map centred on Jersey',
      credit: 'Recent strikes from <a href="https://www.blitzortung.org/" target="_blank" rel="noopener noreferrer">Blitzortung.org<span class="ext" aria-hidden="true"></span></a>, a volunteer detector network · not an official warning',
    },
  };
  let mapTab = 'wind';
  function renderMap() {
    const m = MAPS[mapTab];
    $$('.map-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.map === mapTab)));
    $('#map-panel').setAttribute('aria-labelledby', `tab-${mapTab}`);
    $('#map-credit').innerHTML = m.credit;
    const f = $('#map-frame');
    f.title = m.title;
    // a phone shows less map, so the lightning view zooms out a step to keep the approaches from Brittany in sight
    const src = m.src.replace('{z}', mobile.matches ? '5' : '6');
    if (detailed && f.getAttribute('src') !== src) f.src = src;
  }
  $('.map-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-map]');
    if (!b) return;
    mapTab = b.dataset.map;
    renderMap();
  });

  // --- travel (/api/travel): Jersey Airport flights and St Helier harbour sailings ---
  let travelData = null;
  let travelTried = false;
  let flTab = 'arr';
  const TRAVEL_KIND = { cancelled: 'Cancelled', diverted: 'Diverted', delayed: 'Delayed' };
  // the airport writes 24-hour times ("Landed at 07:48"); show them like every other time on the page
  const time24 = (s) => String(s || '').replace(/\b(\d{1,2}):(\d{2})\b/g, (m, h, mi) => clock24(`${h}:${mi}`));
  function travelSummary() {
    const now = new Date();
    const out = [];
    const fl = travelData && travelData.flights && travelData.flights.flights;
    if (fl) {
      // the next 24 hours (late at night, "today" would be nearly over)
      const soon = fl.filter((f) => new Date(f.at) > now - 3600e3 && new Date(f.at) < +now + 24 * 3600e3);
      const off = soon.filter((f) => f.kind === 'cancelled' || f.kind === 'diverted').length;
      if (soon.length) out.push(`<b>Flights, next 24 hours:</b> ${off ? `${off} of ${soon.length} cancelled` : 'none cancelled so far'}`);
    }
    const sl = travelData && travelData.harbour && travelData.harbour.sailings;
    if (sl) {
      // passenger ferries from 2 hours ago to 36 hours ahead
      const win = sl.filter((x) => x.passenger && new Date(x.at) > now - 2 * 3600e3 && new Date(x.at) < +now + 36 * 3600e3);
      const off = win.filter((x) => x.kind === 'cancelled');
      if (win.length) {
        const next = win.find((x) => x.kind !== 'cancelled' && new Date(x.at) > now);
        out.push(`<b>Ferries:</b> ${off.length === win.length ? `all passenger sailings cancelled until at least ${esc(fmtTime(win[win.length - 1].at))}` : off.length ? `${off.length} of ${win.length} passenger sailings cancelled${next ? `, next ${esc(fmtTime(next.at))}` : ''}` : 'passenger sailings running'}`);
      }
    }
    return out;
  }
  function renderTravelSum() {
    const el = $('#travel-sum');
    if (!travelTried) return;
    const lines = travelSummary();
    const fix = anchor();
    el.hidden = !lines.length;
    el.innerHTML = lines.map((l) => `<span>${l}</span>`).join('');
    fix();
  }
  // rows (sorted by time) → "Today" / "Tomorrow" sections
  function byDayHTML(rows, label) {
    const groups = [];
    for (const x of rows) {
      const d = dayLabel(new Date(x.at));
      if (!groups.length || groups[groups.length - 1].d !== d) groups.push({ d, rows: [] });
      groups[groups.length - 1].rows.push(x);
    }
    return groups.map((g) => `<h4>${esc(g.d)}</h4><ul class="tv-list">${g.rows.map((x) => boardRow(x, label(x))).join('')}</ul>`).join('');
  }
  function boardRow(x, label) {
    const pill = TRAVEL_KIND[x.kind] ? `<span class="tv-st ${x.kind}">${TRAVEL_KIND[x.kind]}</span>` : `<span class="tv-st">${esc(time24(x.status))}</span>`;
    return `<li class="${x.kind}"><time datetime="${esc(x.at)}">${esc(clock(new Date(x.at)))}</time><span class="tv-what">${label}</span>${pill}</li>`;
  }
  function renderBoards() {
    const now = new Date();
    const fEl = $('#fl-list');
    const fl = travelData && travelData.flights;
    $$('#flights [data-fl]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.fl === flTab)));
    if (!fl) fEl.innerHTML = `<p class="muted small">${travelTried ? 'Flight information isn\'t available right now.' : 'Loading…'}</p>`;
    else {
      // from an hour ago
      const rows = fl.flights.filter((x) => x.dir === flTab && new Date(x.at) > now - 3600e3);
      fEl.innerHTML = rows.length ? byDayHTML(rows, (f) => `<b>${esc(f.place)}</b> <span class="muted">${esc(f.flight)}</span>`) : '<p class="muted small">No more flights listed.</p>';
      fEl.insertAdjacentHTML('beforeend', `<p class="muted small">Ports of Jersey${fl.updated ? `, updated ${esc(time24(fl.updated.replace(/^\d{1,2} \w{3} \d{4} /, '')))}` : ''} · <a href="https://www.jerseyairport.com/flight/${flTab === 'arr' ? 'arrivals' : 'departures'}" target="_blank" rel="noopener noreferrer">jerseyairport.com<span class="ext" aria-hidden="true"></span></a> · check with your airline</p>`);
    }
    const sEl = $('#sl-list');
    const hb = travelData && travelData.harbour;
    if (!hb) { sEl.innerHTML = `<p class="muted small">${travelTried ? 'Harbour information isn\'t available right now.' : 'Loading…'}</p>`; return; }
    const pax = hb.sailings.filter((x) => x.passenger && new Date(x.at) > now - 3 * 3600e3);
    const freight = hb.sailings.filter((x) => !x.passenger && new Date(x.at) > now - 3 * 3600e3);
    const fOff = freight.filter((x) => x.kind === 'cancelled').length;
    sEl.innerHTML = (pax.length
      ? byDayHTML(pax, (x) => `<b>${x.dir === 'arr' ? 'From' : 'To'} ${esc(x.port)}</b> <span class="muted">${esc(x.vessel)}${x.reason ? ` · ${esc(x.reason.toLowerCase())}` : ''}</span>`)
      : '<p class="muted small">No passenger sailings listed.</p>')
      + `<p class="muted small">${freight.length ? `Freight: ${fOff} of ${freight.length} sailings cancelled. ` : ''}Ports of Jersey${okTime(hb.updated) ? `, updated ${esc(fmtTime(hb.updated))}` : ''} · <a href="https://www.ports.je/jerseyharbours/arrivals-departures/" target="_blank" rel="noopener noreferrer">ports.je<span class="ext" aria-hidden="true"></span></a> · check with your ferry company</p>`;
  }
  $('#flights').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fl]');
    if (!b) return;
    flTab = b.dataset.fl;
    renderBoards();
  });
  $('#travel-sum').addEventListener('click', () => {
    setDetailed(true, true);
    $('#flights').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  });
  async function loadTravel() {
    try { travelData = await getJSON(bust('/api/travel')); } catch (e) { /* keep what we had */ }
    travelTried = true;
    renderTravelSum();
    if (detailed) { const fix = anchor(); renderBoards(); fix(); }
  }

  function setDetailed(on, persist) {
    detailed = on;
    document.body.classList.toggle('detailed', on);
    const mb = $('#mode-toggle');
    mb.setAttribute('aria-pressed', String(on));
    mb.title = on ? 'Back to the simple view' : 'Show live data, maps and all posts';
    const db = $('#detail-btn');
    db.setAttribute('aria-expanded', String(on));
    db.textContent = on ? 'Hide live data & maps' : 'Show live data & maps';
    if (persist) { try { localStorage.setItem('view-mode', on ? 'detailed' : 'simple'); } catch (e) { /* private mode */ } }
    renderMap();
    if (on) renderBoards();
    renderDetail();
    applyMode();
  }
  $('#mode-toggle').addEventListener('click', () => setDetailed(!detailed, true));
  $('#detail-btn').addEventListener('click', () => setDetailed(!detailed, true));
  setDetailed(detailed, false);

  // --- status + loading ---
  // The header says how old the data is (summary.json / events.json's own timestamps), not when we last fetched it.
  const STALE_MS = 30 * 60e3;
  let netOk = true;
  function dataTime() {
    const ts = [summaryData && summaryData.updatedAt, eventsData && eventsData.updated].filter(okTime).map((t) => new Date(t));
    return ts.length ? new Date(Math.max(...ts)) : null;
  }
  function renderStatus(ping) {
    const t = dataTime();
    const dot = $('#live-dot');
    const upd = $('#updated');
    if (!t) { if (!netOk) { dot.className = 'dot err'; upd.textContent = 'Could not load updates'; } return; }
    const stale = Date.now() - t > STALE_MS;
    const state = !netOk ? 'err' : stale ? 'stale' : 'ok';
    dot.className = `dot ${state}`;
    if (ping && state === 'ok' && !reduceMotion.matches) { void dot.offsetWidth; dot.classList.add('ping'); } // restart the one-shot ping
    upd.className = state === 'ok' ? '' : state;
    upd.textContent = `${netOk ? '' : 'Offline? '}Updated ${ago(t)}`;
    upd.title = `Data last updated ${fmtTime(t.toISOString())}`;
  }

  async function loadX() {
    try { xPosts = ((await getJSON(bust('/x-posts.json'))).posts || []).filter((p) => p && p.url && p.time); } catch (e) { /* keep previous */ }
  }
  let summaryRaw = '';
  async function loadSummary() {
    try {
      const d = await getJSON(bust('/summary.json'));
      const raw = JSON.stringify(d);
      if (raw !== summaryRaw) { summaryRaw = raw; summaryData = d; renderSummary(); renderNow(); } // unchanged: leave the page alone
      renderStatus(true);
    } catch (e) { if (!summaryData) $('#summary-sec').hidden = true; }
  }
  async function loadFeed() {
    const xp = loadX();
    try {
      apiFeed = await getJSON(bust('/api/feed'));
      await xp;
      feedTried = true;
      netOk = true;
      renderFeed();
    } catch (e) {
      await xp;
      feedTried = true;
      netOk = false;
      if (xPosts.length) renderFeed(); else renderNow();
      if (!feedData) $('#feed').innerHTML = '<div class="card empty err">Could not load updates. Retrying shortly…</div>';
    }
    renderStatus(netOk);
  }
  // Network and server errors keep the events we have; a missing (404/410), invalid or empty file falls back to the post feed.
  async function loadEvents() {
    let r;
    try { r = await fetch(bust('/events.json'), { cache: 'no-cache' }); } catch (e) { eventsTried = true; if (!eventsData) applyMode(); return; }
    eventsTried = true;
    if (!r.ok && r.status !== 404 && r.status !== 410) { if (!eventsData) applyMode(); return; }
    const text = r.ok ? await r.text().catch(() => '') : '';
    try { eventsData = text ? normEvents(JSON.parse(text)) : null; } catch (e) { eventsData = null; }
    evRaw = text;
    renderEvents();
    renderStatus(true);
  }
  async function loadWeather() {
    try {
      const wx = await getJSON('/api/weather');
      wxTried = true;
      renderWeather(wx);
    } catch (e) {
      wxTried = true;
      renderNow();
      if (!$('#weather .card')) $('#weather').innerHTML = '<div class="card err">Forecast unavailable. <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Open Jersey Met</a></div>';
    }
  }

  const lastPoll = { data: 0, wx: 0 };
  const refreshBtn = $('#refresh');
  async function refreshAll() {
    if (refreshBtn.classList.contains('spinning')) return; // one refresh at a time
    refreshBtn.classList.add('spinning');
    lastPoll.data = lastPoll.wx = Date.now();
    await Promise.allSettled([loadSummary(), loadEvents(), loadFeed(), loadWeather(), loadWarnings(), loadObs(), loadTravel()]);
    const svg = refreshBtn.querySelector('svg');
    if (reduceMotion.matches || !svg) { refreshBtn.classList.remove('spinning'); return; }
    const done = () => { svg.removeEventListener('animationiteration', done); clearTimeout(timer); refreshBtn.classList.remove('spinning'); };
    const timer = setTimeout(done, 1000); // one turn is 0.9s
    svg.addEventListener('animationiteration', done);
  }
  refreshBtn.addEventListener('click', refreshAll);

  // --- theme: auto (follows OS) / light / dark, persisted ---
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_ICON = { auto: ICON.auto, light: ICON.sun, dark: ICON.moon };
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
    themeBtn.innerHTML = THEME_ICON[t];
    themeBtn.setAttribute('aria-label', `Theme: ${t}. Click to change`);
    themeBtn.title = `Theme: ${t === 'auto' ? 'auto (follows system)' : t}`;
  }
  const currentTheme = () => document.documentElement.dataset.theme || 'auto';
  themeBtn.addEventListener('click', () => withTransition(() => applyTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length], true)));
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
    if (!b) return;
    if (b.dataset.go === document.body.dataset.active) setView(b.dataset.go, true); // same tab: just back to the top
    else withTransition(() => setView(b.dataset.go, true));
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
    const dataEvery = secs(config.refresh.feedSeconds, 180);
    const wxEvery = secs(config.refresh.weatherSeconds, 300);
    refreshAll();
    // Poll only while the tab is visible; coming back to it catches up at once if a poll is due.
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastPoll.data >= dataEvery) { lastPoll.data = now; loadSummary(); loadEvents(); loadFeed(); loadTravel(); }
      if (now - lastPoll.wx >= wxEvery) { lastPoll.wx = now; loadWeather(); loadWarnings(); loadObs(); }
    };
    setInterval(poll, 15e3);
    document.addEventListener('visibilitychange', poll);
  });

  // --- unique visitor count (functions/api/visit.js): a random ID kept in localStorage and a cookie ---
  (() => {
    const el = $('#visits');
    if (!el || !window.fetch) return;
    const KEY = 'visitor-id', DONE = 'visitor-counted';
    const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; };
    const cookie = (document.cookie.match(/(?:^|; )vid=([A-Za-z0-9_-]{16,64})/) || [])[1];
    let id = ls(KEY) || cookie;
    if (!id) id = crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    ls(KEY, id);
    try { document.cookie = `vid=${id}; Max-Age=34560000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`; } catch (e) { /* ignore */ }
    const show = (d) => {
      if (!d || typeof d.count !== 'number' || d.count < 1) return;
      const n = d.count.toLocaleString('en-GB');
      el.textContent = d.count === 1 ? '1 person has visited' : `${n} people have visited`;
      el.removeAttribute('aria-hidden');
      el.classList.add('on');
    };
    const get = () => fetch('/api/visit', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null));
    if (ls(DONE) === '1') { get().then(show).catch(() => { /* leave the line hidden */ }); return; }

    // Count only real engagement: visible for 3 s plus a scroll, tap or key press, or visible for 10 s
    let token = null, tokenAt = 0, shown = 0, since = 0, engaged = false, sent = false, timer = 0;
    const fetchToken = () => get().then((d) => { if (d) { token = d.token; tokenAt = Date.now(); } return d; });
    const visibleMs = () => shown + (since ? Date.now() - since : 0);
    const send = () => {
      if (sent) return;
      sent = true;
      clearTimeout(timer);
      ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((t) => removeEventListener(t, onEngage, true));
      (Date.now() - tokenAt > 25 * 60e3 ? fetchToken().then(() => new Promise((ok) => setTimeout(ok, 3200))) : Promise.resolve())
        .then(() => fetch('/api/visit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, t: token }), cache: 'no-store' }))
        .then((r) => (r.ok || r.status === 429 ? r.json().then((d) => { if (r.ok) ls(DONE, '1'); return d; }) : null))
        .then(show).catch(() => { /* leave the line as it is */ });
    };
    const check = () => {
      clearTimeout(timer);
      if (sent || !token || !since) return;
      const ms = visibleMs(), need = engaged ? 3e3 : 10e3;
      if (ms >= need) send(); else timer = setTimeout(check, need - ms + 50);
    };
    function onEngage() { engaged = true; check(); }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { if (!since) since = Date.now(); } else if (since) { shown += Date.now() - since; since = 0; }
      check();
    };
    ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach((t) => addEventListener(t, onEngage, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    fetchToken().then((d) => { show(d); if (token) { since = 0; shown = 0; onVisibility(); } }).catch(() => { /* leave the line hidden */ });
  })();

  // refresh relative times and the data's age every minute
  setInterval(() => { updateTimes(); renderEvents(); renderStatus(); }, 60 * 1000);
})();
