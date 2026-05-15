/* ================================================================
   field-quotes mockups — quote state + persistence + math
   Stores everything in localStorage so the user can navigate
   between mockup pages and keep their work.
   ================================================================ */

window.MockState = (function () {

  const STORAGE_KEY = 'fq_mockup_state_v1';

  // -------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const merged = { ...defaultState(), ...parsed };
      // One-shot migration: roll any per-area labourLines into quote.services
      // as labour-flavoured custom service rows. Keeps Steven's existing manual
      // labour entries when we removed the per-area Installation Labour block.
      let migrated = false;
      (merged.quotes || []).forEach(q => {
        if (!Array.isArray(q.services)) q.services = [];
        (q.areas || []).forEach(area => {
          if (Array.isArray(area.labourLines) && area.labourLines.length > 0) {
            area.labourLines.forEach(l => {
              const trade = l.trade || 'AV Tech';
              const rate = (l.rateOverride !== null && l.rateOverride !== undefined && l.rateOverride !== '')
                ? Number(l.rateOverride)
                : (MockData.labourRates && MockData.labourRates[trade]) || 145;
              q.services.push({
                id: uid('sv'),
                serviceId: null,
                name: trade + (l.note ? ' — ' + l.note : '') + ' (' + (area.name || 'Area') + ')',
                category: 'Labour',
                unit: 'hr',
                isLabour: true,
                hours: Number(l.hours) || 0,
                qty: 1,
                rate,
                marginPct: q.labourMarginPct || 0,
                included: true
              });
              migrated = true;
            });
            area.labourLines = [];
          }
        });
        // Round 2 regression fix: predefined labour services were created with
        // qty + rate but no hours field. The new isLabour math reads hours, so
        // PM/Commissioning/Documentation/etc. silently compute $0. Migrate them
        // so qty becomes hours, qty resets to 1, isLabour=true.
        q.services.forEach(sv => {
          if ((sv.category === 'Labour' || sv.category === 'Subcontract') && (sv.hours === undefined || sv.hours === null)) {
            sv.hours = Number(sv.qty) || 0;
            sv.qty = 1;
            sv.isLabour = true;
            migrated = true;
          }
        });
        // Round 3: ensure every quote has every includedByDefault service
        // (round 3 added "Installation" — existing quotes need it added so
        // it shows in Services & Labour without requiring a new quote).
        MockData.services.filter(d => d.includedByDefault).forEach(def => {
          if (!q.services.find(sv => sv.serviceId === def.id)) {
            const isLab = def.category === 'Labour';
            q.services.push({
              id: uid('sv'), serviceId: def.id, name: def.name, category: def.category,
              unit: def.unit,
              qty: isLab ? 1 : (def.defaultQty || 1),
              hours: isLab ? (def.defaultQty || 0) : 0,
              isLabour: isLab,
              rate: def.defaultRate, marginPct: def.marginPct, included: true
            });
            migrated = true;
          }
        });
      });
      if (migrated) {
        try { console.info('[mock-state] migrated services to hours/isLabour model'); } catch (e) {}
        save(merged, { skipPush: true });
      }
      return merged;
    } catch (e) {
      return defaultState();
    }
  }

  function save(state, opts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Server sync (Phase 3) — track which quote bodies need to be PUT
    // back. Skipped during pulls so server data doesn't bounce back to
    // the server.
    if (!opts || !opts.skipPush) {
      (state.quotes || []).forEach(q => markDirty(q.id));
    }
  }

  function defaultState() {
    const quotes = MockData.sampleQuotes.map(q => {
      const quote = {
        ...q,
        // Ensure project has the new client-facing scopeOfWorks field
        project: { scopeOfWorks: '', ...(q.project || {}) },
        areas: [],
        services: MockData.services.filter(svc => svc.includedByDefault).map(svc => {
          const isLab = svc.category === 'Labour';
          return {
            id: uid('sv'), serviceId: svc.id, name: svc.name, category: svc.category,
            unit: svc.unit,
            qty: isLab ? 1 : svc.defaultQty,
            hours: isLab ? svc.defaultQty : 0,
            isLabour: isLab,
            rate: svc.defaultRate, marginPct: svc.marginPct, included: true
          };
        }),
        exclusions: [...MockData.exclusionsLibrary].slice(0, 6),
        terms: MockData.standardTerms,
        // Margin model — two independent sliders, global is a computed readout
        materialsMarginPct: 25,
        labourMarginPct: 0,
        globalMarginPct: 25,            // kept for backward compat with seeded data
        // Quote-level labour rate overrides ({} = inherit MockData.labourRates)
        labourRates: {},
        // Quote-level sundries (cables/accessories manual lines)
        sundries: [],
        // Attachments for the client doc (images / PDF markups)
        attachments: [],
        notesToClient: ''
      };
      // Apply seeded content if defined
      const spec = MockData.seedSpecs && MockData.seedSpecs[q.id];
      if (spec) materializeSeed(quote, spec);
      // Recompute value from materialized lines (fall back to seeded value)
      const t = quoteTotal(quote);
      quote.value = t.sellExGST > 0 ? Math.round(t.sellExGST) : (q.value || 0);
      return quote;
    });
    return {
      quotes,
      currentQuoteId: null,
      nextQuoteSeq: 49
    };
  }

  // Pure helper — populates a quote object in-place from a seed spec.
  // No state side-effects, used during defaultState() construction.
  function materializeSeed(quote, spec) {
    if (spec.globalMarginPct !== undefined) {
      quote.globalMarginPct = spec.globalMarginPct;
      // Default the new split margins from the legacy global if spec doesn't say otherwise
      if (spec.materialsMarginPct === undefined) quote.materialsMarginPct = spec.globalMarginPct;
    }
    if (spec.materialsMarginPct !== undefined) quote.materialsMarginPct = spec.materialsMarginPct;
    if (spec.labourMarginPct !== undefined)    quote.labourMarginPct    = spec.labourMarginPct;
    if (spec.labourRates) quote.labourRates = { ...quote.labourRates, ...spec.labourRates };
    if (spec.scopeOfWorks) quote.project.scopeOfWorks = spec.scopeOfWorks;
    if (spec.mode) quote.mode = spec.mode;

    (spec.areas || []).forEach(specArea => {
      const area = {
        id: uid('ar'),
        name: specArea.name,
        type: specArea.type || '',
        notes: specArea.notes || '',
        lines: [],
        labourLines: []
      };
      (specArea.lines || []).forEach(specLine => {
        const p = MockData.productById(specLine.productId);
        if (!p) return;
        const labour = MockData.labourForSub(p.sub);
        area.lines.push({
          id: uid('ln'),
          productId: p.id,
          description: p.desc,
          model: p.mpn,
          manufacturer: p.mfr,
          cat: p.cat,
          sub: p.sub,
          qty: specLine.qty || 1,
          unit: p.unit,
          costPrice: p.cost,
          marginPct: specLine.marginPct ?? null,
          labourHours: specLine.labourHours ?? labour.hours,
          labourTrade: labour.trade,
          isSupplyOnly: !!specLine.isSupplyOnly,
          isProvisional: !!specLine.isProvisional,
          lineNote: specLine.lineNote || '',
          packageId: specLine.packageId || null
        });
      });
      quote.areas.push(area);
    });

    if (spec.services) {
      Object.entries(spec.services).forEach(([sid, override]) => {
        const def = MockData.services.find(s => s.id === sid);
        if (!def) return;
        const isLab = def.category === 'Labour';
        const overrideQty = override.qty;
        const existing = quote.services.find(s => s.serviceId === sid);
        if (existing) {
          // Seed override: for labour services the spec qty is hours, for
          // non-labour it's literal qty.
          if (overrideQty !== undefined) {
            if (isLab) existing.hours = overrideQty;
            else       existing.qty   = overrideQty;
          }
          if (override.rate !== undefined) existing.rate = override.rate;
          if (override.marginPct !== undefined) existing.marginPct = override.marginPct;
          existing.included = true;
          if (isLab) { existing.isLabour = true; existing.qty = 1; if (existing.hours === undefined) existing.hours = def.defaultQty || 0; }
        } else {
          const seedCount = overrideQty ?? def.defaultQty ?? (isLab ? 0 : 1);
          quote.services.push({
            id: uid('sv'),
            serviceId: def.id,
            name: def.name,
            category: def.category,
            unit: def.unit,
            qty: isLab ? 1 : seedCount,
            hours: isLab ? seedCount : 0,
            isLabour: isLab,
            rate: override.rate ?? def.defaultRate,
            marginPct: override.marginPct ?? def.marginPct,
            included: true
          });
        }
      });
    }

    if (spec.exclusions) quote.exclusions = [...spec.exclusions];
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // -------------------------------------------------------------
  // Quote operations
  // -------------------------------------------------------------
  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function generateQuoteNumber(state) {
    const year = new Date().getFullYear();
    const seq = String(state.nextQuoteSeq).padStart(4, '0');
    return `SKS-${year}-${seq}`;
  }

  function newQuote(mode) {
    const s = load();
    const number = generateQuoteNumber(s);
    const id = uid('q');
    const today = new Date().toISOString().slice(0, 10);
    const valid = new Date(); valid.setDate(valid.getDate() + 30);
    const q = {
      id,
      number,
      revision: 'A',
      status: 'draft',
      mode,                              // 'quick' or 'large'
      preparedBy: 'Mark Stowell',
      createdAt: today,
      validUntil: valid.toISOString().slice(0, 10),
      value: 0,
      client: { name: '', contact: '', email: '', phone: '', address: '' },
      project: { name: '', address: '', internalRef: '', headContractor: '', notes: '', scopeOfWorks: '' },
      areas: [],
      services: MockData.services.filter(svc => svc.includedByDefault).map(svc => ({
        id: uid('sv'), serviceId: svc.id, name: svc.name, category: svc.category,
        unit: svc.unit, qty: svc.defaultQty, rate: svc.defaultRate, marginPct: svc.marginPct, included: true
      })),
      exclusions: [...MockData.exclusionsLibrary].slice(0, 6),
      terms: MockData.standardTerms,
      materialsMarginPct: 25,
      labourMarginPct: 0,
      globalMarginPct: 25,
      labourRates: {},
      sundries: [],
      attachments: [],
      notesToClient: ''
    };
    // Quick mode starts with one default area; Large starts empty
    if (mode === 'quick') {
      q.areas.push({ id: uid('ar'), name: 'Scope', type: 'General', notes: '', lines: [], labourLines: [] });
    }
    s.quotes.unshift(q);
    s.currentQuoteId = id;
    s.nextQuoteSeq += 1;
    save(s);
    return q;
  }

  function getCurrentQuote() {
    const s = load();
    if (!s.currentQuoteId) return null;
    return s.quotes.find(q => q.id === s.currentQuoteId) || null;
  }

  function setCurrentQuote(id) {
    const s = load();
    s.currentQuoteId = id;
    save(s);
  }

  function getQuote(id) {
    const s = load();
    return s.quotes.find(q => q.id === id) || null;
  }

  function getQuotes() {
    return load().quotes;
  }

  function updateQuote(id, patch) {
    const s = load();
    const idx = s.quotes.findIndex(q => q.id === id);
    if (idx === -1) return null;
    s.quotes[idx] = { ...s.quotes[idx], ...patch };
    s.quotes[idx].value = quoteTotal(s.quotes[idx]).sellExGST;
    save(s);
    return s.quotes[idx];
  }

  // -------------------------------------------------------------
  // Area & line operations
  // -------------------------------------------------------------
  // Guess a sensible area heading from the project scope text. Picks the
  // first matching keyword (e.g. "boardroom" → "Boardroom"). Falls back to
  // `Area N` when nothing matches. Used when the user adds an area without
  // supplying a name, so the heading reads as a real space description.
  const AREA_KEYWORDS = [
    ['boardroom', 'Boardroom'],
    ['board room', 'Boardroom'],
    ['meeting room', 'Meeting Room'],
    ['training room', 'Training Room'],
    ['huddle', 'Huddle Room'],
    ['conference', 'Conference Room'],
    ['reception', 'Reception'],
    ['lobby', 'Lobby'],
    ['foyer', 'Foyer'],
    ['open office', 'Open Office'],
    ['open plan', 'Open Office'],
    ['cafe', 'Café'],
    ['kitchen', 'Kitchen'],
    ['breakout', 'Breakout Area'],
    ['lunch', 'Lunch Room'],
    ['atrium', 'Atrium'],
    ['auditorium', 'Auditorium'],
    ['warehouse', 'Warehouse'],
    ['workshop', 'Workshop'],
    ['classroom', 'Classroom'],
    ['lecture', 'Lecture Theatre'],
    ['gym', 'Gymnasium'],
    ['lab', 'Laboratory'],
    ['comms room', 'Comms Room'],
    ['comms rack', 'Comms Room'],
    ['server room', 'Server Room'],
    ['ground floor', 'Ground Floor'],
    ['level ', 'Level'],            // "Level 3" → "Level"
    ['floor ', 'Floor'],
    ['office', 'Office']
  ];
  function suggestAreaName(quote) {
    const used = new Set((quote.areas || []).map(a => (a.name || '').toLowerCase().trim()));
    const text = (quote.project && quote.project.scopeOfWorks || '').toLowerCase();
    if (text) {
      for (const [kw, label] of AREA_KEYWORDS) {
        if (text.includes(kw) && !used.has(label.toLowerCase())) return label;
      }
    }
    return `Area ${quote.areas.length + 1}`;
  }

  function addArea(quoteId, name) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    const finalName = (name && name.trim()) ? name : suggestAreaName(q);
    const area = { id: uid('ar'), name: finalName, type: '', notes: '', lines: [], labourLines: [] };
    q.areas.push(area);
    q.value = quoteTotal(q).sellExGST;
    save(s);
    return area;
  }

  function removeArea(quoteId, areaId) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    q.areas = q.areas.filter(a => a.id !== areaId);
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  function duplicateArea(quoteId, areaId) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    const src = q.areas.find(a => a.id === areaId);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = uid('ar');
    copy.name = src.name + ' (copy)';
    copy.lines = (copy.lines || []).map(l => ({ ...l, id: uid('ln') }));
    copy.labourLines = (copy.labourLines || []).map(l => ({ ...l, id: uid('lab') }));
    q.areas.push(copy);
    q.value = quoteTotal(q).sellExGST;
    save(s);
    return copy;
  }

  function updateArea(quoteId, areaId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const a = q.areas.find(a => a.id === areaId);
    if (!a) return;
    Object.assign(a, patch);
    save(s);
  }

  function addLineFromProduct(quoteId, areaId, productId, qty) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    const a = q.areas.find(a => a.id === areaId);
    if (!a) return null;
    const p = MockData.productById(productId);
    if (!p) return null;
    // Merge with an existing line for the same product (Steven's note: single
    // line per product with adjustable qty, instead of N rows for N adds).
    const existing = a.lines.find(l => l.productId === p.id && !l.packageId);
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + (qty || 1);
      q.value = quoteTotal(q).sellExGST;
      save(s);
      return existing;
    }
    const labour = MockData.labourForSub(p.sub);
    const line = {
      id: uid('ln'),
      productId: p.id,
      description: p.desc,
      model: p.mpn,
      manufacturer: p.mfr,
      cat: p.cat,
      sub: p.sub,
      qty: qty || 1,
      unit: p.unit,
      costPrice: p.cost,
      marginPct: null,                // null = inherit from global / category
      labourHours: labour.hours,
      labourTrade: labour.trade,
      isSupplyOnly: false,
      isProvisional: false,
      lineNote: '',
      packageId: null
    };
    a.lines.push(line);
    q.value = quoteTotal(q).sellExGST;
    save(s);
    return line;
  }

  // Add a free-form (non-catalog) line to an area. Reviewer c_wnejwj — wants
  // ability to type lines without picking from MockData.products. Same line
  // schema as product lines so renderLinesForArea / lineTotals / updateLine
  // all work unmodified; productId:null + isManual:true identify these rows
  // so the render can swap Brand/Model/Description from read-only to inputs.
  // Round-4: catalog product lines are also fully editable; this helper tells
  // the render whether a field differs from the catalog default so the cell
  // can show an override tint. (c_o67tl7)
  const PRODUCT_DEFAULT_KEY = {
    manufacturer: 'mfr', model: 'mpn', description: 'desc',
    unit: 'unit', costPrice: 'cost'
  };
  function lineHasOverride(line, field) {
    if (!line || !line.productId) return false;
    const p = MockData.productById(line.productId);
    if (!p) return false;
    const pk = PRODUCT_DEFAULT_KEY[field];
    if (!pk) return false;
    return line[field] !== p[pk];
  }

  function addManualLine(quoteId, areaId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    const a = q.areas.find(a => a.id === areaId);
    if (!a) return null;
    const line = {
      id: uid('ln'),
      productId: null,
      isManual: true,
      manufacturer: patch?.manufacturer || '',
      model: patch?.model || '',
      description: patch?.description || 'Custom item',
      cat: patch?.cat || 'Custom',
      sub: patch?.sub || '',
      qty: patch?.qty ?? 1,
      unit: patch?.unit || 'ea',
      costPrice: patch?.costPrice ?? 0,
      marginPct: patch?.marginPct ?? null,
      labourHours: patch?.labourHours ?? 0,
      labourTrade: patch?.labourTrade || 'AV Tech',
      isSupplyOnly: false,
      isProvisional: false,
      lineNote: '',
      packageId: null
    };
    a.lines.push(line);
    q.value = quoteTotal(q).sellExGST;
    save(s);
    return line;
  }

  function addPackageToArea(quoteId, areaId, packageId) {
    const pkg = MockData.packages.find(p => p.id === packageId);
    if (!pkg) return [];
    const added = [];
    pkg.items.forEach(it => {
      const line = addLineFromProduct(quoteId, areaId, it.productId, it.qty);
      if (line) { line.packageId = packageId; added.push(line); }
    });
    // Save with packageId tagged
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (q) {
      const a = q.areas.find(a => a.id === areaId);
      if (a) {
        added.forEach(addedLine => {
          const found = a.lines.find(l => l.id === addedLine.id);
          if (found) found.packageId = packageId;
        });
        q.value = quoteTotal(q).sellExGST;
      }
    }
    save(s);
    return added;
  }

  function updateLine(quoteId, areaId, lineId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const a = q.areas.find(a => a.id === areaId);
    if (!a) return;
    const l = a.lines.find(l => l.id === lineId);
    if (!l) return;
    Object.assign(l, patch);
    if (l.isSupplyOnly) l.labourHours = 0;
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  function removeLine(quoteId, areaId, lineId) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const a = q.areas.find(a => a.id === areaId);
    if (!a) return;
    a.lines = a.lines.filter(l => l.id !== lineId);
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  // -------------------------------------------------------------
  // Services
  // -------------------------------------------------------------
  function toggleService(quoteId, serviceId, on) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const existing = q.services.find(sv => sv.serviceId === serviceId);
    if (on) {
      if (existing) { existing.included = true; }
      else {
        const def = MockData.services.find(d => d.id === serviceId);
        if (def) {
          const isLab = def.category === 'Labour';
          q.services.push({
            id: uid('sv'), serviceId: def.id, name: def.name, category: def.category,
            unit: def.unit,
            qty: isLab ? 1 : (def.defaultQty || 1),
            hours: isLab ? (def.defaultQty || 0) : 0,
            isLabour: isLab,
            rate: def.defaultRate, marginPct: def.marginPct, included: true
          });
        }
      }
    } else if (existing) {
      existing.included = false;
    }
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  function updateService(quoteId, svcRowId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const sv = q.services.find(x => x.id === svcRowId);
    if (!sv) return;
    Object.assign(sv, patch);
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  function addCustomService(quoteId, name, unit, rate, qty, extra) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const base = {
      id: uid('sv'), serviceId: null, name: name || 'Custom service',
      category: 'Custom', unit: unit || 'lot', qty: qty || 1, rate: rate || 0,
      marginPct: 25, included: true,
      isLabour: false, hours: 0
    };
    q.services.push(Object.assign(base, extra || {}));
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  // -------------------------------------------------------------
  // Manual area-labour lines (sundries entered per area)
  // -------------------------------------------------------------
  function addAreaLabourLine(quoteId, areaId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    const a = q.areas.find(a => a.id === areaId);
    if (!a) return null;
    a.labourLines = a.labourLines || [];
    const line = {
      id: uid('lab'),
      trade: patch?.trade || 'AV Tech',
      hours: patch?.hours ?? 0,
      rateOverride: patch?.rateOverride ?? null,    // null = use quote/MockData rate
      note: patch?.note || ''
    };
    a.labourLines.push(line);
    q.value = quoteTotal(q).sellExGST;
    save(s);
    return line;
  }
  function updateAreaLabourLine(quoteId, areaId, lineId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const a = q.areas.find(a => a.id === areaId);
    if (!a || !a.labourLines) return;
    const l = a.labourLines.find(l => l.id === lineId);
    if (!l) return;
    Object.assign(l, patch);
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }
  function removeAreaLabourLine(quoteId, areaId, lineId) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    const a = q.areas.find(a => a.id === areaId);
    if (!a || !a.labourLines) return;
    a.labourLines = a.labourLines.filter(l => l.id !== lineId);
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  // -------------------------------------------------------------
  // Quote-level cables/accessories sundries
  // -------------------------------------------------------------
  function addSundry(quoteId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    q.sundries = q.sundries || [];
    const sundry = {
      id: uid('sn'),
      description: patch?.description || 'Custom sundry',
      qty: patch?.qty ?? 1,
      unit: patch?.unit || 'lot',
      costPrice: patch?.costPrice ?? 0,
      marginPct: patch?.marginPct ?? null,   // null = inherit materials margin
      note: patch?.note || ''
    };
    q.sundries.push(sundry);
    q.value = quoteTotal(q).sellExGST;
    save(s);
    return sundry;
  }
  function updateSundry(quoteId, sundryId, patch) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q || !q.sundries) return;
    const sn = q.sundries.find(x => x.id === sundryId);
    if (!sn) return;
    Object.assign(sn, patch);
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }
  function removeSundry(quoteId, sundryId) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q || !q.sundries) return;
    q.sundries = q.sundries.filter(x => x.id !== sundryId);
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  // -------------------------------------------------------------
  // Attachments (file uploads stored as data URLs)
  // -------------------------------------------------------------
  function addAttachment(quoteId, att) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    q.attachments = q.attachments || [];
    const a = {
      id: uid('att'),
      name: att?.name || 'file',
      size: att?.size || 0,
      type: att?.type || 'application/octet-stream',
      dataUrl: att?.dataUrl || '',
      caption: att?.caption || '',
      addedAt: new Date().toISOString()
    };
    q.attachments.push(a);
    save(s);
    return a;
  }
  function removeAttachment(quoteId, attId) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q || !q.attachments) return;
    q.attachments = q.attachments.filter(a => a.id !== attId);
    save(s);
  }

  // -------------------------------------------------------------
  // Math
  // -------------------------------------------------------------

  // Trade rate honouring quote-level overrides
  function rateForTrade(trade, quote) {
    if (quote && quote.labourRates && quote.labourRates[trade] !== undefined && quote.labourRates[trade] !== null && quote.labourRates[trade] !== '') {
      const v = Number(quote.labourRates[trade]);
      if (!isNaN(v) && v > 0) return v;
    }
    return MockData.rateForTrade(trade);
  }

  // Effective margin for a PRODUCT line:
  //   line override > area override > quote.materialsMarginPct > legacy global > 25
  function effectiveMargin(line, area, quote) {
    if (line && line.marginPct !== null && line.marginPct !== undefined) return Number(line.marginPct);
    if (area && area.marginPct !== null && area.marginPct !== undefined) return Number(area.marginPct);
    if (quote && quote.materialsMarginPct !== undefined && quote.materialsMarginPct !== null) return Number(quote.materialsMarginPct);
    return quote && quote.globalMarginPct !== undefined ? Number(quote.globalMarginPct) : 25;
  }

  // Labour margin (separate slider)
  function labourMargin(quote) {
    if (quote && quote.labourMarginPct !== undefined && quote.labourMarginPct !== null) return Number(quote.labourMarginPct);
    return 0;
  }

  function sellFromCost(cost, marginPct) {
    const m = Number(marginPct) || 0;
    const denom = 1 - (m / 100);
    if (denom <= 0) return cost;
    return cost / denom;
  }

  function lineSellPrice(line, area, quote) {
    return sellFromCost(line.costPrice, effectiveMargin(line, area, quote));
  }

  function lineTotals(line, area, quote) {
    const sellEach = lineSellPrice(line, area, quote);
    const costTotal = line.costPrice * line.qty;
    const sellTotal = sellEach * line.qty;
    const labourTotalHrs = line.isSupplyOnly ? 0 : (Number(line.labourHours) || 0) * line.qty;
    const trade = line.labourTrade || 'AV Tech';
    const rate = rateForTrade(trade, quote);
    const labourCost = labourTotalHrs * rate;
    const labourSell = sellFromCost(labourCost, labourMargin(quote));
    return { sellEach, costTotal, sellTotal, labourTotalHrs, labourCost, labourSell };
  }

  // Convert a manual area-labour entry into cost + sell using the same rules
  function areaLabourLineTotals(labLine, quote) {
    const hours = Number(labLine.hours) || 0;
    const trade = labLine.trade || 'AV Tech';
    const rate = (labLine.rateOverride !== null && labLine.rateOverride !== undefined && labLine.rateOverride !== '')
      ? (Number(labLine.rateOverride) || rateForTrade(trade, quote))
      : rateForTrade(trade, quote);
    const cost = hours * rate;
    const sell = sellFromCost(cost, labourMargin(quote));
    return { trade, hours, rate, cost, sell };
  }

  function areaTotals(area, quote) {
    const init = { materialsCost: 0, materialsSell: 0, labourHours: 0, labourCost: 0, labourSell: 0, labourByTrade: {} };
    const acc = (area.lines || []).reduce((a, line) => {
      const t = lineTotals(line, area, quote);
      a.materialsCost += t.costTotal;
      a.materialsSell += t.sellTotal;
      a.labourHours   += t.labourTotalHrs;
      a.labourCost    += t.labourCost;
      a.labourSell    += t.labourSell;
      const trade = line.labourTrade || 'AV Tech';
      a.labourByTrade[trade] = (a.labourByTrade[trade] || 0) + t.labourTotalHrs;
      return a;
    }, init);
    (area.labourLines || []).forEach(ll => {
      const t = areaLabourLineTotals(ll, quote);
      acc.labourHours += t.hours;
      acc.labourCost  += t.cost;
      acc.labourSell  += t.sell;
      acc.labourByTrade[t.trade] = (acc.labourByTrade[t.trade] || 0) + t.hours;
    });
    return acc;
  }

  // For labour-flavoured services hours drives the cost (hrs × rate). For
  // everything else qty × rate. isLabour is true on migrated rows; we also
  // treat any 'Labour' category service as labour-style for safety.
  function isLabourService(sv) {
    return !!sv.isLabour || (sv.category === 'Labour');
  }
  function serviceUnitCount(sv) {
    // Labour rows use hours as the base unit, with qty as an optional multiplier
    // (e.g. 3 days × 8 hrs). Non-labour rows just use qty.
    if (isLabourService(sv)) return (Number(sv.qty) || 1) * (Number(sv.hours) || 0);
    return Number(sv.qty) || 0;
  }
  function serviceCost(sv) {
    return serviceUnitCount(sv) * (Number(sv.rate) || 0);
  }
  function serviceSell(sv) {
    // Services & Labour: rate is already the bill rate (margin baked in
    // when the estimator types it). No separate margin layer for services,
    // so sell equals cost. Reviewer note: "we don't need to add margin to
    // labour, we just do that in our figure".
    return serviceCost(sv);
  }

  function servicesTotal(quote) {
    const init = { cost: 0, sell: 0 };
    return (quote.services || []).filter(s => s.included).reduce((acc, sv) => {
      acc.cost += serviceCost(sv);
      acc.sell += serviceSell(sv);
      return acc;
    }, init);
  }

  function sundriesTotal(quote) {
    const init = { cost: 0, sell: 0 };
    return (quote.sundries || []).reduce((acc, sn) => {
      const cost = (Number(sn.qty) || 0) * (Number(sn.costPrice) || 0);
      const m = (sn.marginPct !== null && sn.marginPct !== undefined && sn.marginPct !== '')
        ? Number(sn.marginPct)
        : effectiveMargin({ marginPct: null }, null, quote);
      const sell = sellFromCost(cost, m);
      acc.cost += cost;
      acc.sell += isFinite(sell) ? sell : cost;
      return acc;
    }, init);
  }

  // Aggregate hours per trade across the whole quote (used by Review's labour overview)
  function quoteLabourByTrade(quote) {
    const out = {};
    (quote.areas || []).forEach(a => {
      const t = areaTotals(a, quote);
      Object.entries(t.labourByTrade || {}).forEach(([trade, hrs]) => {
        out[trade] = (out[trade] || 0) + hrs;
      });
    });
    return out;
  }

  function quoteTotal(quote) {
    let matCost = 0, matSell = 0, labHrs = 0, labCost = 0, labSell = 0;
    (quote.areas || []).forEach(a => {
      const t = areaTotals(a, quote);
      matCost += t.materialsCost; matSell += t.materialsSell;
      labHrs  += t.labourHours;   labCost += t.labourCost;  labSell += t.labourSell;
    });
    const svc = servicesTotal(quote);
    const snd = sundriesTotal(quote);
    matCost += snd.cost; matSell += snd.sell;     // sundries roll into materials
    const sellExGST = matSell + labSell + svc.sell;
    const costTotal = matCost + labCost + svc.cost;
    const margin    = sellExGST - costTotal;
    const marginPct = sellExGST > 0 ? (margin / sellExGST) * 100 : 0;
    const gst = sellExGST * 0.10;
    const incGST = sellExGST + gst;
    return {
      materialsCost: matCost, materialsSell: matSell,
      labourHours: labHrs, labourCost: labCost, labourSell: labSell,
      servicesCost: svc.cost, servicesSell: svc.sell,
      sundriesCost: snd.cost, sundriesSell: snd.sell,
      sellExGST, costTotal, margin, marginPct, gst, incGST
    };
  }

  // -------------------------------------------------------------
  // Server-side state sync (Phase 3 of mockups platform)
  //
  // Each quote body is mirrored at /api/mockups/<slug>/state/<quoteId>.
  // - On load: pull from server, merge (server wins where updatedAt is newer)
  // - On save: mark touched quotes dirty, debounced PUT 800ms later
  // - On poll: refetch every 12s in case another reviewer edited
  //
  // Conflict model: last-write-wins per quote body. Acceptable for mockup
  // review; not suitable for real implementation.
  // -------------------------------------------------------------
  const STATE_SYNC = (function () {
    const m = location.pathname.match(/^\/(mockups|mockups-staging)\/([^\/]+)\//);
    let api;
    if (m) {
      const stagingPrefix = m[1] === 'mockups-staging' ? '/api/mockups-staging/' : '/api/mockups/';
      api = stagingPrefix + m[2] + '/state';
    } else {
      // Legacy /quotes-mockup[-staging]/ paths
      const isStaging = /\/quotes-mockup-staging\//.test(location.pathname);
      api = (isStaging ? '/api/mockups-staging/' : '/api/mockups/') + 'quotes-tool/state';
    }
    return { api };
  })();

  const dirtyIds = new Set();
  let pushTimer = null;
  let pullInFlight = false;

  function reviewerName() {
    const k = /\/mockups-staging\//.test(location.pathname) || /\/quotes-mockup-staging\//.test(location.pathname)
      ? 'mr_reviewer_v1_staging' : 'mr_reviewer_v1';
    return localStorage.getItem(k) || 'unknown';
  }

  function markDirty(quoteId) {
    if (!quoteId) return;
    dirtyIds.add(quoteId);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(flushPush, 800);
  }

  async function flushPush() {
    pushTimer = null;
    const ids = Array.from(dirtyIds);
    dirtyIds.clear();
    if (ids.length === 0) return;
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const reviewer = reviewerName();
    for (const id of ids) {
      const q = (local.quotes || []).find(x => x.id === id);
      if (!q) continue;
      q.updatedAt = new Date().toISOString();
      try {
        await fetch(STATE_SYNC.api + '/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: q, updatedBy: reviewer })
        });
      } catch (e) {
        // Re-mark so a future save will retry
        dirtyIds.add(id);
      }
    }
  }

  async function pullStateFromServer() {
    if (pullInFlight) return;
    pullInFlight = true;
    try {
      const r = await fetch(STATE_SYNC.api, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (!Array.isArray(j.items)) return;
      const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify(defaultState()));
      const localById = Object.fromEntries((local.quotes || []).map(q => [q.id, q]));
      let changed = false;
      j.items.forEach(serverQuote => {
        if (!serverQuote || !serverQuote.id) return;
        const localQ = localById[serverQuote.id];
        const serverTime = new Date(serverQuote.updatedAt || 0).getTime();
        const localTime  = localQ ? new Date(localQ.updatedAt || 0).getTime() : 0;
        if (!localQ || serverTime > localTime) {
          localById[serverQuote.id] = { ...(localQ || {}), ...serverQuote };
          changed = true;
        }
      });
      if (changed) {
        local.quotes = Object.values(localById);
        save(local, { skipPush: true });
        try { window.dispatchEvent(new CustomEvent('mock-state-synced')); } catch (e) {}
      }
    } catch (e) {
      // Silent — sync is best-effort
    } finally {
      pullInFlight = false;
    }
  }

  // Pull on mount + poll every 12s. Pages re-render on the synced event.
  if (typeof window !== 'undefined') {
    setTimeout(pullStateFromServer, 100);
    setInterval(() => { if (!document.hidden) pullStateFromServer(); }, 12000);
    window.addEventListener('focus', pullStateFromServer);
  }

  return {
    // persistence
    load, save, reset,
    // server sync
    pullStateFromServer, flushPush,
    // quote lifecycle
    newQuote, getCurrentQuote, setCurrentQuote, getQuote, getQuotes, updateQuote,
    // areas/lines
    addArea, removeArea, duplicateArea, updateArea, suggestAreaName,
    addLineFromProduct, addManualLine, addPackageToArea, updateLine, removeLine, lineHasOverride,
    // per-area manual labour
    addAreaLabourLine, updateAreaLabourLine, removeAreaLabourLine,
    // quote-level cables/accessories sundries
    addSundry, updateSundry, removeSundry,
    // attachments
    addAttachment, removeAttachment,
    // services
    toggleService, updateService, addCustomService,
    // math
    rateForTrade, effectiveMargin, labourMargin, sellFromCost,
    lineSellPrice, lineTotals, areaLabourLineTotals, areaTotals,
    servicesTotal, sundriesTotal, quoteLabourByTrade, quoteTotal,
    // service-level helpers (labour vs non-labour)
    isLabourService, serviceUnitCount, serviceCost, serviceSell
  };
})();
