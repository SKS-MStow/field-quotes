/* ================================================================
   GridTable — shared widget helper for .grid-table tables
   ----------------------------------------------------------------
   Wires column-resizer handles on tables marked with `.grid-table`
   and (optionally) persists user-chosen column widths in
   sessionStorage so they survive re-renders, accordion toggles,
   and page revisits within the same tab.

   Usage:
     <script src="../_shared/tables/grid-table.js"></script>
     <table class="grid-table">
       <thead><tr>
         <th data-col-key="brand" style="width:90px;">Brand<span class="col-resizer"></span></th>
         <th data-col-key="desc">Description<span class="col-resizer"></span></th>
         <th class="right" data-col-key="cost" style="width:80px;">Cost<span class="col-resizer"></span></th>
       </tr></thead>
       <tbody>...</tbody>
     </table>

     // after the table is in the DOM:
     GridTable.wire(tableEl, 'fq_quotes_equipment_' + quoteId);

   The second argument (persistKey) is optional. Without it, widths
   reset on every re-render.

   IMPORTANT: keep ONE column without an explicit width so it acts as
   the flex column — when the user drags a neighbour, the flex column
   shrinks/grows to compensate and the rest stay put. With every
   column fixed, dragging one column past the table's width forces
   neighbours to shrink (the classic table-layout: fixed surprise).
   ================================================================ */

window.GridTable = (function () {

  function loadWidths(key) {
    if (!key) return {};
    try { return JSON.parse(sessionStorage.getItem(key) || '{}'); }
    catch (e) { return {}; }
  }
  function saveWidths(key, all) {
    if (!key) return;
    try { sessionStorage.setItem(key, JSON.stringify(all)); }
    catch (e) {}
  }

  function applyPersistedWidths(table, key) {
    const all = loadWidths(key);
    table.querySelectorAll('th[data-col-key]').forEach(th => {
      const k = th.getAttribute('data-col-key');
      if (all[k]) th.style.width = all[k] + 'px';
    });
  }

  function wireResizers(table, key) {
    table.querySelectorAll('th .col-resizer').forEach(handle => {
      // Avoid double-wiring if called twice on the same table
      if (handle.dataset.gtWired === '1') return;
      handle.dataset.gtWired = '1';

      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        const th = handle.parentElement;
        const colKey = th.getAttribute('data-col-key');
        const startX = e.clientX;
        const startW = th.offsetWidth;
        document.body.classList.add('is-col-resizing');

        const move = ev => {
          const w = Math.max(40, startW + (ev.clientX - startX));
          th.style.width = w + 'px';
        };
        const up = () => {
          document.body.classList.remove('is-col-resizing');
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          if (key && colKey) {
            const all = loadWidths(key);
            all[colKey] = th.offsetWidth;
            saveWidths(key, all);
          }
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });
  }

  /**
   * Wire a .grid-table for col-resizing + persistence.
   * @param {HTMLTableElement} table
   * @param {string} [persistKey] sessionStorage key (omit for non-persistent)
   */
  function wire(table, persistKey) {
    if (!table) return;
    if (persistKey) applyPersistedWidths(table, persistKey);
    wireResizers(table, persistKey);
  }

  /** Wire every .grid-table currently in the DOM that isn't yet wired. */
  function wireAll(scope, persistKey) {
    (scope || document).querySelectorAll('table.grid-table').forEach(t => wire(t, persistKey));
  }

  // Auto-wire any grid-tables in the page once it's ready. Tables that need a
  // per-instance persistKey (e.g. equipment per quote) should call
  // GridTable.wire(table, key) explicitly — that'll just overwrite the
  // auto-wired listeners thanks to the dataset.gtWired guard.
  function autoWireOnReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => wireAll());
    } else {
      wireAll();
    }
  }
  autoWireOnReady();

  return { wire, wireAll };
})();
