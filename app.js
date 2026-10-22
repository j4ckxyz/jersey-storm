(() => {
  'use strict';
  const TZ = 'Europe/Jersey';
  const FEED_EVERY = 3 * 60 * 1000;
  const WX_EVERY = 5 * 60 * 1000;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '#');

  const SRC_CLASS = { 'BBC Jersey': 's-bbc', 'BBC Guernsey': 's-bbc', 'The Quarry (Guernsey)': 's-bex', 'gov.je': 's-gov', 'Jersey Met': 's-met', 'Jersey Evening Post': 's-jep', 'Bailiwick Express': 's-bex', Bluesky: 's-bsky' };

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

  let feedData = null; // merged: {items, sources}
  let apiFeed = null;
  let xPosts = [];
  let summaryData = null;
  let activeSource = 'All';
  const seenUrls = new Set();
  let firstLoad = true;

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // --- native-looking post cards (X and Bluesky share one design) ---
  const ICON_X = '<svg class="plat" viewBox="0 0 24 24" aria-label="Twitter / X" role="img"><path fill="#1d9bf0" d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z"/></svg>';
  const ICON_BSKY = '<svg class="plat" viewBox="0 0 600 530" aria-label="Bluesky" role="img"><path fill="#1185fe" d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-.0174-2.9357-1.1937.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"/></svg>';
  const isPost = (it) => it.platform === 'x' || it.platform === 'bsky' || it.source === 'Bluesky' || it.source === 'X';
  function initials(name) { const c = String(name || '').trim().slice(0, 1).toUpperCase(); return /[A-Z0-9]/.test(c) ? c : '?'; }
  function mediaHTML(media) {
    if (!media || !media.length) return '';
    const link = media.find((m) => m.type === 'link');
    if (link && media.length === 1) {
      return `<div class="pcard-link"><img src="${esc(safeUrl(link.thumb || link.url))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()"><div>${esc(link.title || link.alt || '')}</div></div>`;
    }
    const imgs = media.filter((m) => m.type !== 'link').slice(0, 4);
    return `<div class="pmedia n${imgs.length}">${imgs.map((m) => `<div class="pm"><img src="${esc(safeUrl(m.thumb || m.url))}" alt="${esc(m.alt || '')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()">${m.type === 'video' || m.type === 'animated_gif' ? '<span class="play">▶</span>' : ''}</div>`).join('')}</div>`;
  }
  function postCardHTML(it, extraCls = '') {
    const d = new Date(it.time);
    const x = it.platform === 'x' || it.source === 'X';
    const av = it.avatar
      ? `<img class="av" src="${esc(safeUrl(it.avatar))}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;av av-f&quot;>${initials(it.author || it.handle)}</span>'">`
      : `<span class="av av-f">${initials(it.author || it.handle)}</span>`;
    return `<a class="pcard ${x ? 'is-x' : 'is-bsky'} ${extraCls}" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">
      <div class="phead">${av}<div class="pwho"><span class="pname">${esc(it.author || it.handle)}</span><span class="phandle">@${esc(it.handle)}</span></div>${x ? ICON_X : ICON_BSKY}</div>
      <div class="ptext">${esc(it.text)}</div>
      ${mediaHTML(it.media)}
      <div class="pfoot"><time datetime="${esc(it.time)}">${esc(hm(d))} · ${esc(dayLabel(d))} · ${esc(ago(d))}</time><span>View on ${x ? 'X' : 'Bluesky'} ↗</span></div>
    </a>`;
  }

  function mergeFeed() {
    if (!apiFeed && !xPosts.length) return;
    const items = [...((apiFeed && apiFeed.items) || [])];
    const cutoff = Date.now() - 5 * 864e5;
    for (const p of xPosts) if (new Date(p.time) >= cutoff) items.push({ ...p, source: 'X', platform: 'x' });
    const seen = new Set();
    const merged = items
      .filter((i) => i.time && !isNaN(new Date(i.time)))
      .filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)))
      .sort((a, b) => new Date(b.time) - new Date(a.time));
    const sources = [...((apiFeed && apiFeed.sources) || [])];
    sources.push(xPosts.length ? { name: 'X', ok: true, count: xPosts.filter((p) => new Date(p.time) >= cutoff).length } : { name: 'X', ok: false, count: 0 });
    feedData = { items: merged, sources };
  }

  function renderFilters() {
    const counts = {};
    for (const i of feedData.items) counts[i.source] = (counts[i.source] || 0) + 1;
    const names = ['All', ...Object.keys(counts)];
    if (!names.includes(activeSource)) activeSource = 'All';
    $('#filters').innerHTML = names
      .map((n) => `<button type="button" data-src="${esc(n)}" aria-pressed="${n === activeSource}">${esc(n)}${n === 'All' ? '' : ` (${counts[n]})`}</button>`)
      .join('');
  }

  function renderFeed() {
    mergeFeed();
    if (!feedData) return;
    renderFilters();
    const items = feedData.items.filter((i) => activeSource === 'All' || i.source === activeSource);
    $('#feed-count').textContent = `${feedData.items.length} updates`;
    if (!items.length) {
      $('#feed').innerHTML = '<div class="card empty muted">No storm updates found right now. Check back soon.</div>';
    } else {
      let html = '';
      let lastGroup = '';
      for (const it of items) {
        const d = new Date(it.time);
        const group = it.dateOnly ? `${dayLabel(d)}` : `${dayLabel(d)} ${hourOf(d)}:00`;
        if (group !== lastGroup) { html += `<div class="hour">${esc(group)}</div>`; lastGroup = group; }
        const isNew = !firstLoad && !seenUrls.has(it.url);
        if (isPost(it)) { html += postCardHTML(it, isNew ? 'new' : ''); continue; }
        const cls = ['item', SRC_CLASS[it.source] || '', isNew ? 'new' : ''].join(' ');
        const timeTxt = it.dateOnly ? dayLabel(d) : `${hm(d)} · ${ago(d)}`;
        const warn = it.warning ? `<span class="badge ${esc(it.warning)}">${esc(it.warning)}</span>` : '';
        html += `<a class="${cls}" href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">
          <div class="meta"><span class="src">${esc(it.source)}</span>${warn}<time datetime="${esc(it.time)}">${esc(timeTxt)}</time></div>
          ${it.title ? `<div class="title">${esc(it.title)}</div>` : ''}
          ${it.text ? `<div class="text">${esc(it.text)}</div>` : ''}
        </a>`;
      }
      $('#feed').innerHTML = html;
    }
    for (const it of feedData.items) seenUrls.add(it.url);
    firstLoad = false;
    const bad = (feedData.sources || []).filter((s) => !s.ok).map((s) => s.name);
    const good = (feedData.sources || []).filter((s) => s.ok).map((s) => `${s.name} (${s.count})`);
    $('#feed-sources').innerHTML = `Sources: ${esc(good.join(', '))}${bad.length ? ` · <span class="err">unavailable: ${esc(bad.join(', '))}</span>` : ''}`;
    renderSummaryPosts();
  }

  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-src]');
    if (!b) return;
    activeSource = b.dataset.src;
    renderFeed();
  });

  // --- summary box (static /summary.json) ---
  function md(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  }
  function renderSummary() {
    const box = $('#summary');
    const s = summaryData;
    if (!s || !s.headline) { box.hidden = true; return; }
    const d = new Date(s.updatedAt);
    const valid = !isNaN(d);
    const stale = valid && Date.now() - d > 6 * 3600e3;
    const upd = valid ? `Updated ${hm(d)}, ${new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long' }).format(d)}${stale ? ' · may be out of date' : ''}` : '';
    const secs = Array.isArray(s.sections) ? s.sections : [];
    const secHTML = (sec) => `<h3>${esc(sec.title)}</h3><ul>${(sec.points || []).map((p) => `<li>${md(p)}</li>`).join('')}</ul>`;
    const first = secs.slice(0, 1).map(secHTML).join('');
    const rest = secs.slice(1).map(secHTML).join('');
    const wasOpen = box.querySelector('details') && box.querySelector('details').open;
    box.innerHTML = `<div class="sum-head"><h2>What's happening</h2><span class="muted small ${stale ? 'err' : ''}">${esc(upd)}</span></div>
      <p class="sum-lead">${md(s.headline)}</p>
      ${first}
      ${rest || (s.posts || []).length ? `<details${wasOpen ? ' open' : ''}><summary>Show full summary</summary>${rest}<div id="sum-posts" class="sum-posts"></div></details>` : ''}`;
    box.hidden = false;
    renderSummaryPosts();
  }
  function renderSummaryPosts() {
    const el = document.getElementById('sum-posts');
    if (!el || !summaryData) return;
    const pool = [...xPosts.map((p) => ({ ...p, platform: 'x' })), ...((feedData && feedData.items) || []).filter(isPost)];
    const cards = (summaryData.posts || []).map((u) => pool.find((p) => p.url === u)).filter(Boolean);
    el.innerHTML = cards.length ? `<h3>Key posts</h3>${cards.map((c) => postCardHTML(c)).join('')}` : '';
  }

  function warningHTML(w) {
    const c = (w.colour || 'yellow').toLowerCase();
    return `<div class="warn ${esc(c)}">
      <div class="warn-head"><span class="badge ${esc(c)}">${esc(c)} warning</span>${esc(w.type)}</div>
      ${w.text ? `<p><strong>${esc(w.text)}</strong></p>` : ''}
      ${w.validity ? `<p class="small">${esc(w.validity)}</p>` : ''}
      ${w.issued ? `<p class="small muted">${esc(w.issued)}</p>` : ''}
      ${w.impacts && w.impacts.length ? `<details${c === 'red' && window.innerWidth > 700 ? ' open' : ''}><summary>Impacts &amp; advice</summary><ul>${w.impacts.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
    </div>`;
  }

  function renderWeather(wx) {
    const banner = $('#warning-banner');
    const rank = { red: 0, amber: 1, orange: 1, yellow: 2 };
    const warnings = (wx.warnings || []).slice().sort((a, b) => (rank[a.colour] ?? 3) - (rank[b.colour] ?? 3));
    if (warnings.length) {
      banner.innerHTML = warnings.map(warningHTML).join('');
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
    const f = wx.forecast;
    if (!f || !f.days || !f.days.length) {
      $('#weather').innerHTML = `<div class="card err">Forecast unavailable right now. <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Open Jersey Met</a></div>`;
      return;
    }
    const today = f.days[0];
    const next = f.days[1];
    // Highest gust mentioned for today/tonight or tomorrow
    const gustDay = [today, next].filter(Boolean).reduce((a, b) => ((b.maxGustMph || 0) > (a.maxGustMph || 0) ? b : a));
    const gust = gustDay.maxGustMph;
    const chip = $('#gust-chip');
    if (gust) { chip.textContent = `Gusts ${gust} mph`; chip.hidden = false; } else chip.hidden = true;
    let html = '';
    html += `<div class="card">
      <div class="gust">
        <div class="big">${gust ? `${gust}<small> mph</small>` : '—'}</div>
        <div class="lbl"><strong>Max gusts forecast</strong><br><span class="muted">${esc(gustDay.day)}${gust ? '' : ' · none mentioned'}</span></div>
      </div>
      <div class="stats">
        <div class="stat"><b>${f.currentTemp != null ? Math.round(f.currentTemp) + '°C' : '—'}</b><span>Now</span></div>
        <div class="stat"><b>${today.windMph ?? '—'} mph</b><span>Wind ${esc(today.windDir || '')} ${esc(today.windForce || '')}</span></div>
        <div class="stat"><b>${today.maxRain ?? '—'}%</b><span>Rain chance</span></div>
      </div>
      <p class="small" style="margin:10px 0 0">${esc(today.summary)}</p>
      <div class="periods">
        ${today.periods.map((p) => `<div class="period">
          <div class="ph"><span>${esc(today.day)} ${esc(p.name.toLowerCase())}</span><span>${p.mph ?? '—'} mph ${esc(p.dir)} · ${p.rain ?? '—'}% rain</span></div>
          <div class="w">${esc(p.desc)}</div>
          <div class="${p.gustMph >= 50 ? 'hi' : ''}">${esc(p.wind)}</div>
        </div>`).join('')}
      </div>
      <p class="small muted" style="margin:10px 0 0">Jersey Met forecast issued ${esc(f.issued)}</p>
    </div>`;
    html += `<div class="card"><h3>Next few days</h3><table class="days">
      <tr><th>Day</th><th>Wind / gusts</th><th>Rain</th><th>Temp</th></tr>
      ${f.days.slice(1, 6).map((d) => `<tr>
        <td><strong>${esc(d.day)}</strong><br><span class="muted small">${esc(d.summary)}</span></td>
        <td>${d.windMph ?? '—'} mph ${esc(d.windDir || '')}${d.maxGustMph ? `<br><span class="${d.maxGustMph >= 50 ? 'hi' : ''}">gusts ${d.maxGustMph} mph</span>` : ''}</td>
        <td>${d.maxRain ?? '—'}%</td>
        <td class="n">${d.min ?? '—'}–${d.max ?? '—'}°C</td>
      </tr>`).join('')}
    </table>
    ${next && next.windDescription ? `<p class="small" style="margin:8px 0 0"><strong>${esc(next.day)}:</strong> ${esc(next.windDescription)}</p>` : ''}
    </div>`;
    $('#weather').innerHTML = html;
  }

  let lastOk = null;
  function setStatus(ok, msg) {
    $('#live-dot').className = 'dot ' + (ok ? 'ok' : 'err');
    $('#updated').textContent = msg;
  }

  async function loadX() {
    try { xPosts = ((await getJSON('/x-posts.json')).posts || []).filter((p) => p && p.url && p.time); } catch (e) { /* keep previous */ }
  }
  async function loadSummary() {
    try { summaryData = await getJSON('/summary.json'); renderSummary(); } catch (e) { /* keep previous */ }
  }
  async function loadFeed() {
    const xp = loadX();
    try {
      apiFeed = await getJSON('/api/feed');
      await xp;
      renderFeed();
      lastOk = new Date();
      setStatus(true, `Updated ${hm(lastOk)}`);
    } catch (e) {
      await xp;
      if (xPosts.length) renderFeed();
      if (!feedData) $('#feed').innerHTML = '<div class="card err">Could not load updates. Retrying shortly…</div>';
      setStatus(false, lastOk ? `Offline? Last update ${hm(lastOk)}` : 'Could not load updates');
    }
  }
  async function loadWeather() {
    try {
      renderWeather(await getJSON('/api/weather'));
    } catch (e) {
      if (!$('#weather .card')) $('#weather').innerHTML = '<div class="card err">Forecast unavailable. <a href="https://www.gov.je/weather/" target="_blank" rel="noopener">Open Jersey Met</a></div>';
    }
  }

  function refreshAll() { loadSummary(); loadFeed(); loadWeather(); }
  $('#refresh').addEventListener('click', refreshAll);
  refreshAll();
  setInterval(loadFeed, FEED_EVERY);
  setInterval(loadWeather, WX_EVERY);
  setInterval(loadSummary, WX_EVERY);
  // refresh relative times every minute, and refresh on return to the tab
  setInterval(() => feedData && renderFeed(), 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!lastOk || Date.now() - lastOk > 60 * 1000)) refreshAll();
  });
})();
