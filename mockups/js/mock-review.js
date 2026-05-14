/* ================================================================
   field-quotes mockups — review / markup overlay
   Server-backed, per-record. Each comment / page note is its own
   row server-side, so concurrent reviewers can't trample each
   other's notes. Reviewer name lives per-browser in localStorage.
   ================================================================ */

window.MockReview = (function () {

  const API = '/api/quotes-mockup/notes';
  const POLL_MS = 12000;
  const REVIEWER_KEY = 'mr_reviewer_v1';

  // -------------------------------------------------------------
  // In-memory mirror of server state (read-cache only — all
  // mutations go straight to the per-record endpoints).
  // -------------------------------------------------------------
  let comments = [];
  let pageNotes = {};
  let reviewer = localStorage.getItem(REVIEWER_KEY) || '';
  let lastSyncedAt = null;
  let lastError = null;
  let inFlight = 0;          // number of mutations being saved
  let cacheLoaded = false;

  // -------------------------------------------------------------
  // Network — per-record API
  // -------------------------------------------------------------
  async function fetchAll({ silent } = {}) {
    try {
      const r = await fetch(API, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      comments = Array.isArray(j.comments) ? j.comments : [];
      pageNotes = (j.pageNotes && typeof j.pageNotes === 'object') ? j.pageNotes : {};
      lastSyncedAt = new Date();
      lastError = null;
      cacheLoaded = true;
      if (!silent) { renderPinsForCurrentPage(); renderToolbar(); }
    } catch (e) {
      lastError = e.message || String(e);
      if (!silent) renderToolbar();
    }
  }

  async function putComment(c) {
    inFlight++; renderToolbar();
    try {
      const r = await fetch(API + '/comment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      lastError = null;
      lastSyncedAt = new Date();
    } catch (e) {
      lastError = e.message || String(e);
    } finally {
      inFlight--; renderToolbar();
    }
  }

  async function deleteComment(id) {
    inFlight++; renderToolbar();
    try {
      const r = await fetch(API + '/comment/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      lastError = null;
      lastSyncedAt = new Date();
    } catch (e) {
      lastError = e.message || String(e);
    } finally {
      inFlight--; renderToolbar();
    }
  }

  async function putPageNote(page, note) {
    inFlight++; renderToolbar();
    try {
      const r = await fetch(API + '/pagenote/' + encodeURIComponent(page), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note)
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      lastError = null;
      lastSyncedAt = new Date();
    } catch (e) {
      lastError = e.message || String(e);
    } finally {
      inFlight--; renderToolbar();
    }
  }

  async function deletePageNote(page) {
    inFlight++; renderToolbar();
    try {
      const r = await fetch(API + '/pagenote/' + encodeURIComponent(page), { method: 'DELETE' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      lastError = null;
      lastSyncedAt = new Date();
    } catch (e) {
      lastError = e.message || String(e);
    } finally {
      inFlight--; renderToolbar();
    }
  }

  async function clearAll() {
    inFlight++; renderToolbar();
    try {
      const r = await fetch(API, { method: 'DELETE' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      comments = []; pageNotes = {};
      lastSyncedAt = new Date();
      lastError = null;
    } catch (e) {
      lastError = e.message || String(e);
    } finally {
      inFlight--; renderToolbar();
    }
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function uid() { return 'c_' + Math.random().toString(36).slice(2, 8); }
  function pageId() { return (location.pathname.split('/').pop() || 'index').replace(/[?#].*$/, ''); }
  function pageTitle() { return document.title.replace(/ — SKS Quotes.*$/, '').trim(); }
  function nowIso() { return new Date().toISOString(); }
  function timeAgo(date) {
    if (!date) return 'never';
    const sec = Math.round((Date.now() - date.getTime()) / 1000);
    if (sec < 5) return 'just now';
    if (sec < 60) return sec + 's ago';
    const min = Math.round(sec / 60);
    if (min < 60) return min + 'm ago';
    const hr = Math.round(min / 60);
    if (hr < 24) return hr + 'h ago';
    return Math.round(hr / 24) + 'd ago';
  }
  function nearestAnchor(el) {
    let cur = el; let depth = 0;
    while (cur && cur !== document.body && depth < 6) {
      const id = cur.id ? '#' + cur.id : null;
      const cls = cur.className && typeof cur.className === 'string' ? '.' + cur.className.trim().split(/\s+/).slice(0, 2).join('.') : null;
      const tag = cur.tagName.toLowerCase();
      const text = (cur.innerText || '').trim().slice(0, 60).replace(/\s+/g, ' ');
      if (text && text.length > 1) return { tag, id, cls, text };
      cur = cur.parentElement; depth++;
    }
    return { tag: el.tagName.toLowerCase(), text: '' };
  }
  function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // -------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('mock-review-styles')) return;
    const s = document.createElement('style');
    s.id = 'mock-review-styles';
    s.textContent = `
      .mr-toolbar { position: fixed; right: 18px; bottom: 18px; z-index: 9990;
        background: white; border: 1px solid #e8e6e1; border-radius: 12px; padding: 8px;
        display: flex; gap: 6px; align-items: center;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        font-family: 'Inter', -apple-system, sans-serif; }
      .mr-toolbar.collapsed > *:not(.mr-toggle) { display: none; }
      .mr-toolbar .mr-btn { background: #2d2d2a; color: white; border: none; padding: 8px 12px;
        border-radius: 6px; cursor: pointer; font: inherit; font-size: 12px; font-weight: 500;
        display: flex; align-items: center; gap: 5px; }
      .mr-toolbar .mr-btn:hover { filter: brightness(1.15); }
      .mr-toolbar .mr-btn.mr-secondary { background: white; color: #2d2d2a; border: 1px solid #d5d3cd; }
      .mr-toolbar .mr-btn.mr-secondary:hover { background: #f7f5f0; }
      .mr-toolbar .mr-btn .material-symbols-outlined { font-size: 16px; }
      .mr-toolbar .mr-count { font-size: 11px; font-weight: 600; padding: 2px 7px; background: #c0553a; color: white; border-radius: 10px; }
      .mr-toolbar .mr-toggle { padding: 8px; }
      .mr-status { font-size: 11px; color: #8a8880; padding: 0 6px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
      .mr-status .mr-dot { width: 7px; height: 7px; border-radius: 50%; background: #3d7c3f; }
      .mr-status.busy .mr-dot { background: #b8860b; animation: mr-pulse 0.8s infinite; }
      .mr-status.error .mr-dot { background: #c0553a; }
      @keyframes mr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

      body.mr-pin-mode, body.mr-pin-mode * { cursor: crosshair !important; }

      .mr-pin { position: absolute; width: 26px; height: 26px; border-radius: 50%;
        background: #c0553a; color: white;
        font: 700 12px/26px 'IBM Plex Sans', sans-serif; text-align: center;
        cursor: pointer; z-index: 9985; transform: translate(-13px, -13px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 3px white;
        font-variant-numeric: tabular-nums; }
      .mr-pin:hover { background: #a04530; transform: translate(-13px, -13px) scale(1.08); }
      .mr-pin.mine { background: #4a5699; }

      .mr-popover { position: absolute; z-index: 9988; background: white; border: 1px solid #e8e6e1;
        border-radius: 8px; padding: 10px; width: 290px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.18); font-family: 'Inter', sans-serif; }
      .mr-popover .mr-pop-meta { font-size: 11px; color: #8a8880; margin-bottom: 4px; }
      .mr-popover textarea { width: 100%; min-height: 70px; font: inherit; font-size: 13px;
        border: 1px solid #d5d3cd; border-radius: 6px; padding: 6px 8px; resize: vertical; }
      .mr-popover .mr-pop-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }
      .mr-popover .mr-pop-actions button { background: #2d2d2a; color: white; border: none;
        padding: 6px 10px; border-radius: 5px; font: inherit; font-size: 12px; cursor: pointer; }
      .mr-popover .mr-pop-actions button.mr-secondary { background: white; color: #2d2d2a; border: 1px solid #d5d3cd; }
      .mr-popover .mr-pop-actions button.mr-danger { background: #c0553a; }

      .mr-banner { position: fixed; top: 36px; left: 50%; transform: translateX(-50%);
        background: #c0553a; color: white; padding: 6px 14px; border-radius: 0 0 8px 8px;
        font: 600 12px 'Inter', sans-serif; z-index: 9989; }

      .mr-drawer-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.35); z-index: 9991; display: none; }
      .mr-drawer-bg.open { display: block; }
      .mr-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 480px; max-width: 100%;
        background: #faf9f6; z-index: 9992; transform: translateX(100%);
        transition: transform 0.18s ease; display: flex; flex-direction: column;
        box-shadow: -8px 0 24px rgba(0,0,0,0.15); font-family: 'Inter', sans-serif; }
      .mr-drawer.open { transform: translateX(0); }
      .mr-drawer .mr-dh { padding: 14px 18px; border-bottom: 1px solid #e8e6e1; display: flex;
        align-items: center; gap: 8px; background: white; }
      .mr-drawer .mr-dh h3 { font-family: 'IBM Plex Sans', sans-serif; font-size: 16px; font-weight: 600; color: #2d2d2a; flex: 1; }
      .mr-drawer .mr-db { padding: 14px 18px; overflow-y: auto; flex: 1; }
      .mr-drawer .mr-df { padding: 12px 18px; border-top: 1px solid #e8e6e1; background: white; display: flex; gap: 8px; align-items: center; }
      .mr-drawer .mr-pg { margin-bottom: 14px; }
      .mr-drawer .mr-pg-h { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; font-size: 13px;
        color: #5c5b56; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 0;
        border-bottom: 1px solid #e8e6e1; margin-bottom: 6px; }
      .mr-drawer .mr-pg-h .pg-link { color: #4a5699; cursor: pointer; text-decoration: none; }
      .mr-drawer .mr-c { padding: 8px 10px; background: white; border: 1px solid #e8e6e1;
        border-radius: 6px; margin-bottom: 6px; font-size: 12.5px; }
      .mr-drawer .mr-c .mr-c-h { display: flex; gap: 6px; align-items: center; margin-bottom: 4px;
        font-size: 11px; color: #8a8880; }
      .mr-drawer .mr-c .mr-c-num { background: #c0553a; color: white; padding: 1px 7px;
        border-radius: 10px; font-weight: 600; font-size: 10px; min-width: 20px; text-align: center; }
      .mr-drawer .mr-c .mr-c-anchor { font-style: italic; }
      .mr-drawer .mr-c .mr-c-text { color: #2d2d2a; line-height: 1.45; white-space: pre-wrap; }
      .mr-drawer .mr-c .mr-c-author { color: #4a5699; font-weight: 600; }
      .mr-drawer .mr-c .mr-c-actions { display: flex; gap: 4px; margin-left: auto; }
      .mr-drawer .mr-c .mr-c-actions button { background: none; border: none; color: #8a8880;
        cursor: pointer; padding: 0; font-size: 14px; line-height: 1; }
      .mr-drawer .mr-c .mr-c-actions button:hover { color: #c0553a; }
      .mr-empty { padding: 30px 20px; text-align: center; color: #8a8880; }

      .mr-name-prompt { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999;
        display: flex; align-items: center; justify-content: center; font-family: 'Inter', sans-serif; }
      .mr-name-prompt .card { background: white; border-radius: 12px; padding: 24px;
        max-width: 380px; width: 90%; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
      .mr-name-prompt h3 { font-family: 'IBM Plex Sans', sans-serif; font-size: 18px; margin-bottom: 6px; color: #2d2d2a; }
      .mr-name-prompt p { color: #5c5b56; font-size: 13px; margin-bottom: 14px; line-height: 1.5; }
      .mr-name-prompt input { width: 100%; padding: 10px; border: 1px solid #d5d3cd; border-radius: 6px;
        font: inherit; font-size: 14px; }
      .mr-name-prompt button { margin-top: 10px; background: #2d2d2a; color: white; border: none;
        padding: 9px 16px; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 500; width: 100%; }
    `;
    document.head.appendChild(s);
  }

  // -------------------------------------------------------------
  // Toolbar
  // -------------------------------------------------------------
  let toolbarEl = null;
  function renderToolbar() {
    if (!toolbarEl) {
      toolbarEl = document.createElement('div');
      toolbarEl.className = 'mr-toolbar';
      document.body.appendChild(toolbarEl);
    }
    const total = comments.length + Object.keys(pageNotes).length;
    let statusCls = ''; let statusText = 'synced ' + timeAgo(lastSyncedAt);
    if (lastError) { statusCls = 'error'; statusText = 'sync failed (click)'; }
    else if (inFlight > 0) { statusCls = 'busy'; statusText = 'saving…'; }
    else if (!cacheLoaded) { statusCls = 'busy'; statusText = 'loading…'; }
    toolbarEl.innerHTML = `
      <button class="mr-btn mr-toggle" title="Hide toolbar" id="mr-toggle"><span class="material-symbols-outlined">edit_note</span></button>
      <button class="mr-btn" id="mr-add-pin" title="Drop a pin and write a note"><span class="material-symbols-outlined">push_pin</span> Pin a note</button>
      <button class="mr-btn mr-secondary" id="mr-add-page-note" title="General note about this page"><span class="material-symbols-outlined">sticky_note_2</span> Note this page</button>
      <button class="mr-btn mr-secondary" id="mr-view-all" title="See every note across every page"><span class="material-symbols-outlined">checklist</span> All notes <span class="mr-count">${total}</span></button>
      <span class="mr-status ${statusCls}" title="Click to refresh"><span class="mr-dot"></span> ${statusText}${reviewer ? ' · ' + escapeHtml(reviewer) : ''}</span>
    `;
    document.getElementById('mr-add-pin').addEventListener('click', enterPinMode);
    document.getElementById('mr-add-page-note').addEventListener('click', addPageNote);
    document.getElementById('mr-view-all').addEventListener('click', openDrawer);
    document.getElementById('mr-toggle').addEventListener('click', () => toolbarEl.classList.toggle('collapsed'));
    toolbarEl.querySelector('.mr-status').addEventListener('click', () => fetchAll());
  }

  // -------------------------------------------------------------
  // Pin placement
  // -------------------------------------------------------------
  let pinModeActive = false;
  let pinBanner = null;
  function enterPinMode() {
    ensureReviewerName(() => {
      if (pinModeActive) return exitPinMode();
      pinModeActive = true;
      document.body.classList.add('mr-pin-mode');
      pinBanner = document.createElement('div');
      pinBanner.className = 'mr-banner';
      pinBanner.textContent = 'Click anywhere on the page to drop a pin · Esc to cancel';
      document.body.appendChild(pinBanner);
      document.addEventListener('click', placePin, true);
      document.addEventListener('keydown', escCancel);
    });
  }
  function exitPinMode() {
    pinModeActive = false;
    document.body.classList.remove('mr-pin-mode');
    if (pinBanner) { pinBanner.remove(); pinBanner = null; }
    document.removeEventListener('click', placePin, true);
    document.removeEventListener('keydown', escCancel);
  }
  function escCancel(e) { if (e.key === 'Escape') exitPinMode(); }
  function placePin(e) {
    if (e.target.closest('.mr-toolbar') || e.target.closest('.mr-popover') || e.target.closest('.mr-banner')) return;
    e.preventDefault(); e.stopPropagation();
    exitPinMode();

    const pin = {
      id: uid(),
      page: pageId(),
      pageTitle: pageTitle(),
      type: 'pin',
      x: e.pageX, y: e.pageY,
      anchor: nearestAnchor(e.target),
      text: '',
      author: reviewer,
      createdAt: nowIso()
    };
    comments.push(pin);
    putComment(pin);
    renderPinsForCurrentPage();
    setTimeout(() => openPopoverForPin(pin.id), 50);
  }

  // -------------------------------------------------------------
  // Pin rendering
  // -------------------------------------------------------------
  function renderPinsForCurrentPage() {
    document.querySelectorAll('.mr-pin').forEach(el => el.remove());
    const pid = pageId();
    const pinsHere = comments.filter(c => c.type === 'pin' && c.page === pid);
    pinsHere.forEach((pin, idx) => {
      const el = document.createElement('div');
      el.className = 'mr-pin' + (pin.author && pin.author === reviewer ? ' mine' : '');
      el.style.left = pin.x + 'px';
      el.style.top  = pin.y + 'px';
      el.textContent = idx + 1;
      el.title = (pin.author ? pin.author + ': ' : '') + (pin.text || '(empty — click to add note)');
      el.addEventListener('click', e => { e.stopPropagation(); openPopoverForPin(pin.id); });
      document.body.appendChild(el);
    });
  }

  function openPopoverForPin(pinId) {
    closePopover();
    const pin = comments.find(c => c.id === pinId);
    if (!pin) return;
    const popover = document.createElement('div');
    popover.className = 'mr-popover'; popover.id = 'mr-popover';
    const top = pin.y + 16;
    const leftRaw = pin.x - 145;
    const left = Math.max(8, Math.min(leftRaw, document.documentElement.clientWidth - 306));
    popover.style.left = left + 'px'; popover.style.top  = top + 'px';
    const isMine = !pin.author || pin.author === reviewer;
    popover.innerHTML = `
      <div class="mr-pop-meta">${pin.author ? '<b>' + escapeHtml(pin.author) + '</b> · ' : ''}near "${escapeHtml((pin.anchor.text || pin.anchor.tag).slice(0, 50))}"</div>
      <textarea placeholder="Type your note…" id="mr-pop-text" ${!isMine ? 'readonly' : ''}>${escapeHtml(pin.text)}</textarea>
      <div class="mr-pop-actions">
        ${isMine ? '<button class="mr-danger" id="mr-pop-del">Delete</button>' : ''}
        <button class="mr-secondary" id="mr-pop-cancel">Close</button>
        ${isMine ? '<button id="mr-pop-save">Save</button>' : ''}
      </div>
    `;
    document.body.appendChild(popover);
    if (isMine) document.getElementById('mr-pop-text').focus();
    document.getElementById('mr-pop-save')?.addEventListener('click', () => {
      const text = document.getElementById('mr-pop-text').value.trim();
      const p = comments.find(c => c.id === pinId);
      if (p) { p.text = text; p.updatedAt = nowIso(); putComment(p); }
      closePopover();
      renderPinsForCurrentPage();
    });
    document.getElementById('mr-pop-cancel').addEventListener('click', () => {
      const p = comments.find(c => c.id === pinId);
      if (isMine && p && !p.text.trim()) {
        comments = comments.filter(c => c.id !== pinId);
        deleteComment(pinId);
      }
      closePopover();
      renderPinsForCurrentPage();
    });
    document.getElementById('mr-pop-del')?.addEventListener('click', () => {
      comments = comments.filter(c => c.id !== pinId);
      deleteComment(pinId);
      closePopover();
      renderPinsForCurrentPage();
    });
    setTimeout(() => document.addEventListener('click', outsideClick, true), 0);
    function outsideClick(e) {
      if (!popover.contains(e.target)) {
        document.removeEventListener('click', outsideClick, true);
        document.getElementById('mr-pop-cancel')?.click();
      }
    }
  }
  function closePopover() { document.getElementById('mr-popover')?.remove(); }

  // -------------------------------------------------------------
  // Page-level note
  // -------------------------------------------------------------
  function addPageNote() {
    ensureReviewerName(() => {
      const pid = pageId();
      const existing = pageNotes[pid]?.text || '';
      const text = prompt(`General note for "${pageTitle()}":`, existing);
      if (text === null) return;
      if (!text.trim()) {
        delete pageNotes[pid];
        deletePageNote(pid);
      } else {
        pageNotes[pid] = { page: pid, pageTitle: pageTitle(), text: text.trim(), author: reviewer, updatedAt: nowIso() };
        putPageNote(pid, { pageTitle: pageTitle(), author: reviewer, text: text.trim() });
      }
      renderToolbar();
    });
  }

  // -------------------------------------------------------------
  // Reviewer name (per-browser, in localStorage)
  // -------------------------------------------------------------
  function ensureReviewerName(cb) {
    if (reviewer) return cb();
    const wrap = document.createElement('div');
    wrap.className = 'mr-name-prompt';
    wrap.innerHTML = `
      <div class="card">
        <h3>Who's reviewing?</h3>
        <p>Your name will be on every note you add so others know who wrote what. Notes are shared — everyone working on this mockup sees the same set, but you can only edit your own.</p>
        <input id="mr-name-in" type="text" placeholder="e.g. Steven Carmichael" autofocus>
        <button id="mr-name-ok">Continue</button>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('mr-name-in').focus();
    document.getElementById('mr-name-ok').addEventListener('click', () => {
      const v = document.getElementById('mr-name-in').value.trim();
      if (!v) return;
      reviewer = v;
      localStorage.setItem(REVIEWER_KEY, v);
      renderToolbar();
      wrap.remove();
      cb();
    });
    document.getElementById('mr-name-in').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('mr-name-ok').click();
    });
  }

  // -------------------------------------------------------------
  // All-notes drawer
  // -------------------------------------------------------------
  function openDrawer() {
    closeDrawer();
    const bg = document.createElement('div');
    bg.className = 'mr-drawer-bg open'; bg.id = 'mr-drawer-bg';
    bg.addEventListener('click', closeDrawer);
    document.body.appendChild(bg);

    const drawer = document.createElement('div');
    drawer.className = 'mr-drawer'; drawer.id = 'mr-drawer';
    document.body.appendChild(drawer);

    const pages = {};
    comments.forEach(c => {
      pages[c.page] = pages[c.page] || { page: c.page, pageTitle: c.pageTitle, comments: [] };
      pages[c.page].comments.push(c);
    });
    Object.entries(pageNotes).forEach(([pid, note]) => {
      pages[pid] = pages[pid] || { page: pid, pageTitle: note.pageTitle, comments: [] };
    });
    const pageList = Object.values(pages).sort((a, b) => a.page.localeCompare(b.page));

    const contributors = [...new Set([
      ...comments.map(c => c.author).filter(Boolean),
      ...Object.values(pageNotes).map(p => p.author).filter(Boolean)
    ])];

    drawer.innerHTML = `
      <div class="mr-dh">
        <span class="material-symbols-outlined" style="color:#c0553a;">checklist</span>
        <h3>Review notes</h3>
        <button id="mr-drawer-close" style="background:none;border:none;color:#8a8880;cursor:pointer;font-size:20px;padding:0 6px;">×</button>
      </div>
      <div class="mr-db">
        <div style="margin-bottom:12px;font-size:12px;color:#5c5b56;">
          ${contributors.length > 0 ? `Contributors: ${contributors.map(r => `<b>${escapeHtml(r)}</b>`).join(', ')}` : 'No notes yet.'}
          <br><span style="color:#8a8880;">Synced ${timeAgo(lastSyncedAt)}.</span>
        </div>
        ${pageList.length === 0 ? `<div class="mr-empty"><span class="material-symbols-outlined" style="font-size:32px;">edit_note</span><div style="margin-top:6px;">No notes yet. Drop a pin or add a page note from the toolbar.</div></div>` : ''}
        ${pageList.map(pg => `
          <div class="mr-pg">
            <div class="mr-pg-h"><a class="pg-link" href="${pg.page}">${escapeHtml(pg.pageTitle)} <span style="font-weight:400;color:#a09e97;">(${pg.page})</span></a></div>
            ${pageNotes[pg.page] ? `
              <div class="mr-c">
                <div class="mr-c-h">
                  <span style="background:#4a5699;color:white;padding:1px 7px;border-radius:10px;font-weight:600;font-size:10px;">PAGE</span>
                  ${pageNotes[pg.page].author ? '<span class="mr-c-author">' + escapeHtml(pageNotes[pg.page].author) + '</span>' : ''}
                  ${(pageNotes[pg.page].author === reviewer || !pageNotes[pg.page].author) ? `<div class="mr-c-actions"><button title="Delete" data-del-page="${pg.page}">×</button></div>` : ''}
                </div>
                <div class="mr-c-text">${escapeHtml(pageNotes[pg.page].text)}</div>
              </div>
            ` : ''}
            ${pg.comments.map((c, i) => `
              <div class="mr-c">
                <div class="mr-c-h">
                  <span class="mr-c-num">#${i + 1}</span>
                  ${c.author ? '<span class="mr-c-author">' + escapeHtml(c.author) + '</span>' : ''}
                  <span class="mr-c-anchor">near <i>"${escapeHtml((c.anchor.text || c.anchor.tag || '').slice(0, 40))}"</i></span>
                  <div class="mr-c-actions">
                    <button title="Jump to pin" data-jump-page="${c.page}" data-jump-id="${c.id}">↗</button>
                    ${(c.author === reviewer || !c.author) ? `<button title="Delete" data-del="${c.id}">×</button>` : ''}
                  </div>
                </div>
                <div class="mr-c-text">${escapeHtml(c.text || '(empty)')}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      <div class="mr-df">
        <button class="mr-btn mr-secondary" id="mr-drawer-name">Change name</button>
        <button class="mr-btn mr-secondary" id="mr-drawer-refresh">Refresh</button>
        <span style="flex:1;"></span>
        <button class="mr-btn mr-secondary" id="mr-drawer-clear" style="color:#c0553a;border-color:#efb1a3;">Clear all</button>
      </div>
    `;
    drawer.classList.add('open');

    document.getElementById('mr-drawer-close').addEventListener('click', closeDrawer);
    drawer.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-del');
      comments = comments.filter(c => c.id !== id);
      deleteComment(id);
      closeDrawer(); openDrawer(); renderPinsForCurrentPage();
    }));
    drawer.querySelectorAll('[data-del-page]').forEach(b => b.addEventListener('click', () => {
      const pg = b.getAttribute('data-del-page');
      delete pageNotes[pg];
      deletePageNote(pg);
      closeDrawer(); openDrawer();
    }));
    drawer.querySelectorAll('[data-jump-page]').forEach(b => b.addEventListener('click', () => {
      sessionStorage.setItem('mr_jump_to', b.getAttribute('data-jump-id'));
      location.href = b.getAttribute('data-jump-page');
    }));
    document.getElementById('mr-drawer-clear').addEventListener('click', () => {
      if (confirm('Clear ALL review notes from EVERY reviewer? This cannot be undone.')) {
        clearAll().then(() => { closeDrawer(); renderPinsForCurrentPage(); });
      }
    });
    document.getElementById('mr-drawer-name').addEventListener('click', () => {
      const v = prompt('Reviewer name:', reviewer || '');
      if (v !== null && v.trim()) {
        reviewer = v.trim();
        localStorage.setItem(REVIEWER_KEY, reviewer);
        renderToolbar();
        closeDrawer(); openDrawer();
      }
    });
    document.getElementById('mr-drawer-refresh').addEventListener('click', async () => {
      await fetchAll(); closeDrawer(); openDrawer();
    });
  }
  function closeDrawer() {
    document.getElementById('mr-drawer')?.remove();
    document.getElementById('mr-drawer-bg')?.remove();
  }

  // -------------------------------------------------------------
  // Init + background sync
  // -------------------------------------------------------------
  async function start() {
    injectStyles();
    renderToolbar();
    await fetchAll();
    renderPinsForCurrentPage();

    setInterval(() => {
      if (document.hidden) return;
      if (document.getElementById('mr-popover')) return;
      if (document.getElementById('mr-drawer')) return;
      fetchAll();
    }, POLL_MS);

    window.addEventListener('focus', () => fetchAll());

    setInterval(() => renderToolbar(), 10000);

    const jump = sessionStorage.getItem('mr_jump_to');
    if (jump) {
      sessionStorage.removeItem('mr_jump_to');
      const c = comments.find(x => x.id === jump);
      if (c && c.page === pageId()) {
        setTimeout(() => {
          window.scrollTo({ top: Math.max(0, c.y - 200), behavior: 'smooth' });
          setTimeout(() => openPopoverForPin(jump), 600);
        }, 200);
      }
    }
  }

  return { start, _state: () => ({ comments, pageNotes, reviewer }) };
})();

document.addEventListener('DOMContentLoaded', () => window.MockReview.start());
