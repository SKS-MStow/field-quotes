/* ================================================================
   field-quotes mockups — page shell renderer
   Each mockup page calls MockShell.mount({...}) to get the
   sidebar, mobile header, topbar, content slot, and bottom tabs
   without repeating 100+ lines of HTML.
   ================================================================ */

window.MockShell = (function () {

  function navItem({ page, href, icon, label, badge }) {
    return `
      <a class="nav-item" data-page="${page}" href="${href}">
        <span class="material-symbols-outlined">${icon}</span> ${label}
        ${badge ? `<span class="nav-badge">${badge}</span>` : ''}
      </a>`;
  }

  function sidebarHtml(user) {
    return `
      <div class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <h1>SKS Quotes</h1>
          <span id="sidebar-user">${user || 'Mark Stowell · Estimator'}</span>
        </div>

        <div class="nav-group-label">Overview</div>
        ${navItem({ page: 'dashboard', href: '01-quote-list.html',  icon: 'home',          label: 'My Dashboard' })}

        <div class="nav-group-label">Quotes</div>
        ${navItem({ page: 'quotes',    href: '01-quote-list.html',  icon: 'request_quote', label: 'All Quotes' })}
        ${navItem({ page: 'new-quote', href: '02-mode-select.html', icon: 'add_circle',    label: 'New Quote' })}
        ${navItem({ page: 'drafts',    href: '01-quote-list.html?filter=draft',   icon: 'edit_note', label: 'Drafts' })}
        ${navItem({ page: 'issued',    href: '01-quote-list.html?filter=issued',  icon: 'send',      label: 'Issued' })}
        ${navItem({ page: 'accepted',  href: '01-quote-list.html?filter=accepted',icon: 'check_circle', label: 'Accepted' })}

        <div class="nav-group-label">Catalogue</div>
        ${navItem({ page: 'admin-products', href: '07-admin.html#products',   icon: 'inventory_2', label: 'Products' })}
        ${navItem({ page: 'admin-suppliers',href: '07-admin.html#suppliers',  icon: 'store',       label: 'Suppliers' })}
        ${navItem({ page: 'admin-cats',     href: '07-admin.html#categories', icon: 'category',    label: 'Categories' })}
        ${navItem({ page: 'admin-pkgs',     href: '07-admin.html#packages',   icon: 'layers',      label: 'Packages' })}

        <div class="nav-group-label">Library</div>
        ${navItem({ page: 'admin-services',  href: '07-admin.html#services',   icon: 'build', label: 'Services' })}
        ${navItem({ page: 'admin-labour',    href: '07-admin.html#labour',     icon: 'engineering', label: 'Labour Defaults' })}
        ${navItem({ page: 'admin-exclusions',href: '07-admin.html#exclusions', icon: 'rule',  label: 'Exclusions' })}
        ${navItem({ page: 'admin-terms',     href: '07-admin.html#terms',      icon: 'gavel', label: 'Terms' })}

        <div class="sidebar-bottom">
          ${navItem({ page: 'settings', href: '#', icon: 'tune', label: 'Settings' })}
        </div>
      </div>

      <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;
  }

  function mobileHeaderHtml(title) {
    return `
      <div class="mobile-header" id="mobile-header">
        <button class="mobile-hamburger" id="hamburger-btn"><span class="material-symbols-outlined">menu</span></button>
        <span class="mobile-title">${title || 'SKS Quotes'}</span>
      </div>`;
  }

  function topbarHtml({ title, subtitle, actionsHtml }) {
    return `
      <div class="topbar">
        <div>
          <h2>${title || ''}</h2>
          ${subtitle ? `<div class="page-label">${subtitle}</div>` : ''}
        </div>
        <div class="actions">${actionsHtml || ''}</div>
      </div>`;
  }

  function bottomTabsHtml(activePage) {
    const items = [
      { page: 'quotes',    href: '01-quote-list.html',  icon: 'request_quote', label: 'Quotes' },
      { page: 'new-quote', href: '02-mode-select.html', icon: 'add_circle',    label: 'New' },
      { page: 'admin-products', href: '07-admin.html#products', icon: 'inventory_2', label: 'Catalogue' },
      { page: 'settings',  href: '#',                   icon: 'tune',          label: 'Settings' }
    ];
    return `
      <div class="bottom-tabs" id="bottom-tabs">
        ${items.map(t => `<a class="bottom-tab${activePage === t.page ? ' active' : ''}" data-page="${t.page}" href="${t.href}">
          <span class="material-symbols-outlined">${t.icon}</span><span>${t.label}</span>
        </a>`).join('')}
      </div>`;
  }

  /**
   * Wrap the existing <main id="content"> contents in the app-frame shell.
   * Page HTML before mount looks like:
   *   <body data-page="quotes">
   *     <main id="content"> ...page content... </main>
   *     <script>MockShell.mount({title, subtitle, actionsHtml})</script>
   */
  function mount({ title, subtitle, actionsHtml, user } = {}) {
    const body = document.body;
    const page = body.getAttribute('data-page') || '';
    const content = document.getElementById('content');
    const contentHtml = content ? content.outerHTML : '<main id="content" class="content"></main>';

    // Make sure the content div has the .content class so theme padding applies
    if (content && !content.classList.contains('content')) content.classList.add('content');

    body.innerHTML = `
      <div class="app-frame">
        ${sidebarHtml(user)}
        <div class="main">
          ${mobileHeaderHtml(title)}
          ${topbarHtml({ title, subtitle, actionsHtml })}
          ${contentHtml}
        </div>
        ${bottomTabsHtml(page)}
      </div>
    `;

    // Wire mobile sidebar toggle
    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (hamburger && sidebar && overlay) {
      const toggle = (show) => {
        sidebar.classList.toggle('open', show);
        overlay.classList.toggle('active', show);
      };
      hamburger.addEventListener('click', () => toggle(!sidebar.classList.contains('open')));
      overlay.addEventListener('click', () => toggle(false));
    }

    // Highlight active sidebar item by data-page
    document.querySelectorAll('.sidebar .nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-page') === page);
    });
  }

  return { mount };
})();
