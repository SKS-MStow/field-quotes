/* ================================================================
   GridTable — shared widget helper for .grid-table tables
   ----------------------------------------------------------------
   Wires column-resizer handles AND column-drag reordering on
   tables marked with `.grid-table`, with per-user view persistence
   (column widths + ordering) so each reviewer sees their own layout.

   Usage:
     <script src="../_shared/tables/grid-table.js"></script>
     <table class="grid-table" data-grid-key="quote-list-main">
       <thead><tr>
         <th data-col-key="brand" style="width:90px;">Brand<span class="col-resizer"></span></th>
         <th data-col-key="desc">Description<span class="col-resizer"></span></th>   <!-- no width -> flex col -->
         <th class="right" data-col-key="cost" style="width:80px;">Cost<span class="col-resizer"></span></th>
       </tr></thead>
       <tbody>...</tbody>
     </table>

     // imperative (e.g. per-quote key built dynamically):
     GridTable.wire(tableEl, 'equipment-' + quoteId);

   Persistence
     - Tables with `data-grid-key` (or wired imperatively with a key)
       persist their width + order under that key, scoped to the
       current user (reviewer name on the mockup, real user in the
       main app).
     - Override `GridTable.storage` to swap localStorage for an API
       call when wiring up the real backend — see bottom of file.

   IMPORTANT: keep ONE column without an explicit width so it acts as
   the flex column — when the user drags a neighbour, the flex column
   shrinks/grows to compensate and the rest stay put.
   ================================================================ */

window.GridTable = (function () {

  // -----------------------------------------------------------------
  // Storage (swap-out point for the main app)
  //
  //   In the mockup we persist in localStorage scoped by reviewer
  //   name so each reviewer has their own table view. In the real
  //   app, override these two functions to hit an API:
  //
  //     GridTable.storage = {
  //       async load(scope, key) { return fetch(...).then(r=>r.json()); },
  //       async save(scope, key, view) { fetch(..., {method:'PUT', body:JSON.stringify(view)}); }
  //     };
  //
  //   (load can stay synchronous if the real app pre-fetches views.)
  // -----------------------------------------------------------------
  const STORE_PREFIX = 'fq_gridtable_view_';
  function defaultScope() {
    // Mockup: reviewer name (set on first review-tool sign-in). Real app
    // would use the authenticated user id.
    try {
      return localStorage.getItem('mr_reviewer_v1')
          || localStorage.getItem('mr_reviewer_v1_staging')
          || 'anon';
    } catch (e) { return 'anon'; }
  }
  const storage = {
    load(scope, key) {
      try { return JSON.parse(localStorage.getItem(STORE_PREFIX + scope + '__' + key) || '{}'); }
      catch (e) { return {}; }
    },
    save(scope, key, view) {
      try { localStorage.setItem(STORE_PREFIX + scope + '__' + key, JSON.stringify(view)); }
      catch (e) {}
    }
  };

  function loadView(key) {
    if (!key) return {};
    const v = storage.load(defaultScope(), key);
    return (v && typeof v === 'object') ? v : {};
  }
  function saveView(key, view) {
    if (!key) return;
    storage.save(defaultScope(), key, view);
  }
  function updateView(key, patch) {
    const cur = loadView(key);
    saveView(key, Object.assign({}, cur, patch));
  }

  // -----------------------------------------------------------------
  // Column-width persistence
  // -----------------------------------------------------------------
  function applyPersistedWidths(table, key) {
    const view = loadView(key);
    const widths = (view && view.widths) || {};
    table.querySelectorAll('th[data-col-key]').forEach(th => {
      const k = th.getAttribute('data-col-key');
      if (widths[k]) th.style.width = widths[k] + 'px';
    });
  }

  function wireResizers(table, key) {
    table.querySelectorAll('th .col-resizer').forEach(handle => {
      if (handle.dataset.gtWired === '1') return;
      handle.dataset.gtWired = '1';
      handle.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation(); // don't let mousedown leak to draggable th
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
            const view = loadView(key);
            view.widths = view.widths || {};
            view.widths[colKey] = th.offsetWidth;
            saveView(key, view);
          }
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });
  }

  // -----------------------------------------------------------------
  // Column-order persistence + drag-to-reorder
  // -----------------------------------------------------------------

  /** Apply a saved column order to a table by physically moving DOM cells. */
  function applyColumnOrder(table, savedOrder) {
    if (!Array.isArray(savedOrder) || savedOrder.length === 0) return;
    const thRow = table.querySelector('thead tr');
    if (!thRow) return;

    const originalThs = Array.from(thRow.children);
    const indexByKey = {};
    originalThs.forEach((th, idx) => {
      const k = th.getAttribute('data-col-key');
      if (k) indexByKey[k] = idx;
    });

    // Build the final list of ORIGINAL indexes in the new order.
    //   1) saved keys (only those present in the table)
    //   2) any other keyed columns we didn't see in saved order
    //   3) unkeyed columns (e.g. col-actions) — always pinned in their
    //      relative order at the end
    const newOrder = [];
    const seen = new Set();
    savedOrder.forEach(k => {
      const idx = indexByKey[k];
      if (idx !== undefined && !seen.has(idx)) {
        newOrder.push(idx);
        seen.add(idx);
      }
    });
    originalThs.forEach((th, idx) => {
      if (th.getAttribute('data-col-key') && !seen.has(idx)) {
        newOrder.push(idx);
        seen.add(idx);
      }
    });
    originalThs.forEach((th, idx) => {
      if (!th.getAttribute('data-col-key') && !seen.has(idx)) {
        newOrder.push(idx);
        seen.add(idx);
      }
    });

    // No-op if the order matches the original (avoids needless DOM thrash)
    let same = true;
    for (let i = 0; i < newOrder.length; i++) {
      if (newOrder[i] !== i) { same = false; break; }
    }
    if (same) return;

    // Reorder thead
    newOrder.forEach(originalIdx => thRow.appendChild(originalThs[originalIdx]));

    // Apply same permutation to every body row + any explicit colgroup
    const colgroup = table.querySelector('colgroup');
    if (colgroup) {
      const cols = Array.from(colgroup.children);
      newOrder.forEach(idx => { if (cols[idx]) colgroup.appendChild(cols[idx]); });
    }
    table.querySelectorAll('tbody tr, tfoot tr').forEach(tr => {
      const cells = Array.from(tr.children);
      // Don't touch rows with a colspan-spanning cell (e.g. package headers,
      // empty-state rows). They render across the table anyway.
      if (cells.some(c => c.colSpan && c.colSpan > 1)) return;
      newOrder.forEach(idx => { if (cells[idx]) tr.appendChild(cells[idx]); });
    });
  }

  function currentOrderKeys(table) {
    const thRow = table.querySelector('thead tr');
    if (!thRow) return [];
    return Array.from(thRow.querySelectorAll('th[data-col-key]'))
      .map(th => th.getAttribute('data-col-key'));
  }

  function wireDragReorder(table, key) {
    const thRow = table.querySelector('thead tr');
    if (!thRow) return;
    let dragKey = null;

    thRow.querySelectorAll('th[data-col-key]').forEach(th => {
      // Skip if no key (e.g. col-actions) or already wired
      if (th.dataset.gtDragWired === '1') return;
      th.dataset.gtDragWired = '1';
      th.setAttribute('draggable', 'true');
      th.style.cursor = th.style.cursor || 'grab';

      th.addEventListener('dragstart', e => {
        // Ignore if drag initiated on the resizer handle
        if (e.target.classList && e.target.classList.contains('col-resizer')) {
          e.preventDefault();
          return;
        }
        dragKey = th.getAttribute('data-col-key');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragKey); } catch (err) {}
        // Defer the class change so the drag image still captures the original look
        setTimeout(() => th.classList.add('gt-dragging'), 0);
      });

      th.addEventListener('dragend', () => {
        th.classList.remove('gt-dragging');
        thRow.querySelectorAll('th.gt-drop-before, th.gt-drop-after')
          .forEach(t => t.classList.remove('gt-drop-before', 'gt-drop-after'));
        dragKey = null;
      });

      th.addEventListener('dragover', e => {
        if (!dragKey || th.getAttribute('data-col-key') === dragKey) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Determine left/right half of target -> insert before or after
        const rect = th.getBoundingClientRect();
        const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
        thRow.querySelectorAll('th.gt-drop-before, th.gt-drop-after')
          .forEach(t => t.classList.remove('gt-drop-before', 'gt-drop-after'));
        th.classList.add(isLeftHalf ? 'gt-drop-before' : 'gt-drop-after');
      });

      th.addEventListener('drop', e => {
        e.preventDefault();
        const targetKey = th.getAttribute('data-col-key');
        if (!dragKey || !targetKey || dragKey === targetKey) return;
        const rect = th.getBoundingClientRect();
        const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;

        const order = currentOrderKeys(table);
        const fromIdx = order.indexOf(dragKey);
        if (fromIdx === -1) return;
        order.splice(fromIdx, 1);
        let toIdx = order.indexOf(targetKey);
        if (!isLeftHalf) toIdx += 1;
        order.splice(toIdx, 0, dragKey);

        applyColumnOrder(table, order);
        if (key) updateView(key, { order });
      });
    });
  }

  // -----------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------

  /**
   * Wire a .grid-table for col-resize + drag-reorder + view persistence.
   * @param {HTMLTableElement} table
   * @param {string} [persistKey] storage key (omit to skip persistence,
   *   resize/reorder still work in-session)
   */
  function wire(table, persistKey) {
    if (!table) return;
    // Persistence key — explicit arg wins over data-grid-key attribute
    const key = persistKey || table.getAttribute('data-grid-key') || null;
    if (key) {
      const view = loadView(key);
      if (view.order)  applyColumnOrder(table, view.order);
      if (view.widths) applyPersistedWidths(table, key);
    }
    wireResizers(table, key);
    wireDragReorder(table, key);
  }

  /** Wire every .grid-table currently in the DOM that isn't yet wired. */
  function wireAll(scope) {
    (scope || document).querySelectorAll('table.grid-table').forEach(t => wire(t));
  }

  /** Reset a single table's persisted view (handy for the demo Reset button). */
  function resetView(key) {
    if (!key) return;
    try { localStorage.removeItem(STORE_PREFIX + defaultScope() + '__' + key); }
    catch (e) {}
  }

  function autoWireOnReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => wireAll());
    } else {
      wireAll();
    }
  }
  autoWireOnReady();

  return { wire, wireAll, resetView, applyColumnOrder, storage };
})();
