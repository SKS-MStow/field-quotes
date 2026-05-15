/* ================================================================
   field-quotes mockups — shared UI helpers
   Formatting, sidebar active-state, simple toast, page hand-off.
   ================================================================ */

window.MockUI = (function () {

  // -------------------------------------------------------------
  // Formatters
  // -------------------------------------------------------------
  const moneyFmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
  const moneyFmtCents = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
  const dateFmt = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

  function fmtMoney(n) { return moneyFmt.format(n || 0); }
  function fmtMoneyCents(n) { return moneyFmtCents.format(n || 0); }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return dateFmt.format(d);
  }
  function fmtHours(h) {
    if (!h) return '0 hr';
    return (Math.round(h * 10) / 10) + ' hr';
  }
  function fmtPct(p) {
    if (p === null || p === undefined || isNaN(p)) return '—';
    return (Math.round(p * 10) / 10) + '%';
  }

  // -------------------------------------------------------------
  // Sidebar — sets the active nav item based on the data-page on <body>
  // -------------------------------------------------------------
  function highlightSidebar() {
    const page = document.body.getAttribute('data-page');
    if (!page) return;
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-page') === page);
    });
    document.querySelectorAll('.bottom-tab').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-page') === page);
    });
  }

  // -------------------------------------------------------------
  // Toast
  // -------------------------------------------------------------
  function toast(message, kind) {
    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts';
      host.className = 'toast-container';
      host.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.style.cssText = `
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-left: 3px solid ${kind === 'error' ? 'var(--status-danger)' : kind === 'warn' ? 'var(--status-warning)' : 'var(--status-success)'};
      padding: 10px 14px;
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      font-size: 13px;
      color: var(--text-primary);
      min-width: 220px;
      max-width: 380px;
      pointer-events: auto;
      opacity: 0;
      transform: translateY(-8px);
      transition: all 0.18s ease;
    `;
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => el.remove(), 200);
    }, 2400);
  }

  // -------------------------------------------------------------
  // Mobile sidebar toggle (mirrors management app behaviour)
  // -------------------------------------------------------------
  function setupMobileNav() {
    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!hamburger || !sidebar || !overlay) return;
    const toggle = (show) => {
      sidebar.classList.toggle('open', show);
      overlay.classList.toggle('active', show);
    };
    hamburger.addEventListener('click', () => toggle(!sidebar.classList.contains('open')));
    overlay.addEventListener('click', () => toggle(false));
  }

  // -------------------------------------------------------------
  // Status badge class for a quote status
  // -------------------------------------------------------------
  function statusBadge(status) {
    const map = {
      draft:    { cls: 'badge badge-muted',   label: 'Draft' },
      issued:   { cls: 'badge badge-info',    label: 'Issued' },
      accepted: { cls: 'badge badge-success', label: 'Accepted' },
      declined: { cls: 'badge badge-danger',  label: 'Declined' },
      expired:  { cls: 'badge badge-warning', label: 'Expired' },
      revised:  { cls: 'badge badge-accent',  label: 'Revised' }
    };
    return map[status] || map.draft;
  }

  // -------------------------------------------------------------
  // Confirm helper
  // -------------------------------------------------------------
  function confirmAction(msg, onYes) {
    if (window.confirm(msg)) onYes();
  }

  // -------------------------------------------------------------
  // Init — call on every page after DOMContentLoaded
  // -------------------------------------------------------------
  function init() {
    highlightSidebar();
    setupMobileNav();
  }

  return {
    fmtMoney, fmtMoneyCents, fmtDate, fmtHours, fmtPct,
    statusBadge, toast, confirmAction, init
  };
})();

document.addEventListener('DOMContentLoaded', () => window.MockUI.init());
