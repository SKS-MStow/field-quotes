/* ================================================================
   field-quotes mockups — review / markup overlay
   Server-backed, per-record. Each comment / page note is its own
   row server-side, so concurrent reviewers can't trample each
   other's notes. Reviewer name lives per-browser in localStorage.
   ================================================================ */

window.MockReview = (function () {

  // Auto-detect env from the URL path so the same JS file can serve both
  //   /mockups/<slug>/         → prod  (canonical)
  //   /mockups-staging/<slug>/ → staging
  //   /quotes-mockup/, /quotes-mockup-staging/ → legacy aliases (deprecated 2026-05-22)
  const m = location.pathname.match(/^\/(mockups|mockups-staging)\/([^\/]+)\//);
  let STAGING, API_BASE, MOCKUP_SLUG;
  if (m) {
    STAGING     = m[1] === 'mockups-staging';
    MOCKUP_SLUG = m[2];
    API_BASE    = (STAGING ? '/api/mockups-staging/' : '/api/mockups/') + MOCKUP_SLUG;
  } else {
    STAGING     = /\/quotes-mockup-staging\//.test(location.pathname);
    MOCKUP_SLUG = 'quotes-tool';
    API_BASE    = STAGING ? '/api/quotes-mockup-staging' : '/api/quotes-mockup';
  }
  const API = API_BASE + '/notes';
  const POLL_MS = 12000;
  const REVIEWER_KEY = STAGING ? 'mr_reviewer_v1_staging' : 'mr_reviewer_v1';

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
  // Quote-context pages: each (quote id + mode) is its own pinning context,
  // so notes Steven leaves on a small quote don't bleed onto a different quote
  // that happens to use the same HTML file. The suffix uses ?q=…&m=… purely
  // as an opaque key — we strip it before navigating via the jump-to-pin link.
  const QUOTE_CTX_FILES = /^(03-client-info|04-area-builder|05-review|06-output-preview)\.html$/;
  function quoteContext(file) {
    if (!QUOTE_CTX_FILES.test(file)) return '';
    try {
      const q = (typeof MockState !== 'undefined') && MockState.getCurrentQuote && MockState.getCurrentQuote();
      if (!q) return '';
      return '?q=' + encodeURIComponent(q.id) + '&m=' + encodeURIComponent(q.mode || 'large');
    } catch (e) { return ''; }
  }
  function pageId() {
    // Include the hash so tabbed pages (07-admin.html#products vs
    // #services) are treated as distinct contexts for pinning.
    const file = (location.pathname.split('/').pop() || 'index').replace(/\?.*$/, '');
    const hash = (location.hash || '').split('?')[0];
    return file + quoteContext(file) + hash;
  }
  // Strip the quote-context suffix back off — used when building hrefs for
  // jump-to-pin so the browser actually loads a clean URL.
  function pageHref(storedPage) {
    return (storedPage || '').replace(/\?q=[^&#]*(&m=[^#]*)?/, '');
  }
  // Extract the quote id from a stored pageId so we can restore MockState
  // after the jump-to-pin navigation lands.
  function pageQuoteId(storedPage) {
    const m = (storedPage || '').match(/[?&]q=([^&#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function pageTitle() {
    const base = document.title.replace(/ — SKS Quotes.*$/, '').trim();
    const file = (location.pathname.split('/').pop() || 'index');
    try {
      const q = QUOTE_CTX_FILES.test(file) && (typeof MockState !== 'undefined') && MockState.getCurrentQuote && MockState.getCurrentQuote();
      if (q) {
        const modeLabel = q.mode === 'quick' ? 'small' : 'large';
        const num = q.number || q.id;
        return base + ' · ' + modeLabel + ' quote ' + num;
      }
    } catch (e) {}
    return base;
  }
  function quoteContextLabel() {
    const file = (location.pathname.split('/').pop() || 'index');
    if (!QUOTE_CTX_FILES.test(file)) return '';
    try {
      const q = (typeof MockState !== 'undefined') && MockState.getCurrentQuote && MockState.getCurrentQuote();
      if (q) {
        const modeLabel = q.mode === 'quick' ? 'small' : 'large';
        return modeLabel + ' · ' + (q.number || q.id);
      }
    } catch (e) {}
    return '';
  }
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
  function dateLong(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('en-AU', { day:'numeric', month:'short', year:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
  }

  // ---------- DOM-anchoring (so pins survive layout reflow) ----------
  // Build a CSS selector path that re-finds the element after navigation/resize.
  function cssPathOf(el) {
    if (!el || el === document.body || el.nodeType !== 1) return 'body';
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur.nodeType === 1 && parts.length < 7) {
      if (cur.id) { parts.unshift('#' + CSS.escape(cur.id)); break; }
      let part = cur.tagName.toLowerCase();
      if (cur.classList && cur.classList.length) {
        const cls = Array.from(cur.classList).filter(c => c && !c.startsWith('mr-')).slice(0, 2);
        if (cls.length) part += '.' + cls.map(c => CSS.escape(c)).join('.');
      }
      const parent = cur.parentElement;
      if (parent) {
        const sameTagSibs = Array.from(parent.children).filter(s => s.tagName === cur.tagName);
        if (sameTagSibs.length > 1) part += `:nth-of-type(${sameTagSibs.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = parent;
    }
    return parts.join(' > ');
  }

  // Resolve a saved selector back to an element (best effort).
  function resolveAnchorElement(pin) {
    if (!pin) return null;
    if (pin.selector) {
      try {
        const el = document.querySelector(pin.selector);
        if (el) return el;
      } catch (e) { /* invalid selector — fall through */ }
    }
    // Fallback: try by id, or by class+text snippet
    if (pin.anchor) {
      if (pin.anchor.id) {
        try {
          const id = pin.anchor.id.replace(/^#/, '');
          const el = document.getElementById(id);
          if (el) return el;
        } catch (e) {}
      }
      if (pin.anchor.cls) {
        try {
          const cls = pin.anchor.cls.replace(/^\./, '').split('.')[0];
          if (cls && pin.anchor.text) {
            const probe = pin.anchor.text.slice(0, 30).toLowerCase();
            const candidates = document.getElementsByClassName(cls);
            for (const c of candidates) {
              if ((c.innerText || '').toLowerCase().includes(probe)) return c;
            }
          }
        } catch (e) {}
      }
    }
    return null;
  }

  // Compute (left, top) in document coords for a pin.
  // Scaling-safe: stored offset is a fraction of the element's size at click
  // time, so we multiply by the element's current size on render. Legacy pins
  // (created before the fractional model) fall back to the absolute pixel
  // offset, which is still close enough on similar viewport widths.
  function pinPosition(pin) {
    const el = resolveAnchorElement(pin);
    if (el) {
      const rect = el.getBoundingClientRect();
      const ox = (typeof pin.offsetXFrac === 'number')
        ? pin.offsetXFrac * rect.width
        : (pin.offsetX || 0);
      const oy = (typeof pin.offsetYFrac === 'number')
        ? pin.offsetYFrac * rect.height
        : (pin.offsetY || 0);
      return {
        left: Math.round(rect.left + ox + window.scrollX),
        top:  Math.round(rect.top  + oy + window.scrollY)
      };
    }
    // Fallback for legacy pins without selector/offset (or anchor element gone)
    return { left: pin.x || 0, top: pin.y || 0 };
  }

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
        font-family: 'Inter', -apple-system, sans-serif;
        user-select: none; }
      .mr-toolbar.dragging { transition: none; cursor: grabbing !important; box-shadow: 0 12px 32px rgba(0,0,0,0.22); }
      .mr-toolbar .mr-drag {
        cursor: grab; padding: 0 2px; color: #b8b6af;
        display: flex; align-items: center; justify-content: center;
        align-self: stretch;
      }
      .mr-toolbar .mr-drag:hover { color: #2d2d2a; }
      .mr-toolbar .mr-drag .material-symbols-outlined { font-size: 18px; }
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

      /* ---- Shape annotations (rect / circle / cloud lasso) ---- */
      body.mr-draw-mode, body.mr-draw-mode * { cursor: crosshair !important; user-select: none !important; }
      .mr-shape { position: absolute; z-index: 9984; pointer-events: none;
        opacity: 0; transition: opacity 0.12s ease; }
      .mr-shape.show { opacity: 1; }
      .mr-shape svg { width: 100%; height: 100%; overflow: visible; }
      .mr-shape svg .mr-shape-stroke {
        fill: rgba(192,85,58,0.06);
        stroke: #c0553a; stroke-width: 2.5;
        stroke-linejoin: round; stroke-linecap: round;
        stroke-dasharray: 6 3;
      }
      .mr-shape.mine svg .mr-shape-stroke { stroke: #4a5699; fill: rgba(74,86,153,0.06); }
      .mr-shape-marker { position: absolute; z-index: 9986;
        width: 24px; height: 24px;
        background: #c0553a; color: white;
        border-radius: 50% 50% 50% 0;
        transform: translate(-2px, -22px) rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0,0,0,0.25), 0 0 0 2px white;
      }
      .mr-shape-marker.mine { background: #4a5699; }
      .mr-shape-marker:hover { filter: brightness(1.1); }
      .mr-shape-marker .mr-sm-icon { transform: rotate(45deg);
        font-family: 'Material Symbols Outlined'; font-size: 14px;
        font-variation-settings: 'FILL' 1; line-height: 1; }
      .mr-shape-marker .mr-sm-num { transform: rotate(45deg);
        font: 700 9px 'IBM Plex Sans', sans-serif;
        position: absolute; bottom: -3px; right: -5px;
        background: white; color: #2d2d2a;
        border-radius: 50%; width: 13px; height: 13px;
        display: flex; align-items: center; justify-content: center;
        font-variant-numeric: tabular-nums;
      }

      /* Shape picker popover (selects rect/circle/cloud) */
      .mr-shape-picker { position: absolute; z-index: 9991; background: white;
        border: 1px solid #e8e6e1; border-radius: 10px; padding: 4px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.18); display: flex; gap: 2px; }
      .mr-shape-picker button { background: white; color: #2d2d2a;
        border: 1px solid transparent; border-radius: 6px;
        padding: 6px 10px; font: 600 11px 'Inter', sans-serif;
        cursor: pointer; display: flex; align-items: center; gap: 4px; }
      .mr-shape-picker button.active { background: #2d2d2a; color: white; }
      .mr-shape-picker button .material-symbols-outlined { font-size: 16px; }

      /* In-progress drawing preview (live SVG that follows the cursor) */
      .mr-draw-preview { position: absolute; z-index: 9985; pointer-events: none;
        opacity: 0.8; }
      .mr-draw-preview svg { width: 100%; height: 100%; overflow: visible; }
      .mr-draw-preview svg .mr-shape-stroke {
        fill: rgba(192,85,58,0.08);
        stroke: #c0553a; stroke-width: 2.5;
        stroke-linejoin: round; stroke-linecap: round;
        stroke-dasharray: 6 3;
      }

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

      /* History drawer rows */
      .mr-rev-row { display: flex; align-items: center; gap: 8px; padding: 10px 12px;
        background: white; border: 1px solid #e8e6e1; border-radius: 8px; margin-bottom: 8px; }
      .mr-rev-row .mr-rev-meta { flex: 1; min-width: 0; }
      .mr-rev-row .mr-rev-label { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; font-size: 13px; color: #2d2d2a; overflow: hidden; text-overflow: ellipsis; }
      .mr-rev-row .mr-rev-sub { font-size: 11px; color: #8a8880; margin-top: 2px; }
      .mr-rev-row .mr-btn-sm { padding: 5px 10px; font-size: 11px; }
      .mr-rev-row .mr-rev-del { padding: 5px 8px; color: #c0553a; }
      .mr-rev-row .mr-rev-del:hover { background: #ffebee; }
      .mr-btn.mr-success { background: #3d7c3f; color: white; }

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
      <span class="mr-drag" id="mr-drag" title="Drag to move · double-click to reset"><span class="material-symbols-outlined">drag_indicator</span></span>
      <button class="mr-btn mr-toggle" title="Hide toolbar" id="mr-toggle"><span class="material-symbols-outlined">edit_note</span></button>
      ${STAGING ? '<span style="background:#b8860b;color:white;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.05em;">STAGING</span>' : ''}
      ${quoteContextLabel() ? '<span title="Notes you leave here are scoped to this quote only" style="background:#4a5699;color:white;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:4px;"><span class="material-symbols-outlined" style="font-size:13px;">request_quote</span>' + escapeHtml(quoteContextLabel()) + '</span>' : ''}
      <button class="mr-btn" id="mr-add-pin" title="Drop a pin and write a note"><span class="material-symbols-outlined">push_pin</span> Pin a note</button>
      <button class="mr-btn" id="mr-add-shape" title="Draw a shape around an area"><span class="material-symbols-outlined">${shapeIcon(currentShape)}</span> Draw a note</button>
      <button class="mr-btn mr-secondary" id="mr-shape-picker" title="Pick a shape (rect / circle / cloud)" style="padding:8px 6px;"><span class="material-symbols-outlined" style="font-size:14px;">expand_more</span></button>
      <button class="mr-btn mr-secondary" id="mr-add-page-note" title="General note about this page"><span class="material-symbols-outlined">sticky_note_2</span> Note this page</button>
      <button class="mr-btn mr-secondary" id="mr-view-all" title="See every note across every page"><span class="material-symbols-outlined">checklist</span> All notes <span class="mr-count">${total}</span></button>
      <button class="mr-btn mr-secondary" id="mr-history" title="Browse past snapshots of the feedback set"><span class="material-symbols-outlined">history</span> History</button>
      <span class="mr-status ${statusCls}" title="Click to refresh"><span class="mr-dot"></span> ${statusText}${reviewer ? ' · ' + escapeHtml(reviewer) : ''}</span>
    `;
    document.getElementById('mr-add-pin').addEventListener('click', enterPinMode);
    document.getElementById('mr-add-shape').addEventListener('click', () => enterDrawMode(currentShape));
    document.getElementById('mr-shape-picker').addEventListener('click', e => { e.stopPropagation(); openShapePicker(e.currentTarget); });
    document.getElementById('mr-add-page-note').addEventListener('click', addPageNote);
    document.getElementById('mr-view-all').addEventListener('click', openDrawer);
    document.getElementById('mr-history').addEventListener('click', openHistoryDrawer);
    document.getElementById('mr-toggle').addEventListener('click', () => toolbarEl.classList.toggle('collapsed'));
    toolbarEl.querySelector('.mr-status').addEventListener('click', () => fetchAll());
    wireToolbarDrag();
    applySavedToolbarPos();
  }

  // -------------------------------------------------------------
  // Toolbar drag — position persisted to localStorage so reviewers
  // can park it wherever it doesn't cover the content they're noting.
  // -------------------------------------------------------------
  const TOOLBAR_POS_KEY = 'mr_toolbar_pos_v1';
  function applySavedToolbarPos() {
    if (!toolbarEl) return;
    const raw = localStorage.getItem(TOOLBAR_POS_KEY);
    if (!raw) return;
    try {
      const pos = JSON.parse(raw);
      if (typeof pos.left !== 'number' || typeof pos.top !== 'number') return;
      // Re-clamp in case the viewport shrank since the last save
      const r = toolbarEl.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth  - r.width  - 4);
      const maxTop  = Math.max(0, window.innerHeight - r.height - 4);
      const left = Math.max(4, Math.min(pos.left, maxLeft));
      const top  = Math.max(4, Math.min(pos.top,  maxTop));
      toolbarEl.style.left = left + 'px';
      toolbarEl.style.top  = top  + 'px';
      toolbarEl.style.right = 'auto';
      toolbarEl.style.bottom = 'auto';
    } catch (e) { /* corrupt — ignore */ }
  }
  function resetToolbarPos() {
    localStorage.removeItem(TOOLBAR_POS_KEY);
    toolbarEl.style.left = '';
    toolbarEl.style.top = '';
    toolbarEl.style.right = '';
    toolbarEl.style.bottom = '';
  }
  function wireToolbarDrag() {
    const handle = document.getElementById('mr-drag');
    if (!handle || handle._wired) return;
    handle._wired = true;
    handle.addEventListener('dblclick', resetToolbarPos);
    handle.addEventListener('mousedown', e => beginDrag(e.clientX, e.clientY, e));
    handle.addEventListener('touchstart', e => {
      const t = e.touches[0]; if (!t) return;
      beginDrag(t.clientX, t.clientY, e);
    }, { passive: false });
  }
  function beginDrag(startX, startY, evt) {
    evt.preventDefault();
    const r = toolbarEl.getBoundingClientRect();
    const offX = startX - r.left;
    const offY = startY - r.top;
    toolbarEl.classList.add('dragging');
    function move(cx, cy) {
      const maxLeft = Math.max(0, window.innerWidth  - r.width  - 4);
      const maxTop  = Math.max(0, window.innerHeight - r.height - 4);
      const left = Math.max(4, Math.min(cx - offX, maxLeft));
      const top  = Math.max(4, Math.min(cy - offY, maxTop));
      toolbarEl.style.left = left + 'px';
      toolbarEl.style.top  = top  + 'px';
      toolbarEl.style.right = 'auto';
      toolbarEl.style.bottom = 'auto';
    }
    function end() {
      toolbarEl.classList.remove('dragging');
      const r2 = toolbarEl.getBoundingClientRect();
      try {
        localStorage.setItem(TOOLBAR_POS_KEY, JSON.stringify({ left: Math.round(r2.left), top: Math.round(r2.top) }));
      } catch (e) {}
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend',  onTouchEnd);
    }
    function onMouseMove(e) { move(e.clientX, e.clientY); }
    function onMouseUp()    { end(); }
    function onTouchMove(e) { const t = e.touches[0]; if (t) { e.preventDefault(); move(t.clientX, t.clientY); } }
    function onTouchEnd()   { end(); }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend',  onTouchEnd);
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

    // Anchor to the click target so the pin moves with the layout, not the viewport.
    const target = e.target;
    const tRect = target.getBoundingClientRect();
    const offsetX = e.clientX - tRect.left;
    const offsetY = e.clientY - tRect.top;
    // Fractional offset within the element — survives viewport scaling.
    const offsetXFrac = tRect.width  > 0 ? offsetX / tRect.width  : 0;
    const offsetYFrac = tRect.height > 0 ? offsetY / tRect.height : 0;

    const pin = {
      id: uid(),
      page: pageId(),
      pageTitle: pageTitle(),
      type: 'pin',
      // Element-anchored position (the source of truth on render):
      selector: cssPathOf(target),
      offsetX, offsetY,           // legacy fallback (absolute px within element)
      offsetXFrac, offsetYFrac,   // scaling-safe (fraction of element size)
      // Absolute coords kept as fallback (used if the selector fails to resolve):
      x: e.pageX, y: e.pageY,
      anchor: nearestAnchor(target),
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
    // Number pins continuously within the (pins + shapes) sequence on this page
    const allHere = comments.filter(c => (c.type === 'pin' || c.type === 'shape') && c.page === pid);
    const pinsHere = allHere.filter(c => c.type === 'pin');
    pinsHere.forEach(pin => {
      const idx = allHere.indexOf(pin) + 1;
      const el = document.createElement('div');
      el.className = 'mr-pin' + (pin.author && pin.author === reviewer ? ' mine' : '');
      const pos = pinPosition(pin);
      el.style.left = pos.left + 'px';
      el.style.top  = pos.top + 'px';
      el.dataset.pinId = pin.id;
      el.textContent = idx;
      el.title = (pin.author ? pin.author + ': ' : '') + (pin.text || '(empty — click to add note)');
      el.addEventListener('click', e => { e.stopPropagation(); openPopoverForPin(pin.id); });
      document.body.appendChild(el);
    });
    // Render shapes too so callers don't need to remember both
    renderShapesForCurrentPage();
  }

  // Re-place existing pins without rebuilding (called on resize / scroll).
  function repositionPins() {
    const pid = pageId();
    document.querySelectorAll('.mr-pin').forEach(el => {
      const pin = comments.find(c => c.id === el.dataset.pinId);
      if (!pin || pin.page !== pid) return;
      const pos = pinPosition(pin);
      el.style.left = pos.left + 'px';
      el.style.top  = pos.top + 'px';
    });
    // Also reflow shapes (boxes + markers) on the same schedule
    repositionShapes();
  }

  // -------------------------------------------------------------
  // Shape annotations (rectangle / circle / cloud lasso)
  //   Stored as comments with type='shape'. Same selector + fractional
  //   offset model as pins (so they survive viewport scaling), with
  //   extra box/path fields for the actual outline.
  // -------------------------------------------------------------
  let currentShape = localStorage.getItem('mr_shape_v1') || 'rect';
  let drawModeActive = false;
  let drawBanner = null;
  let drawTarget = null;        // anchor element under mousedown
  let drawStart = null;         // { x, y } in client coords
  let drawCloudPts = null;      // for cloud: array of client coords
  let drawPreviewEl = null;

  function shapeIcon(t) {
    return t === 'circle' ? 'radio_button_unchecked'
         : t === 'cloud'  ? 'gesture'
         : 'check_box_outline_blank';
  }
  function shapeLabel(t) {
    return t === 'circle' ? 'Circle'
         : t === 'cloud'  ? 'Cloud (lasso)'
         : 'Rectangle';
  }

  function openShapePicker(anchorBtn) {
    document.getElementById('mr-shape-picker-pop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'mr-shape-picker';
    pop.id = 'mr-shape-picker-pop';
    const types = ['rect', 'circle', 'cloud'];
    pop.innerHTML = types.map(t => `
      <button data-shape="${t}" class="${t === currentShape ? 'active' : ''}">
        <span class="material-symbols-outlined">${shapeIcon(t)}</span> ${shapeLabel(t)}
      </button>
    `).join('');
    document.body.appendChild(pop);
    const r = anchorBtn.getBoundingClientRect();
    const popR = pop.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left + window.scrollX, document.documentElement.clientWidth - popR.width - 8)) + 'px';
    pop.style.top  = (r.top + window.scrollY - popR.height - 6) + 'px';
    pop.querySelectorAll('[data-shape]').forEach(b => b.addEventListener('click', e => {
      currentShape = b.getAttribute('data-shape');
      localStorage.setItem('mr_shape_v1', currentShape);
      pop.remove();
      renderToolbar();
      enterDrawMode(currentShape);
    }));
    setTimeout(() => document.addEventListener('click', outside, true), 0);
    function outside(e) {
      if (!pop.contains(e.target)) { document.removeEventListener('click', outside, true); pop.remove(); }
    }
  }

  function enterDrawMode(shape) {
    ensureReviewerName(() => {
      if (drawModeActive) return exitDrawMode();
      currentShape = shape || currentShape;
      drawModeActive = true;
      document.body.classList.add('mr-draw-mode');
      drawBanner = document.createElement('div');
      drawBanner.className = 'mr-banner';
      drawBanner.textContent = `${shapeLabel(currentShape)}: click + drag to draw · Esc to cancel`;
      document.body.appendChild(drawBanner);
      document.addEventListener('mousedown', drawDown, true);
      document.addEventListener('keydown', drawEsc);
    });
  }
  function exitDrawMode() {
    drawModeActive = false;
    document.body.classList.remove('mr-draw-mode');
    if (drawBanner) { drawBanner.remove(); drawBanner = null; }
    document.removeEventListener('mousedown', drawDown, true);
    document.removeEventListener('mousemove', drawMove, true);
    document.removeEventListener('mouseup', drawUp, true);
    document.removeEventListener('keydown', drawEsc);
    if (drawPreviewEl) { drawPreviewEl.remove(); drawPreviewEl = null; }
    drawStart = null; drawTarget = null; drawCloudPts = null;
  }
  function drawEsc(e) { if (e.key === 'Escape') exitDrawMode(); }

  function drawDown(e) {
    if (e.target.closest('.mr-toolbar') || e.target.closest('.mr-popover') || e.target.closest('.mr-banner') || e.target.closest('.mr-shape-picker')) return;
    e.preventDefault(); e.stopPropagation();
    drawTarget = e.target;
    drawStart = { x: e.clientX, y: e.clientY };
    drawCloudPts = currentShape === 'cloud' ? [[e.clientX, e.clientY]] : null;
    drawPreviewEl = document.createElement('div');
    drawPreviewEl.className = 'mr-draw-preview';
    drawPreviewEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><path class="mr-shape-stroke" d=""/></svg>';
    document.body.appendChild(drawPreviewEl);
    document.addEventListener('mousemove', drawMove, true);
    document.addEventListener('mouseup', drawUp, true);
  }
  function drawMove(e) {
    if (!drawStart) return;
    if (currentShape === 'cloud') {
      const last = drawCloudPts[drawCloudPts.length - 1];
      const dx = e.clientX - last[0], dy = e.clientY - last[1];
      if (dx*dx + dy*dy >= 16) drawCloudPts.push([e.clientX, e.clientY]);
    }
    updateDrawPreview(e.clientX, e.clientY);
  }
  function drawUp(e) {
    document.removeEventListener('mousemove', drawMove, true);
    document.removeEventListener('mouseup', drawUp, true);
    if (!drawStart) return exitDrawMode();
    const end = { x: e.clientX, y: e.clientY };
    let dragDist = Math.hypot(end.x - drawStart.x, end.y - drawStart.y);
    if (dragDist < 4 && currentShape !== 'cloud') {
      // Treat tiny drags as cancellations — user probably just clicked
      exitDrawMode();
      return;
    }
    commitShape(end);
    exitDrawMode();
  }

  function updateDrawPreview(curX, curY) {
    if (!drawPreviewEl || !drawStart) return;
    let minX, minY, maxX, maxY, d;
    if (currentShape === 'cloud') {
      const pts = drawCloudPts.concat([[curX, curY]]);
      minX = Math.min(...pts.map(p => p[0]));
      minY = Math.min(...pts.map(p => p[1]));
      maxX = Math.max(...pts.map(p => p[0]));
      maxY = Math.max(...pts.map(p => p[1]));
      const pad = 4;
      minX -= pad; minY -= pad; maxX += pad; maxY += pad;
      const local = pts.map(p => [p[0] - minX, p[1] - minY]);
      d = 'M ' + local.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ') + ' Z';
    } else {
      minX = Math.min(drawStart.x, curX);
      minY = Math.min(drawStart.y, curY);
      maxX = Math.max(drawStart.x, curX);
      maxY = Math.max(drawStart.y, curY);
      const w = maxX - minX, h = maxY - minY;
      if (currentShape === 'circle') {
        const cx = w / 2, cy = h / 2;
        d = `M ${cx.toFixed(1)},0 A ${cx.toFixed(1)},${cy.toFixed(1)} 0 1 0 ${cx.toFixed(1)},${(h).toFixed(1)} A ${cx.toFixed(1)},${cy.toFixed(1)} 0 1 0 ${cx.toFixed(1)},0 Z`;
      } else {
        d = `M 0,0 L ${w.toFixed(1)},0 L ${w.toFixed(1)},${h.toFixed(1)} L 0,${h.toFixed(1)} Z`;
      }
    }
    drawPreviewEl.style.left = (minX + window.scrollX) + 'px';
    drawPreviewEl.style.top  = (minY + window.scrollY) + 'px';
    drawPreviewEl.style.width  = (maxX - minX) + 'px';
    drawPreviewEl.style.height = (maxY - minY) + 'px';
    drawPreviewEl.querySelector('path').setAttribute('d', d);
  }

  function commitShape(end) {
    // Compute bbox in client coords + a points list (for cloud)
    let minX, minY, maxX, maxY, points;
    if (currentShape === 'cloud') {
      points = drawCloudPts.concat([drawCloudPts[0]]);  // close
      minX = Math.min(...points.map(p => p[0]));
      minY = Math.min(...points.map(p => p[1]));
      maxX = Math.max(...points.map(p => p[0]));
      maxY = Math.max(...points.map(p => p[1]));
    } else {
      minX = Math.min(drawStart.x, end.x);
      minY = Math.min(drawStart.y, end.y);
      maxX = Math.max(drawStart.x, end.x);
      maxY = Math.max(drawStart.y, end.y);
      points = null;
    }
    // Pick an anchor element that contains the entire bbox (so resize survives)
    let anchorEl = chooseShapeAnchor(drawTarget, minX, minY, maxX, maxY);
    const aRect = anchorEl.getBoundingClientRect();
    const aw = Math.max(1, aRect.width);
    const ah = Math.max(1, aRect.height);
    // Marker = drag-start point (where the user clicked first)
    const markerXFrac = (drawStart.x - aRect.left) / aw;
    const markerYFrac = (drawStart.y - aRect.top)  / ah;
    // Bounding box fractional within anchor
    const boxXFrac = (minX - aRect.left) / aw;
    const boxYFrac = (minY - aRect.top)  / ah;
    const boxWFrac = (maxX - minX) / aw;
    const boxHFrac = (maxY - minY) / ah;
    // Path points (cloud only) — fractional WITHIN the bbox
    const pathFrac = points ? points.map(p => [
      (p[0] - minX) / Math.max(1, maxX - minX),
      (p[1] - minY) / Math.max(1, maxY - minY)
    ]) : null;
    const shape = {
      id: uid(),
      page: pageId(),
      pageTitle: pageTitle(),
      type: 'shape',
      shapeType: currentShape,
      selector: cssPathOf(anchorEl),
      // Marker (pin-style) within anchor:
      offsetX: Math.round(markerXFrac * aw),
      offsetY: Math.round(markerYFrac * ah),
      offsetXFrac: markerXFrac,
      offsetYFrac: markerYFrac,
      // Shape bounding box within anchor:
      boxXFrac, boxYFrac, boxWFrac, boxHFrac,
      // Cloud path within bbox:
      pathFrac,
      // Absolute fallback (legacy):
      x: Math.round(drawStart.x + window.scrollX),
      y: Math.round(drawStart.y + window.scrollY),
      anchor: nearestAnchor(anchorEl),
      text: '',
      author: reviewer,
      createdAt: nowIso()
    };
    comments.push(shape);
    putComment(shape);
    renderShapesForCurrentPage();
    setTimeout(() => openPopoverForPin(shape.id), 50);
  }

  // Walk up from `start` to find the smallest ancestor whose bbox fully
  // contains the drawn region. Falls back to document.body.
  function chooseShapeAnchor(start, minX, minY, maxX, maxY) {
    let el = start;
    while (el && el !== document.body) {
      const r = el.getBoundingClientRect();
      if (r.left <= minX + 0.5 && r.top <= minY + 0.5 && r.right >= maxX - 0.5 && r.bottom >= maxY - 0.5) {
        return el;
      }
      el = el.parentElement;
    }
    return document.body;
  }

  // -------------------------------------------------------------
  // Shape rendering
  // -------------------------------------------------------------
  function renderShapesForCurrentPage() {
    document.querySelectorAll('.mr-shape, .mr-shape-marker').forEach(el => el.remove());
    const pid = pageId();
    const shapesHere = comments.filter(c => c.type === 'shape' && c.page === pid);
    // Re-numbering goes across all comments on this page (pins + shapes) to keep
    // the user's mental model "this is comment #5 on this page"
    const allHere = comments.filter(c => (c.type === 'pin' || c.type === 'shape') && c.page === pid);
    shapesHere.forEach(s => {
      const idx = allHere.indexOf(s) + 1;
      renderOneShape(s, idx);
    });
  }

  function shapeGeom(s) {
    const anchorEl = resolveAnchorElement(s);
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect();
      const left = r.left + s.boxXFrac * r.width + window.scrollX;
      const top  = r.top  + s.boxYFrac * r.height + window.scrollY;
      const w    = s.boxWFrac * r.width;
      const h    = s.boxHFrac * r.height;
      const mLeft = r.left + s.offsetXFrac * r.width + window.scrollX;
      const mTop  = r.top  + s.offsetYFrac * r.height + window.scrollY;
      return { left, top, w, h, mLeft, mTop };
    }
    // Fallback: cannot scale, use legacy abs coords if present
    return { left: s.x || 0, top: s.y || 0, w: 100, h: 50, mLeft: s.x || 0, mTop: s.y || 0 };
  }

  function renderOneShape(s, idx) {
    const g = shapeGeom(s);
    const mine = !s.author || s.author === reviewer;
    // Build SVG path
    let d;
    if (s.shapeType === 'cloud' && Array.isArray(s.pathFrac) && s.pathFrac.length > 1) {
      d = 'M ' + s.pathFrac.map(p => (p[0] * g.w).toFixed(1) + ',' + (p[1] * g.h).toFixed(1)).join(' L ') + ' Z';
    } else if (s.shapeType === 'circle') {
      const cx = g.w / 2, cy = g.h / 2;
      d = `M ${cx.toFixed(1)},0 A ${cx.toFixed(1)},${cy.toFixed(1)} 0 1 0 ${cx.toFixed(1)},${g.h.toFixed(1)} A ${cx.toFixed(1)},${cy.toFixed(1)} 0 1 0 ${cx.toFixed(1)},0 Z`;
    } else {
      d = `M 0,0 L ${g.w.toFixed(1)},0 L ${g.w.toFixed(1)},${g.h.toFixed(1)} L 0,${g.h.toFixed(1)} Z`;
    }
    const shapeEl = document.createElement('div');
    shapeEl.className = 'mr-shape' + (mine ? ' mine' : '');
    shapeEl.dataset.shapeId = s.id;
    shapeEl.style.left = g.left + 'px';
    shapeEl.style.top  = g.top + 'px';
    shapeEl.style.width  = g.w + 'px';
    shapeEl.style.height = g.h + 'px';
    shapeEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"><path class="mr-shape-stroke" d="${d}"/></svg>`;
    document.body.appendChild(shapeEl);

    const marker = document.createElement('div');
    marker.className = 'mr-shape-marker' + (mine ? ' mine' : '');
    marker.dataset.shapeId = s.id;
    marker.style.left = g.mLeft + 'px';
    marker.style.top  = g.mTop + 'px';
    marker.title = (s.author ? s.author + ': ' : '') + (s.text || '(empty — click to add note)');
    marker.innerHTML = `<span class="mr-sm-icon">${shapeIcon(s.shapeType)}</span><span class="mr-sm-num">${idx}</span>`;
    marker.addEventListener('mouseenter', () => shapeEl.classList.add('show'));
    marker.addEventListener('mouseleave', () => shapeEl.classList.remove('show'));
    marker.addEventListener('click', e => { e.stopPropagation(); openPopoverForPin(s.id); });
    document.body.appendChild(marker);
  }

  function repositionShapes() {
    const pid = pageId();
    document.querySelectorAll('.mr-shape').forEach(el => {
      const s = comments.find(c => c.id === el.dataset.shapeId);
      if (!s || s.page !== pid) return;
      const g = shapeGeom(s);
      el.style.left = g.left + 'px';
      el.style.top  = g.top + 'px';
      el.style.width  = g.w + 'px';
      el.style.height = g.h + 'px';
      const path = el.querySelector('path');
      if (path) {
        let d;
        if (s.shapeType === 'cloud' && Array.isArray(s.pathFrac) && s.pathFrac.length > 1) {
          d = 'M ' + s.pathFrac.map(p => (p[0] * g.w).toFixed(1) + ',' + (p[1] * g.h).toFixed(1)).join(' L ') + ' Z';
        } else if (s.shapeType === 'circle') {
          const cx = g.w / 2, cy = g.h / 2;
          d = `M ${cx.toFixed(1)},0 A ${cx.toFixed(1)},${cy.toFixed(1)} 0 1 0 ${cx.toFixed(1)},${g.h.toFixed(1)} A ${cx.toFixed(1)},${cy.toFixed(1)} 0 1 0 ${cx.toFixed(1)},0 Z`;
        } else {
          d = `M 0,0 L ${g.w.toFixed(1)},0 L ${g.w.toFixed(1)},${g.h.toFixed(1)} L 0,${g.h.toFixed(1)} Z`;
        }
        path.setAttribute('d', d);
      }
    });
    document.querySelectorAll('.mr-shape-marker').forEach(el => {
      const s = comments.find(c => c.id === el.dataset.shapeId);
      if (!s || s.page !== pid) return;
      const g = shapeGeom(s);
      el.style.left = g.mLeft + 'px';
      el.style.top  = g.mTop + 'px';
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
                  <span class="material-symbols-outlined" style="font-size:14px;color:#8a8880;" title="${c.type === 'shape' ? shapeLabel(c.shapeType) : 'Pin'}">${c.type === 'shape' ? shapeIcon(c.shapeType) : 'push_pin'}</span>
                  ${c.author ? '<span class="mr-c-author">' + escapeHtml(c.author) + '</span>' : ''}
                  <span class="mr-c-anchor">near <i>"${escapeHtml(((c.anchor && (c.anchor.text || c.anchor.tag)) || '').slice(0, 40))}"</i></span>
                  <div class="mr-c-actions">
                    <button title="Jump to note" data-jump-page="${c.page}" data-jump-id="${c.id}">↗</button>
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
      const storedPage = b.getAttribute('data-jump-page');
      sessionStorage.setItem('mr_jump_to', b.getAttribute('data-jump-id'));
      // Restore the quote context on the destination page so per-quote pageId
      // computes to the same key the pin was stored under.
      const qid = pageQuoteId(storedPage);
      if (qid) sessionStorage.setItem('mr_jump_quote', qid);
      else sessionStorage.removeItem('mr_jump_quote');
      location.href = pageHref(storedPage);
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
    // Restore quote context before computing any pageIds — the jump-to-pin
    // flow stashes the quote id in sessionStorage on its way out.
    const restoreQ = sessionStorage.getItem('mr_jump_quote');
    if (restoreQ) {
      sessionStorage.removeItem('mr_jump_quote');
      try { if (typeof MockState !== 'undefined' && MockState.setCurrentQuote) MockState.setCurrentQuote(restoreQ); } catch (e) {}
    }
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

    // When user navigates between hash-routed tabs (e.g. admin #products →
    // #services), pageId changes — re-render the pin set for the new context.
    window.addEventListener('hashchange', () => {
      closePopover();
      renderPinsForCurrentPage();
    });

    // Re-position pins when layout changes (resize, zoom, font load, layout shift).
    let resizeTimer;
    function scheduleReposition() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(repositionPins, 80);
    }
    window.addEventListener('resize', scheduleReposition);
    document.fonts?.ready?.then(repositionPins);
    if (window.ResizeObserver) {
      try { new ResizeObserver(scheduleReposition).observe(document.body); } catch (e) {}
    }
    // Catch dynamic content changes (e.g. tab switches inside admin/settings)
    if (window.MutationObserver) {
      const mo = new MutationObserver(muts => {
        // Skip mutations our own pin/toolbar/drawer triggered
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.classList && (n.classList.contains('mr-pin') || n.classList.contains('mr-shape') || n.classList.contains('mr-shape-marker') || n.classList.contains('mr-shape-picker') || n.classList.contains('mr-draw-preview') || n.classList.contains('mr-toolbar') || n.classList.contains('mr-drawer') || n.classList.contains('mr-popover'))) return;
          }
        }
        scheduleReposition();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

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

  // -------------------------------------------------------------
  // Notes revisions — snapshot + history drawer
  // -------------------------------------------------------------
  async function fetchRevisions() {
    try {
      const r = await fetch(API + '/revisions', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      return Array.isArray(j.revisions) ? j.revisions : [];
    } catch (e) { console.warn('revisions fetch failed:', e); return null; }
  }
  async function fetchRevision(id) {
    try {
      const r = await fetch(API + '/revisions/' + encodeURIComponent(id), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { console.warn('revision fetch failed:', e); return null; }
  }
  async function snapshotNow(label) {
    inFlight++; renderToolbar();
    try {
      const r = await fetch(API + '/revisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label || '', createdBy: reviewer || '' })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { console.warn('snapshot failed:', e); return null; }
    finally { inFlight--; renderToolbar(); }
  }
  async function deleteRevision(id) {
    try {
      const r = await fetch(API + '/revisions/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return true;
    } catch (e) { console.warn('revision delete failed:', e); return false; }
  }

  async function openHistoryDrawer() {
    closeDrawer();
    closeHistoryDrawer();
    const bg = document.createElement('div');
    bg.className = 'mr-drawer-bg open';
    bg.id = 'mr-hist-bg';
    bg.addEventListener('click', closeHistoryDrawer);
    document.body.appendChild(bg);

    const drawer = document.createElement('div');
    drawer.className = 'mr-drawer';
    drawer.id = 'mr-hist-drawer';
    document.body.appendChild(drawer);
    drawer.innerHTML = `
      <div class="mr-dh">
        <span class="material-symbols-outlined" style="color:#c0553a;">history</span>
        <h3>Notes history</h3>
        <button id="mr-hist-close" style="background:none;border:none;color:#8a8880;cursor:pointer;font-size:20px;padding:0 6px;">×</button>
      </div>
      <div class="mr-db" id="mr-hist-body">
        <div class="mr-empty">Loading…</div>
      </div>
      <div class="mr-df">
        <span style="font-size:12px;color:#8a8880;flex:1;">Snapshots freeze the current notes set so you can browse past versions of the feedback as the mockup evolves.</span>
        <button class="mr-btn mr-success" id="mr-hist-snap"><span class="material-symbols-outlined">camera_alt</span> Snapshot now</button>
      </div>
    `;
    drawer.classList.add('open');
    document.getElementById('mr-hist-close').addEventListener('click', closeHistoryDrawer);
    document.getElementById('mr-hist-snap').addEventListener('click', async () => {
      ensureReviewerName(async () => {
        const label = prompt('Label for this snapshot:', `${(reviewer || 'reviewer')} — ${new Date().toLocaleString('en-AU', { day:'numeric', month:'short', hour:'numeric', minute:'2-digit', hour12:true })}`);
        if (label === null) return;
        const r = await snapshotNow(label);
        if (r && r.ok) { /* refresh list */ renderHistoryList(); }
      });
    });
    renderHistoryList();
  }
  function closeHistoryDrawer() {
    document.getElementById('mr-hist-drawer')?.remove();
    document.getElementById('mr-hist-bg')?.remove();
    document.getElementById('mr-rev-view-bg')?.remove();
    document.getElementById('mr-rev-view-drawer')?.remove();
  }

  async function renderHistoryList() {
    const body = document.getElementById('mr-hist-body');
    if (!body) return;
    body.innerHTML = '<div class="mr-empty">Loading…</div>';
    const revs = await fetchRevisions();
    if (!revs) { body.innerHTML = '<div class="mr-empty" style="color:#c0553a;">Failed to load history. Click status to retry.</div>'; return; }
    if (revs.length === 0) {
      body.innerHTML = `<div class="mr-empty"><span class="material-symbols-outlined" style="font-size:32px;">history_toggle_off</span><div style="margin-top:6px;">No snapshots yet. Click <b>Snapshot now</b> to freeze the current feedback set as v1.</div></div>`;
      return;
    }
    body.innerHTML = revs.map(r => `
      <div class="mr-rev-row">
        <div class="mr-rev-meta">
          <div class="mr-rev-label">${escapeHtml(r.label || '(unlabelled)')}</div>
          <div class="mr-rev-sub">${dateLong(r.created_at)}${r.created_by ? ' · by <b>' + escapeHtml(r.created_by) + '</b>' : ''} · ${r.comment_count} pin${r.comment_count === 1 ? '' : 's'}${r.page_note_count ? ', ' + r.page_note_count + ' page note' + (r.page_note_count === 1 ? '' : 's') : ''}</div>
        </div>
        <button class="mr-btn mr-secondary mr-btn-sm" data-rev-view="${r.id}"><span class="material-symbols-outlined">visibility</span> View</button>
        <button class="mr-btn mr-secondary mr-btn-sm mr-rev-del" data-rev-del="${r.id}" title="Delete this snapshot"><span class="material-symbols-outlined">delete_outline</span></button>
      </div>
    `).join('');
    body.querySelectorAll('[data-rev-view]').forEach(b => b.addEventListener('click', () => openRevisionViewer(parseInt(b.getAttribute('data-rev-view'), 10))));
    body.querySelectorAll('[data-rev-del]').forEach(b => b.addEventListener('click', async () => {
      const id = b.getAttribute('data-rev-del');
      if (!confirm('Delete this snapshot? (The current live notes are unaffected.)')) return;
      await deleteRevision(id);
      renderHistoryList();
    }));
  }

  async function openRevisionViewer(id) {
    document.getElementById('mr-rev-view-bg')?.remove();
    document.getElementById('mr-rev-view-drawer')?.remove();
    const bg = document.createElement('div');
    bg.className = 'mr-drawer-bg open';
    bg.id = 'mr-rev-view-bg';
    bg.style.zIndex = '9993';
    bg.addEventListener('click', () => { bg.remove(); document.getElementById('mr-rev-view-drawer')?.remove(); });
    document.body.appendChild(bg);
    const drawer = document.createElement('div');
    drawer.className = 'mr-drawer';
    drawer.id = 'mr-rev-view-drawer';
    drawer.style.zIndex = '9994';
    drawer.style.width = '540px';
    document.body.appendChild(drawer);
    drawer.innerHTML = `<div class="mr-dh"><span class="material-symbols-outlined" style="color:#4a5699;">history</span><h3>Loading snapshot…</h3><button id="mr-rev-close" style="background:none;border:none;color:#8a8880;cursor:pointer;font-size:20px;padding:0 6px;">×</button></div><div class="mr-db"><div class="mr-empty">Loading…</div></div>`;
    requestAnimationFrame(() => drawer.classList.add('open'));
    document.getElementById('mr-rev-close').addEventListener('click', () => { bg.remove(); drawer.remove(); });

    const rev = await fetchRevision(id);
    if (!rev) { drawer.querySelector('.mr-db').innerHTML = '<div class="mr-empty" style="color:#c0553a;">Failed to load this snapshot.</div>'; return; }

    const pages = {};
    (rev.comments || []).forEach(c => {
      pages[c.page] = pages[c.page] || { page: c.page, pageTitle: c.pageTitle, comments: [] };
      pages[c.page].comments.push(c);
    });
    Object.entries(rev.page_notes || rev.pageNotes || {}).forEach(([pid, n]) => {
      pages[pid] = pages[pid] || { page: pid, pageTitle: n.pageTitle, comments: [] };
    });
    const pageList = Object.values(pages).sort((a, b) => a.page.localeCompare(b.page));
    const pageNotesObj = rev.page_notes || rev.pageNotes || {};

    drawer.innerHTML = `
      <div class="mr-dh">
        <span class="material-symbols-outlined" style="color:#4a5699;">history</span>
        <h3>${escapeHtml(rev.label || '(unlabelled snapshot)')}</h3>
        <button id="mr-rev-close" style="background:none;border:none;color:#8a8880;cursor:pointer;font-size:20px;padding:0 6px;">×</button>
      </div>
      <div class="mr-db">
        <div style="margin-bottom:12px;font-size:12px;color:#5c5b56;">
          ${rev.created_by ? 'By <b>' + escapeHtml(rev.created_by) + '</b> · ' : ''}${dateLong(rev.created_at)} · ${rev.comment_count} pin${rev.comment_count === 1 ? '' : 's'}, ${rev.page_note_count} page note${rev.page_note_count === 1 ? '' : 's'}
          <br><span style="color:#8a8880;">Read-only view — the live notes set is unchanged.</span>
        </div>
        ${pageList.length === 0 ? `<div class="mr-empty">No notes in this snapshot.</div>` : ''}
        ${pageList.map(pg => `
          <div class="mr-pg">
            <div class="mr-pg-h"><span style="color:#5c5b56;">${escapeHtml(pg.pageTitle || pg.page)}</span> <span style="font-weight:400;color:#a09e97;">(${pg.page})</span></div>
            ${pageNotesObj[pg.page] ? `
              <div class="mr-c">
                <div class="mr-c-h">
                  <span style="background:#4a5699;color:white;padding:1px 7px;border-radius:10px;font-weight:600;font-size:10px;">PAGE</span>
                  ${pageNotesObj[pg.page].author ? '<span class="mr-c-author">' + escapeHtml(pageNotesObj[pg.page].author) + '</span>' : ''}
                </div>
                <div class="mr-c-text">${escapeHtml(pageNotesObj[pg.page].text || '')}</div>
              </div>` : ''}
            ${pg.comments.map((c, i) => `
              <div class="mr-c">
                <div class="mr-c-h">
                  <span class="mr-c-num">#${i + 1}</span>
                  <span class="material-symbols-outlined" style="font-size:14px;color:#8a8880;" title="${c.type === 'shape' ? shapeLabel(c.shapeType) : 'Pin'}">${c.type === 'shape' ? shapeIcon(c.shapeType) : 'push_pin'}</span>
                  ${c.author ? '<span class="mr-c-author">' + escapeHtml(c.author) + '</span>' : ''}
                  <span class="mr-c-anchor">near <i>"${escapeHtml(((c.anchor && c.anchor.text) || (c.anchor && c.anchor.tag) || '').slice(0, 40))}"</i></span>
                </div>
                <div class="mr-c-text">${escapeHtml(c.text || '(empty)')}</div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;
    document.getElementById('mr-rev-close').addEventListener('click', () => { bg.remove(); drawer.remove(); });
  }

  // -------------------------------------------------------------
  return {
    start,
    snapshotNow,                            // programmatic snapshot (e.g. from a deploy hook)
    openHistory: openHistoryDrawer,
    _state: () => ({ comments, pageNotes, reviewer })
  };
})();

document.addEventListener('DOMContentLoaded', () => window.MockReview.start());
