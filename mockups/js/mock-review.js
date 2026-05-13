/* ================================================================
   field-quotes mockups — review / markup overlay
   Lets a reviewer drop pinned comments and page-level notes on
   any mockup screen, then export the whole lot as a single
   markdown file to send back to the developer.

   Storage: localStorage key fq_review_v1
   Persists across page navigations within the same browser.
   ================================================================ */

window.MockReview = (function () {

  const KEY = 'fq_review_v1';

  // -------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      return { ...defaultData(), ...parsed };
    } catch (e) { return defaultData(); }
  }
  function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }
  function defaultData() {
    return {
      reviewer: '',
      startedAt: new Date().toISOString(),
      comments: [],
      pageNotes: {}      // keyed by page id
    };
  }
  function reset() { localStorage.removeItem(KEY); }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function uid() { return 'c_' + Math.random().toString(36).slice(2, 8); }
  function pageId() { return (location.pathname.split('/').pop() || 'index').replace(/[?#].*$/, ''); }
  function pageTitle() { return document.title.replace(/ — SKS Quotes.*$/, '').trim(); }
  function nowIso() { return new Date().toISOString(); }
  function dateLong(iso) { return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); }

  function nearestAnchor(el) {
    // Walk up to find the closest element with text or an id/class worth naming
    let cur = el;
    let depth = 0;
    while (cur && cur !== document.body && depth < 6) {
      const id = cur.id ? '#' + cur.id : null;
      const cls = cur.className && typeof cur.className === 'string' ? '.' + cur.className.trim().split(/\s+/).slice(0, 2).join('.') : null;
      const tag = cur.tagName.toLowerCase();
      const text = (cur.innerText || '').trim().slice(0, 60).replace(/\s+/g, ' ');
      if (text && text.length > 1) {
        return { tag, id, cls, text };
      }
      cur = cur.parentElement;
      depth++;
    }
    return { tag: el.tagName.toLowerCase(), text: '' };
  }

  // -------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById('mock-review-styles')) return;
    const s = document.createElement('style');
    s.id = 'mock-review-styles';
    s.textContent = `
      .mr-toolbar {
        position: fixed; right: 18px; bottom: 18px;
        z-index: 9990;
        background: white;
        border: 1px solid #e8e6e1;
        border-radius: 12px;
        padding: 8px;
        display: flex; gap: 6px; align-items: center;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        font-family: 'Inter', -apple-system, sans-serif;
      }
      .mr-toolbar.collapsed > .mr-btn:not(.mr-toggle) { display: none; }
      .mr-toolbar .mr-btn {
        background: #2d2d2a; color: white;
        border: none; padding: 8px 12px;
        border-radius: 6px; cursor: pointer;
        font: inherit; font-size: 12px; font-weight: 500;
        display: flex; align-items: center; gap: 5px;
      }
      .mr-toolbar .mr-btn:hover { filter: brightness(1.15); }
      .mr-toolbar .mr-btn.mr-secondary { background: white; color: #2d2d2a; border: 1px solid #d5d3cd; }
      .mr-toolbar .mr-btn.mr-secondary:hover { background: #f7f5f0; }
      .mr-toolbar .mr-btn.mr-success { background: #3d7c3f; }
      .mr-toolbar .mr-btn .material-symbols-outlined { font-size: 16px; }
      .mr-toolbar .mr-count { font-size: 11px; font-weight: 600; padding: 2px 7px; background: #c0553a; color: white; border-radius: 10px; }
      .mr-toolbar .mr-toggle { padding: 8px; }

      body.mr-pin-mode { cursor: crosshair !important; }
      body.mr-pin-mode * { cursor: crosshair !important; }

      .mr-pin {
        position: absolute;
        width: 26px; height: 26px;
        border-radius: 50%;
        background: #c0553a;
        color: white;
        font: 700 12px/26px 'IBM Plex Sans', sans-serif;
        text-align: center;
        cursor: pointer;
        z-index: 9985;
        transform: translate(-13px, -13px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 3px white;
        font-variant-numeric: tabular-nums;
      }
      .mr-pin:hover { background: #a04530; transform: translate(-13px, -13px) scale(1.08); }

      .mr-popover {
        position: absolute;
        z-index: 9988;
        background: white;
        border: 1px solid #e8e6e1;
        border-radius: 8px;
        padding: 10px;
        width: 280px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.18);
        font-family: 'Inter', sans-serif;
      }
      .mr-popover textarea {
        width: 100%; min-height: 70px;
        font: inherit; font-size: 13px;
        border: 1px solid #d5d3cd; border-radius: 6px;
        padding: 6px 8px; resize: vertical;
      }
      .mr-popover .mr-pop-actions { display: flex; gap: 6px; justify-content: flex-end; margin-top: 8px; }
      .mr-popover .mr-pop-actions button {
        background: #2d2d2a; color: white; border: none;
        padding: 6px 10px; border-radius: 5px; font: inherit; font-size: 12px; cursor: pointer;
      }
      .mr-popover .mr-pop-actions button.mr-secondary { background: white; color: #2d2d2a; border: 1px solid #d5d3cd; }
      .mr-popover .mr-pop-actions button.mr-danger { background: #c0553a; }

      .mr-banner {
        position: fixed;
        top: 36px; left: 50%; transform: translateX(-50%);
        background: #c0553a; color: white;
        padding: 6px 14px; border-radius: 0 0 8px 8px;
        font: 600 12px 'Inter', sans-serif;
        z-index: 9989;
      }

      .mr-drawer-bg {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 9991;
        display: none;
      }
      .mr-drawer-bg.open { display: block; }
      .mr-drawer {
        position: fixed; top: 0; right: 0; bottom: 0;
        width: 480px; max-width: 100%;
        background: #faf9f6;
        z-index: 9992;
        transform: translateX(100%);
        transition: transform 0.18s ease;
        display: flex; flex-direction: column;
        box-shadow: -8px 0 24px rgba(0,0,0,0.15);
        font-family: 'Inter', sans-serif;
      }
      .mr-drawer.open { transform: translateX(0); }
      .mr-drawer .mr-dh { padding: 14px 18px; border-bottom: 1px solid #e8e6e1; display: flex; align-items: center; gap: 8px; background: white; }
      .mr-drawer .mr-dh h3 { font-family: 'IBM Plex Sans', sans-serif; font-size: 16px; font-weight: 600; color: #2d2d2a; flex: 1; }
      .mr-drawer .mr-db { padding: 14px 18px; overflow-y: auto; flex: 1; }
      .mr-drawer .mr-df { padding: 12px 18px; border-top: 1px solid #e8e6e1; background: white; display: flex; gap: 8px; }
      .mr-drawer .mr-pg { margin-bottom: 14px; }
      .mr-drawer .mr-pg-h { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; font-size: 13px; color: #5c5b56; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 0; border-bottom: 1px solid #e8e6e1; margin-bottom: 6px; }
      .mr-drawer .mr-pg-h .pg-link { color: #4a5699; cursor: pointer; text-decoration: none; }
      .mr-drawer .mr-c { padding: 8px 10px; background: white; border: 1px solid #e8e6e1; border-radius: 6px; margin-bottom: 6px; font-size: 12.5px; }
      .mr-drawer .mr-c .mr-c-h { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; font-size: 11px; color: #8a8880; }
      .mr-drawer .mr-c .mr-c-num { background: #c0553a; color: white; padding: 1px 7px; border-radius: 10px; font-weight: 600; font-size: 10px; min-width: 20px; text-align: center; }
      .mr-drawer .mr-c .mr-c-anchor { font-style: italic; }
      .mr-drawer .mr-c .mr-c-text { color: #2d2d2a; line-height: 1.45; }
      .mr-drawer .mr-c .mr-c-actions { display: flex; gap: 4px; margin-left: auto; }
      .mr-drawer .mr-c .mr-c-actions button { background: none; border: none; color: #8a8880; cursor: pointer; padding: 0; font-size: 14px; line-height: 1; }
      .mr-drawer .mr-c .mr-c-actions button:hover { color: #c0553a; }

      .mr-empty { padding: 30px 20px; text-align: center; color: #8a8880; }

      .mr-name-prompt {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Inter', sans-serif;
      }
      .mr-name-prompt .card {
        background: white; border-radius: 12px;
        padding: 24px;
        max-width: 380px; width: 90%;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      }
      .mr-name-prompt h3 { font-family: 'IBM Plex Sans', sans-serif; font-size: 18px; margin-bottom: 6px; color: #2d2d2a; }
      .mr-name-prompt p { color: #5c5b56; font-size: 13px; margin-bottom: 14px; line-height: 1.5; }
      .mr-name-prompt input { width: 100%; padding: 10px; border: 1px solid #d5d3cd; border-radius: 6px; font: inherit; font-size: 14px; }
      .mr-name-prompt button { margin-top: 10px; background: #2d2d2a; color: white; border: none; padding: 9px 16px; border-radius: 6px; cursor: pointer; font: inherit; font-weight: 500; width: 100%; }
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
    const data = load();
    const total = data.comments.length + Object.values(data.pageNotes).filter(Boolean).length;
    toolbarEl.innerHTML = `
      <button class="mr-btn mr-toggle" title="Hide toolbar" id="mr-toggle"><span class="material-symbols-outlined">edit_note</span></button>
      <button class="mr-btn" id="mr-add-pin"><span class="material-symbols-outlined">push_pin</span> Pin a note</button>
      <button class="mr-btn mr-secondary" id="mr-add-page-note"><span class="material-symbols-outlined">sticky_note_2</span> Note this page</button>
      <button class="mr-btn mr-secondary" id="mr-view-all"><span class="material-symbols-outlined">checklist</span> All notes <span class="mr-count">${total}</span></button>
      <button class="mr-btn mr-success" id="mr-export"${total === 0 ? ' disabled style="opacity:0.55;cursor:not-allowed;"' : ''}><span class="material-symbols-outlined">file_download</span> Export</button>
    `;
    document.getElementById('mr-add-pin').addEventListener('click', enterPinMode);
    document.getElementById('mr-add-page-note').addEventListener('click', addPageNote);
    document.getElementById('mr-view-all').addEventListener('click', openDrawer);
    document.getElementById('mr-export').addEventListener('click', exportMarkdown);
    document.getElementById('mr-toggle').addEventListener('click', () => toolbarEl.classList.toggle('collapsed'));
  }

  // -------------------------------------------------------------
  // Pin placement
  // -------------------------------------------------------------
  let pinModeActive = false;
  let pinBanner = null;
  function enterPinMode() {
    if (pinModeActive) return exitPinMode();
    pinModeActive = true;
    document.body.classList.add('mr-pin-mode');
    pinBanner = document.createElement('div');
    pinBanner.className = 'mr-banner';
    pinBanner.textContent = 'Click anywhere on the page to drop a pin · Esc to cancel';
    document.body.appendChild(pinBanner);
    document.addEventListener('click', placePin, true);
    document.addEventListener('keydown', escCancel);
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
    // Ignore clicks on the toolbar itself
    if (e.target.closest('.mr-toolbar') || e.target.closest('.mr-popover') || e.target.closest('.mr-banner')) return;
    e.preventDefault();
    e.stopPropagation();
    exitPinMode();

    const x = e.pageX;
    const y = e.pageY;
    const anchor = nearestAnchor(e.target);

    const data = load();
    const pin = {
      id: uid(),
      page: pageId(),
      pageTitle: pageTitle(),
      type: 'pin',
      x, y,
      anchor,
      text: '',
      createdAt: nowIso()
    };
    data.comments.push(pin);
    save(data);
    renderPinsForCurrentPage();
    renderToolbar();
    setTimeout(() => openPopoverForPin(pin.id), 50);
  }

  // -------------------------------------------------------------
  // Pin rendering on current page
  // -------------------------------------------------------------
  function renderPinsForCurrentPage() {
    document.querySelectorAll('.mr-pin').forEach(el => el.remove());
    const data = load();
    const pid = pageId();
    const onThisPage = data.comments.filter(c => c.type === 'pin' && c.page === pid);
    onThisPage.forEach((pin, idx) => {
      const numberOnPage = idx + 1;
      const el = document.createElement('div');
      el.className = 'mr-pin';
      el.style.left = pin.x + 'px';
      el.style.top  = pin.y + 'px';
      el.textContent = numberOnPage;
      el.title = pin.text || '(empty — click to add note)';
      el.addEventListener('click', e => { e.stopPropagation(); openPopoverForPin(pin.id); });
      document.body.appendChild(el);
    });
  }

  function openPopoverForPin(pinId) {
    closePopover();
    const data = load();
    const pin = data.comments.find(c => c.id === pinId);
    if (!pin) return;
    const popover = document.createElement('div');
    popover.className = 'mr-popover';
    popover.id = 'mr-popover';
    const top = pin.y + 16;
    const leftRaw = pin.x - 140;
    const left = Math.max(8, Math.min(leftRaw, document.documentElement.clientWidth - 296));
    popover.style.left = left + 'px';
    popover.style.top  = top + 'px';
    popover.innerHTML = `
      <div style="font-size:11px;color:#8a8880;margin-bottom:4px;">Pin on <b>${pin.pageTitle}</b> · near "${(pin.anchor.text || pin.anchor.tag).slice(0, 50)}"</div>
      <textarea placeholder="Type your note…" id="mr-pop-text">${escapeHtml(pin.text)}</textarea>
      <div class="mr-pop-actions">
        <button class="mr-danger" id="mr-pop-del">Delete</button>
        <button class="mr-secondary" id="mr-pop-cancel">Cancel</button>
        <button id="mr-pop-save">Save</button>
      </div>
    `;
    document.body.appendChild(popover);
    document.getElementById('mr-pop-text').focus();
    document.getElementById('mr-pop-save').addEventListener('click', () => {
      const text = document.getElementById('mr-pop-text').value.trim();
      const d = load();
      const p = d.comments.find(c => c.id === pinId);
      if (p) { p.text = text; save(d); }
      closePopover();
      renderPinsForCurrentPage();
      renderToolbar();
    });
    document.getElementById('mr-pop-cancel').addEventListener('click', () => {
      // If empty pin and user cancels, remove the pin
      const d = load();
      const p = d.comments.find(c => c.id === pinId);
      if (p && !p.text.trim()) {
        d.comments = d.comments.filter(c => c.id !== pinId);
        save(d);
      }
      closePopover();
      renderPinsForCurrentPage();
      renderToolbar();
    });
    document.getElementById('mr-pop-del').addEventListener('click', () => {
      const d = load();
      d.comments = d.comments.filter(c => c.id !== pinId);
      save(d);
      closePopover();
      renderPinsForCurrentPage();
      renderToolbar();
    });
    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', outsideClick, true);
    }, 0);
    function outsideClick(e) {
      if (!popover.contains(e.target)) {
        document.removeEventListener('click', outsideClick, true);
        document.getElementById('mr-pop-cancel')?.click();
      }
    }
  }
  function closePopover() {
    document.getElementById('mr-popover')?.remove();
  }

  // -------------------------------------------------------------
  // Page-level note
  // -------------------------------------------------------------
  function addPageNote() {
    ensureReviewerName(() => {
      const data = load();
      const pid = pageId();
      const existing = data.pageNotes[pid]?.text || '';
      const text = prompt(`General note for "${pageTitle()}":`, existing);
      if (text === null) return;
      data.pageNotes[pid] = data.pageNotes[pid] || { page: pid, pageTitle: pageTitle(), createdAt: nowIso() };
      data.pageNotes[pid].text = text.trim();
      data.pageNotes[pid].updatedAt = nowIso();
      if (!data.pageNotes[pid].text) delete data.pageNotes[pid];
      save(data);
      renderToolbar();
    });
  }

  // -------------------------------------------------------------
  // Reviewer name (asked once on first interaction)
  // -------------------------------------------------------------
  function ensureReviewerName(cb) {
    const d = load();
    if (d.reviewer) return cb();
    const wrap = document.createElement('div');
    wrap.className = 'mr-name-prompt';
    wrap.innerHTML = `
      <div class="card">
        <h3>Who's reviewing?</h3>
        <p>Your name will be on the exported notes file so the developer knows who they're from.</p>
        <input id="mr-name-in" type="text" placeholder="e.g. Steven Carmichael" autofocus>
        <button id="mr-name-ok">Continue</button>
      </div>
    `;
    document.body.appendChild(wrap);
    document.getElementById('mr-name-in').focus();
    document.getElementById('mr-name-ok').addEventListener('click', () => {
      const v = document.getElementById('mr-name-in').value.trim();
      if (!v) return;
      const d = load();
      d.reviewer = v;
      save(d);
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
    bg.className = 'mr-drawer-bg open';
    bg.id = 'mr-drawer-bg';
    bg.addEventListener('click', closeDrawer);
    document.body.appendChild(bg);

    const drawer = document.createElement('div');
    drawer.className = 'mr-drawer';
    drawer.id = 'mr-drawer';
    document.body.appendChild(drawer);

    const data = load();
    // Group comments by page
    const pages = {};
    data.comments.forEach(c => {
      pages[c.page] = pages[c.page] || { page: c.page, pageTitle: c.pageTitle, comments: [] };
      pages[c.page].comments.push(c);
    });
    Object.entries(data.pageNotes).forEach(([pid, note]) => {
      pages[pid] = pages[pid] || { page: pid, pageTitle: note.pageTitle, comments: [] };
    });
    const pageList = Object.values(pages).sort((a, b) => a.page.localeCompare(b.page));

    drawer.innerHTML = `
      <div class="mr-dh">
        <span class="material-symbols-outlined" style="color:#c0553a;">checklist</span>
        <h3>Review notes</h3>
        <button class="mr-btn mr-secondary" id="mr-drawer-close" style="background:none;border:none;color:#8a8880;cursor:pointer;font-size:20px;">×</button>
      </div>
      <div class="mr-db">
        ${data.reviewer ? `<div style="margin-bottom:12px;font-size:12px;color:#5c5b56;">Reviewer: <b>${data.reviewer}</b> · started ${dateLong(data.startedAt)}</div>` : ''}
        ${pageList.length === 0 ? `<div class="mr-empty"><span class="material-symbols-outlined" style="font-size:32px;">edit_note</span><div style="margin-top:6px;">No notes yet. Drop a pin or add a page note from the toolbar.</div></div>` : ''}
        ${pageList.map(pg => `
          <div class="mr-pg">
            <div class="mr-pg-h"><a class="pg-link" href="${pg.page}">${pg.pageTitle} <span style="font-weight:400;color:#a09e97;">(${pg.page})</span></a></div>
            ${data.pageNotes[pg.page] ? `
              <div class="mr-c">
                <div class="mr-c-h">
                  <span style="background:#4a5699;color:white;padding:1px 7px;border-radius:10px;font-weight:600;font-size:10px;">PAGE</span>
                  General note
                  <div class="mr-c-actions">
                    <button title="Delete" data-del-page="${pg.page}">×</button>
                  </div>
                </div>
                <div class="mr-c-text">${escapeHtml(data.pageNotes[pg.page].text)}</div>
              </div>
            ` : ''}
            ${pg.comments.map((c, i) => `
              <div class="mr-c">
                <div class="mr-c-h">
                  <span class="mr-c-num">#${i + 1}</span>
                  <span class="mr-c-anchor">near "${(c.anchor.text || c.anchor.tag || '').slice(0, 40)}"</span>
                  <div class="mr-c-actions">
                    <button title="Jump" data-jump-page="${c.page}" data-jump-id="${c.id}">↗</button>
                    <button title="Delete" data-del="${c.id}">×</button>
                  </div>
                </div>
                <div class="mr-c-text">${escapeHtml(c.text || '(empty)')}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      <div class="mr-df">
        <button class="mr-btn mr-secondary" id="mr-drawer-clear" style="margin-right:auto;">Clear all</button>
        <button class="mr-btn mr-secondary" id="mr-drawer-name">Change name</button>
        <button class="mr-btn mr-success" id="mr-drawer-export"><span class="material-symbols-outlined">file_download</span> Export</button>
      </div>
    `;

    drawer.classList.add('open');

    document.getElementById('mr-drawer-close').addEventListener('click', closeDrawer);
    drawer.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
      const id = b.getAttribute('data-del');
      const d = load();
      d.comments = d.comments.filter(c => c.id !== id);
      save(d);
      closeDrawer();
      openDrawer();
      renderPinsForCurrentPage();
      renderToolbar();
    }));
    drawer.querySelectorAll('[data-del-page]').forEach(b => b.addEventListener('click', () => {
      const pg = b.getAttribute('data-del-page');
      const d = load();
      delete d.pageNotes[pg];
      save(d);
      closeDrawer();
      openDrawer();
      renderToolbar();
    }));
    drawer.querySelectorAll('[data-jump-page]').forEach(b => b.addEventListener('click', () => {
      const pg = b.getAttribute('data-jump-page');
      const id = b.getAttribute('data-jump-id');
      sessionStorage.setItem('mr_jump_to', id);
      location.href = pg;
    }));
    document.getElementById('mr-drawer-clear').addEventListener('click', () => {
      if (confirm('Clear ALL review notes? This can\'t be undone.')) {
        reset();
        closeDrawer();
        document.querySelectorAll('.mr-pin').forEach(el => el.remove());
        renderToolbar();
      }
    });
    document.getElementById('mr-drawer-name').addEventListener('click', () => {
      const d = load();
      const v = prompt('Reviewer name:', d.reviewer || '');
      if (v !== null) {
        d.reviewer = v.trim();
        save(d);
        closeDrawer();
        openDrawer();
      }
    });
    document.getElementById('mr-drawer-export').addEventListener('click', exportMarkdown);
  }
  function closeDrawer() {
    document.getElementById('mr-drawer')?.remove();
    document.getElementById('mr-drawer-bg')?.remove();
  }

  // -------------------------------------------------------------
  // Export — self-contained HTML with screenshots of each commented
  // page (pins overlaid). Uses html2canvas loaded from CDN.
  // -------------------------------------------------------------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Group helpers
  function groupedByPage(data) {
    const pages = {};
    data.comments.forEach(c => {
      pages[c.page] = pages[c.page] || { page: c.page, pageTitle: c.pageTitle, comments: [] };
      pages[c.page].comments.push(c);
    });
    Object.entries(data.pageNotes).forEach(([pid, note]) => {
      pages[pid] = pages[pid] || { page: pid, pageTitle: note.pageTitle, comments: [] };
    });
    return Object.values(pages).sort((a, b) => a.page.localeCompare(b.page));
  }

  // Capture a single page in an iframe — load it, draw pins, screenshot.
  // Returns a base64 PNG data URL (or null if capture failed).
  async function captureIframe(pageHref, comments, statusFn) {
    return new Promise(resolve => {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1280px;height:1800px;border:0;';
      iframe.setAttribute('src', pageHref + (pageHref.includes('?') ? '&' : '?') + 'mr_capture=1');
      let resolved = false;
      const finish = (val) => { if (!resolved) { resolved = true; iframe.remove(); resolve(val); } };

      iframe.onload = async () => {
        try {
          // Give the iframe time for its DOMContentLoaded scripts to draw pins
          await new Promise(r => setTimeout(r, 1000));
          const idoc = iframe.contentDocument;
          const iwin = iframe.contentWindow;
          if (!idoc || !iwin) return finish(null);

          // Hide the iframe's review toolbar / expiry banner so they don't show in the snapshot
          const toolbar = idoc.querySelector('.mr-toolbar');
          if (toolbar) toolbar.style.display = 'none';
          const banner = idoc.querySelector('.mock-expiry-banner');
          if (banner) banner.style.display = 'none';
          // Pins are drawn by the iframe's own MockReview.start (loaded from localStorage)

          // Resize iframe to fit content height for the screenshot
          const fullH = Math.max(idoc.body.scrollHeight, idoc.documentElement.scrollHeight);
          iframe.style.height = (fullH + 100) + 'px';
          await new Promise(r => setTimeout(r, 250));

          // Use the parent window's html2canvas — it works against same-origin iframes
          const canvas = await window.html2canvas(idoc.body, {
            backgroundColor: '#f7f5f0',
            scale: 1,
            useCORS: true,
            logging: false,
            width: 1280,
            height: fullH,
            windowWidth: 1280,
            windowHeight: fullH
          });
          finish(canvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Capture failed for', pageHref, e);
          finish(null);
        }
      };

      // Safety timeout
      setTimeout(() => finish(null), 12000);
      document.body.appendChild(iframe);
    });
  }

  // Progress overlay during export
  function showProgress(msg) {
    let el = document.getElementById('mr-progress');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mr-progress';
      el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;color:white;';
      el.innerHTML = `<div style="background:#2d2d2a;padding:24px 32px;border-radius:12px;text-align:center;min-width:300px;"><div class="mr-spin" style="width:32px;height:32px;border:3px solid rgba(255,255,255,0.2);border-top-color:white;border-radius:50%;margin:0 auto 12px;animation:mr-spin 0.8s linear infinite;"></div><div id="mr-progress-msg">${msg}</div></div><style>@keyframes mr-spin{to{transform:rotate(360deg);}}</style>`;
      document.body.appendChild(el);
    } else {
      document.getElementById('mr-progress-msg').textContent = msg;
    }
  }
  function hideProgress() { document.getElementById('mr-progress')?.remove(); }

  async function exportMarkdown() { /* alias for backward compat */ return exportHtml(); }

  async function exportHtml() {
    const data = load();
    if (data.comments.length === 0 && Object.keys(data.pageNotes).length === 0) {
      alert('No notes to export yet.');
      return;
    }
    ensureReviewerName(async () => {
      try {
        showProgress('Loading capture library…');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

        const pageList = groupedByPage(data);
        const screenshots = {};

        for (let i = 0; i < pageList.length; i++) {
          const pg = pageList[i];
          showProgress(`Capturing page ${i + 1} of ${pageList.length}: ${pg.pageTitle}…`);
          const href = pg.page;
          const png = await captureIframe(href, pg.comments, showProgress);
          if (png) screenshots[pg.page] = png;
        }

        showProgress('Building report…');
        const html = buildReportHtml(data, pageList, screenshots);

        const date = new Date().toISOString().slice(0, 10);
        const reviewer = (data.reviewer || 'reviewer').replace(/\W+/g, '-').toLowerCase();
        const filename = `sks-quotes-review_${reviewer}_${date}.html`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (e) {
        console.error(e);
        alert('Export failed: ' + (e.message || e));
      } finally {
        hideProgress();
      }
    });
  }

  function buildReportHtml(data, pageList, screenshots) {
    const today = dateLong(nowIso());
    const totalPins = data.comments.length;
    const totalPageNotes = Object.keys(data.pageNotes).length;

    const pageSections = pageList.map(pg => {
      const pageNote = data.pageNotes[pg.page];
      const liveUrl = location.origin + location.pathname.replace(/[^\/]*$/, pg.page);
      const shot = screenshots[pg.page];

      return `
        <section class="page">
          <header>
            <h2>${escapeHtml(pg.pageTitle)}</h2>
            <div class="meta"><code>mockups/${pg.page}</code> · <a href="${liveUrl}" target="_blank">View live</a></div>
          </header>

          ${pageNote ? `
            <div class="page-note">
              <div class="ln-label">General note for this page</div>
              <div class="ln-text">${escapeHtml(pageNote.text)}</div>
            </div>
          ` : ''}

          ${shot ? `
            <figure>
              <img src="${shot}" alt="${escapeHtml(pg.pageTitle)} screenshot">
              <figcaption>Numbered pins correspond to the comments below.</figcaption>
            </figure>
          ` : `<div class="no-shot">(Screenshot capture failed for this page — see comments below.)</div>`}

          ${pg.comments.length > 0 ? `
            <ol class="pins">
              ${pg.comments.map((c, i) => `
                <li>
                  <div class="pin-head">
                    <span class="pin-num">#${i + 1}</span>
                    <span class="pin-anchor">near <i>"${escapeHtml((c.anchor.text || c.anchor.tag || '').slice(0, 80))}"</i></span>
                    <span class="pin-coords">(${c.x}, ${c.y})</span>
                  </div>
                  <div class="pin-text">${escapeHtml(c.text || '(empty)')}</div>
                  ${c.anchor.id || c.anchor.cls ? `<div class="pin-sel"><code>${escapeHtml(c.anchor.tag + (c.anchor.id || '') + (c.anchor.cls || ''))}</code></div>` : ''}
                </li>
              `).join('')}
            </ol>
          ` : ''}
        </section>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SKS Quotes mockup review — ${escapeHtml(data.reviewer || 'reviewer')}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', system-ui, sans-serif; color: #2d2d2a; background: #f7f5f0; margin: 0; padding: 0; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 24px 60px; }
  header.cover { background: white; border: 1px solid #e8e6e1; border-radius: 12px; padding: 28px 32px; margin-bottom: 24px; }
  header.cover h1 { margin: 0 0 6px; font-size: 26px; font-weight: 700; }
  header.cover .sub { color: #5c5b56; font-size: 14px; }
  header.cover .stats { display: flex; gap: 24px; margin-top: 14px; font-size: 13px; }
  header.cover .stats b { font-size: 18px; display: block; }
  section.page { background: white; border: 1px solid #e8e6e1; border-radius: 12px; padding: 24px; margin-bottom: 22px; }
  section.page > header { border-bottom: 1px solid #e8e6e1; padding-bottom: 12px; margin-bottom: 16px; }
  section.page h2 { font-size: 19px; margin: 0 0 4px; }
  section.page .meta { color: #8a8880; font-size: 12px; }
  section.page .meta a { color: #4a5699; }
  .page-note { background: #fdf6e3; border-left: 4px solid #b8860b; padding: 12px 14px; border-radius: 4px; margin: 12px 0; }
  .ln-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #b8860b; margin-bottom: 4px; }
  .ln-text { white-space: pre-wrap; line-height: 1.55; }
  figure { margin: 16px 0; padding: 0; }
  figure img { width: 100%; border: 1px solid #e8e6e1; border-radius: 6px; display: block; }
  figcaption { font-size: 11px; color: #8a8880; text-align: center; margin-top: 6px; }
  .no-shot { padding: 12px; background: #ffebee; border-radius: 6px; color: #c0553a; font-size: 12px; }
  ol.pins { list-style: none; padding: 0; margin: 16px 0 0; counter-reset: pin; }
  ol.pins li { background: #faf9f6; border: 1px solid #e8e6e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
  .pin-head { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #5c5b56; margin-bottom: 6px; }
  .pin-num { background: #c0553a; color: white; padding: 2px 9px; border-radius: 12px; font-weight: 700; font-size: 11px; }
  .pin-anchor i { color: #2d2d2a; }
  .pin-coords { color: #a09e97; font-size: 11px; margin-left: auto; }
  .pin-text { font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
  .pin-sel { margin-top: 6px; font-size: 11px; color: #8a8880; }
  .pin-sel code { background: #f2f0eb; padding: 2px 6px; border-radius: 3px; }
  footer.report { text-align: center; color: #8a8880; font-size: 11px; margin-top: 24px; }
  details.raw { margin-top: 30px; }
  details.raw summary { cursor: pointer; color: #8a8880; font-size: 12px; padding: 8px; }
  details.raw pre { background: white; padding: 16px; border-radius: 6px; overflow: auto; font-size: 11px; max-height: 360px; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="cover">
      <h1>SKS Quotes mockup — Review notes</h1>
      <div class="sub"><b>${escapeHtml(data.reviewer || '(unknown)')}</b> · ${escapeHtml(today)}</div>
      <div class="stats">
        <div><b>${pageList.length}</b> page${pageList.length === 1 ? '' : 's'} reviewed</div>
        <div><b>${totalPins}</b> pinned note${totalPins === 1 ? '' : 's'}</div>
        <div><b>${totalPageNotes}</b> general page note${totalPageNotes === 1 ? '' : 's'}</div>
      </div>
    </header>
    ${pageSections}
    <footer class="report">
      Generated by the field-quotes mockup review tool · Send this file back to the developer.
    </footer>

    <details class="raw">
      <summary>Raw data (for the developer)</summary>
      <pre id="raw-data"></pre>
    </details>
  </div>

  <script id="review-data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
  <script>
    document.getElementById('raw-data').textContent = document.getElementById('review-data').textContent;
  </script>
</body>
</html>`;
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // -------------------------------------------------------------
  // Init
  // -------------------------------------------------------------
  function start() {
    injectStyles();
    renderToolbar();
    renderPinsForCurrentPage();

    // If a "jump to" was set before navigating here, scroll to it
    const jump = sessionStorage.getItem('mr_jump_to');
    if (jump) {
      sessionStorage.removeItem('mr_jump_to');
      const data = load();
      const c = data.comments.find(x => x.id === jump);
      if (c && c.page === pageId()) {
        setTimeout(() => {
          window.scrollTo({ top: Math.max(0, c.y - 200), behavior: 'smooth' });
          setTimeout(() => openPopoverForPin(jump), 600);
        }, 200);
      }
    }
  }

  return { start, exportHtml, exportMarkdown, reset };
})();

document.addEventListener('DOMContentLoaded', () => window.MockReview.start());
