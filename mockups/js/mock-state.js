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
      return { ...defaultState(), ...parsed };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function defaultState() {
    const quotes = MockData.sampleQuotes.map(q => {
      const quote = {
        ...q,
        areas: [],
        services: MockData.services.filter(svc => svc.includedByDefault).map(svc => ({
          id: uid('sv'), serviceId: svc.id, name: svc.name, category: svc.category,
          unit: svc.unit, qty: svc.defaultQty, rate: svc.defaultRate, marginPct: svc.marginPct, included: true
        })),
        exclusions: [...MockData.exclusionsLibrary].slice(0, 6),
        terms: MockData.standardTerms,
        globalMarginPct: 25,
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
    if (spec.globalMarginPct !== undefined) quote.globalMarginPct = spec.globalMarginPct;
    if (spec.mode) quote.mode = spec.mode;

    (spec.areas || []).forEach(specArea => {
      const area = {
        id: uid('ar'),
        name: specArea.name,
        type: specArea.type || '',
        notes: specArea.notes || '',
        lines: []
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
        const existing = quote.services.find(s => s.serviceId === sid);
        if (existing) {
          if (override.qty !== undefined) existing.qty = override.qty;
          if (override.rate !== undefined) existing.rate = override.rate;
          if (override.marginPct !== undefined) existing.marginPct = override.marginPct;
          existing.included = true;
        } else {
          quote.services.push({
            id: uid('sv'),
            serviceId: def.id,
            name: def.name,
            category: def.category,
            unit: def.unit,
            qty: override.qty ?? def.defaultQty ?? 1,
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
      project: { name: '', address: '', internalRef: '', headContractor: '', notes: '' },
      areas: [],
      services: MockData.services.filter(svc => svc.includedByDefault).map(svc => ({
        id: uid('sv'), serviceId: svc.id, name: svc.name, category: svc.category,
        unit: svc.unit, qty: svc.defaultQty, rate: svc.defaultRate, marginPct: svc.marginPct, included: true
      })),
      exclusions: [...MockData.exclusionsLibrary].slice(0, 6),
      terms: MockData.standardTerms,
      globalMarginPct: 25,
      notesToClient: ''
    };
    // Quick mode starts with one default area; Large starts empty
    if (mode === 'quick') {
      q.areas.push({ id: uid('ar'), name: 'Scope', type: 'General', notes: '', lines: [] });
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
  function addArea(quoteId, name) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return null;
    const area = { id: uid('ar'), name: name || `Area ${q.areas.length + 1}`, type: '', notes: '', lines: [] };
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
    copy.lines = copy.lines.map(l => ({ ...l, id: uid('ln') }));
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
        if (def) q.services.push({
          id: uid('sv'), serviceId: def.id, name: def.name, category: def.category,
          unit: def.unit, qty: def.defaultQty || 1, rate: def.defaultRate, marginPct: def.marginPct, included: true
        });
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

  function addCustomService(quoteId, name, unit, rate, qty) {
    const s = load();
    const q = s.quotes.find(q => q.id === quoteId);
    if (!q) return;
    q.services.push({
      id: uid('sv'), serviceId: null, name: name || 'Custom service',
      category: 'Custom', unit: unit || 'lot', qty: qty || 1, rate: rate || 0, marginPct: 25, included: true
    });
    q.value = quoteTotal(q).sellExGST;
    save(s);
  }

  // -------------------------------------------------------------
  // Math
  // -------------------------------------------------------------
  function effectiveMargin(line, area, quote) {
    if (line.marginPct !== null && line.marginPct !== undefined) return line.marginPct;
    if (area && area.marginPct !== null && area.marginPct !== undefined) return area.marginPct;
    return quote.globalMarginPct ?? 25;
  }

  function lineSellPrice(line, area, quote) {
    const m = effectiveMargin(line, area, quote);
    // Margin = (sell - cost) / sell  →  sell = cost / (1 - m/100)
    const denom = 1 - (m / 100);
    if (denom <= 0) return line.costPrice;
    return line.costPrice / denom;
  }

  function lineTotals(line, area, quote) {
    const sellEach = lineSellPrice(line, area, quote);
    const costTotal = line.costPrice * line.qty;
    const sellTotal = sellEach * line.qty;
    const labourTotalHrs = line.isSupplyOnly ? 0 : line.labourHours * line.qty;
    const labourSell = labourTotalHrs * MockData.rateForTrade(line.labourTrade || 'AV Tech');
    return { sellEach, costTotal, sellTotal, labourTotalHrs, labourSell };
  }

  function areaTotals(area, quote) {
    const init = { materialsCost: 0, materialsSell: 0, labourHours: 0, labourSell: 0 };
    return area.lines.reduce((acc, line) => {
      const t = lineTotals(line, area, quote);
      acc.materialsCost += t.costTotal;
      acc.materialsSell += t.sellTotal;
      acc.labourHours   += t.labourTotalHrs;
      acc.labourSell    += t.labourSell;
      return acc;
    }, init);
  }

  function servicesTotal(quote) {
    const init = { cost: 0, sell: 0 };
    return quote.services.filter(s => s.included).reduce((acc, sv) => {
      const cost = (sv.qty || 0) * (sv.rate || 0);
      const sell = cost / (1 - ((sv.marginPct || 0) / 100));
      acc.cost += cost;
      acc.sell += isFinite(sell) ? sell : cost;
      return acc;
    }, init);
  }

  function quoteTotal(quote) {
    let matCost = 0, matSell = 0, labHrs = 0, labSell = 0;
    quote.areas.forEach(a => {
      const t = areaTotals(a, quote);
      matCost += t.materialsCost; matSell += t.materialsSell;
      labHrs  += t.labourHours;   labSell += t.labourSell;
    });
    const svc = servicesTotal(quote);
    const sellExGST = matSell + labSell + svc.sell;
    const costTotal = matCost + svc.cost;        // labour cost is folded into trade rates
    const margin    = sellExGST - costTotal;
    const marginPct = sellExGST > 0 ? (margin / sellExGST) * 100 : 0;
    const gst = sellExGST * 0.10;
    const incGST = sellExGST + gst;
    return {
      materialsCost: matCost, materialsSell: matSell,
      labourHours: labHrs, labourSell: labSell,
      servicesCost: svc.cost, servicesSell: svc.sell,
      sellExGST, costTotal, margin, marginPct, gst, incGST
    };
  }

  return {
    // persistence
    load, save, reset,
    // quote lifecycle
    newQuote, getCurrentQuote, setCurrentQuote, getQuote, getQuotes, updateQuote,
    // areas/lines
    addArea, removeArea, duplicateArea, updateArea,
    addLineFromProduct, addPackageToArea, updateLine, removeLine,
    // services
    toggleService, updateService, addCustomService,
    // math
    effectiveMargin, lineSellPrice, lineTotals, areaTotals, servicesTotal, quoteTotal
  };
})();
