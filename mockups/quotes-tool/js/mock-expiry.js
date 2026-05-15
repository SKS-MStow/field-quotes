/* ================================================================
   field-quotes mockups — expiry countdown banner
   Deployed mockups self-disable after the configured deadline so
   nothing stays "live forever" by accident. To extend the demo:
   edit MOCKUP_EXPIRY_ISO below and redeploy.
   ================================================================ */

window.MockExpiry = (function () {

  // Configured expiry — default 14 days from initial deploy.
  // Change this and redeploy to extend the demo window.
  const MOCKUP_EXPIRY_ISO = '2026-05-28T18:00:00+09:30';   // 6pm ACST

  function fmtRemaining(ms) {
    if (ms <= 0) return 'expired';
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin / 60) % 24);
    const mins = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  function fmtAbsolute(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function injectStyles() {
    if (document.getElementById('mock-expiry-styles')) return;
    const s = document.createElement('style');
    s.id = 'mock-expiry-styles';
    s.textContent = `
      .mock-expiry-banner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 9998;
        background: linear-gradient(90deg, #2d2d2a 0%, #4a3f3a 100%);
        color: #f7f5f0;
        font-family: 'Inter', -apple-system, sans-serif;
        font-size: 12px;
        padding: 6px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.15);
      }
      .mock-expiry-banner .pip {
        width: 8px; height: 8px; border-radius: 50%;
        background: #c0553a;
        box-shadow: 0 0 0 3px rgba(192,85,58,0.25);
        flex-shrink: 0;
      }
      .mock-expiry-banner b { font-weight: 700; }
      .mock-expiry-banner .label { opacity: 0.85; }
      .mock-expiry-banner .countdown { font-family: 'IBM Plex Sans', sans-serif; font-weight: 600; font-variant-numeric: tabular-nums; color: #fff; }
      .mock-expiry-banner .when { opacity: 0.7; font-size: 11px; }
      .mock-expiry-banner .grow { flex: 1; }
      .mock-expiry-banner a { color: #fff; opacity: 0.85; text-decoration: underline; cursor: pointer; }
      .mock-expiry-banner a:hover { opacity: 1; }
      .mock-expiry-banner .x {
        background: none; border: none; color: rgba(255,255,255,0.8); cursor: pointer;
        font-size: 16px; line-height: 1; padding: 2px 6px; border-radius: 4px;
      }
      .mock-expiry-banner .x:hover { background: rgba(255,255,255,0.15); color: #fff; }
      body.has-expiry-banner .app-frame { padding-top: 32px; }
      @media (max-width: 768px) {
        body.has-expiry-banner .sidebar.open { top: 32px; }
      }
      @media (max-width: 600px) {
        .mock-expiry-banner { font-size: 11px; padding: 5px 10px; gap: 8px; }
        .mock-expiry-banner .when { display: none; }
      }

      /* Expired overlay */
      .mock-expired-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(247, 245, 240, 0.96);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        font-family: 'Inter', -apple-system, sans-serif;
      }
      .mock-expired-overlay .card {
        max-width: 440px;
        background: white;
        border: 1px solid #e8e6e1;
        border-radius: 12px;
        padding: 32px;
        text-align: center;
        box-shadow: 0 12px 40px rgba(0,0,0,0.08);
      }
      .mock-expired-overlay .icon {
        width: 64px; height: 64px; border-radius: 50%;
        background: #ffebee; color: #c0553a;
        display: inline-flex; align-items: center; justify-content: center;
        margin-bottom: 16px;
      }
      .mock-expired-overlay .icon .material-symbols-outlined { font-size: 32px; }
      .mock-expired-overlay h2 { font-family: 'IBM Plex Sans', sans-serif; font-size: 20px; font-weight: 700; color: #2d2d2a; margin-bottom: 6px; }
      .mock-expired-overlay p { color: #5c5b56; font-size: 14px; line-height: 1.55; margin-bottom: 16px; }
      .mock-expired-overlay .meta { font-size: 12px; color: #8a8880; }
    `;
    document.head.appendChild(s);
  }

  function showExpired() {
    document.body.style.overflow = 'hidden';
    const div = document.createElement('div');
    div.className = 'mock-expired-overlay';
    div.innerHTML = `
      <div class="card">
        <div class="icon"><span class="material-symbols-outlined">history_toggle_off</span></div>
        <h2>Mockup demo has expired</h2>
        <p>This is a time-limited preview of the SKS quoting tool. The demo window closed on <b>${fmtAbsolute(MOCKUP_EXPIRY_ISO)}</b>.</p>
        <p>To re-enable the demo or get a fresh preview window, ask Mark.</p>
        <div class="meta">Source: github.com/SKS-MStow/field-quotes</div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function renderBanner() {
    const expiry = new Date(MOCKUP_EXPIRY_ISO).getTime();
    const now = Date.now();
    const remaining = expiry - now;

    if (remaining <= 0) {
      showExpired();
      return;
    }

    let banner = document.getElementById('mock-expiry-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'mock-expiry-banner';
      banner.className = 'mock-expiry-banner';
      banner.innerHTML = `
        <span class="pip"></span>
        <span class="label">SKS Quotes — interactive mockup demo</span>
        <span class="countdown" id="mock-expiry-countdown"></span>
        <span class="when" id="mock-expiry-when"></span>
        <span class="grow"></span>
        <a href="index.html" title="Go to mockup index">All screens</a>
        <button class="x" id="mock-expiry-x" title="Dismiss banner (it'll be back next page)">×</button>
      `;
      document.body.insertBefore(banner, document.body.firstChild);
      document.body.classList.add('has-expiry-banner');

      document.getElementById('mock-expiry-x').addEventListener('click', () => {
        banner.style.display = 'none';
        document.body.classList.remove('has-expiry-banner');
      });
    }

    document.getElementById('mock-expiry-countdown').textContent =
      `expires in ${fmtRemaining(remaining)}`;
    document.getElementById('mock-expiry-when').textContent =
      `· ${fmtAbsolute(MOCKUP_EXPIRY_ISO)}`;
  }

  function start() {
    injectStyles();
    renderBanner();
    // Re-check every minute. If expiry hits, show overlay.
    setInterval(renderBanner, 60 * 1000);
  }

  return { start, expiry: MOCKUP_EXPIRY_ISO };
})();

document.addEventListener('DOMContentLoaded', () => window.MockExpiry.start());
