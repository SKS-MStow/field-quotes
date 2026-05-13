# SKS Quoting Tool — High-Level Plan

## Context

Steven (manager) has put together a framework for an AI-assisted quoting tool for SKS Technologies. It will live as a new app inside the existing field apps suite at `fieldapps.verdalecres.xyz`, alongside the management dashboard, expense claims, commissioning reports, site visits, etc. Visually and stylistically it matches the look and feel of the `/management` app — same sidebar, fonts, colours, mobile behaviour — so it feels like part of the same product, not a separate tool.

This plan covers WHAT the app does. It deliberately does not cover frameworks, databases, or implementation details — those come after this high-level view is signed off.

---

## What the App Is

A purpose-built quoting tool that lets SKS staff produce professional, client-ready quote documents quickly and consistently. It replaces ad-hoc spreadsheet quoting with a structured workflow: pick products from a live catalogue, auto-allocate labour, manage margin, and generate the final documents in one click.

The tool supports two quote modes — a **Quick Quote** for small jobs (one room, one trade, supply-only work) and a **Large Quote** for full project submissions and tenders (multi-area, multi-trade, full proposal document). A quote can be upgraded from Quick to Large mid-build without losing entered data.

---

## Who Uses It

- **Estimators** — build quotes day-to-day
- **Manager (Steven)** — reviews, approves large quotes, manages the underlying catalogue and margin defaults
- **Admin** — uploads supplier price sheets and maintains the product catalogue

Users sign in via the same login as every other field app.

---

## The Two Quote Modes

**Quick Quote** — for small jobs, minor variations, or supply-only work. Single area, simplified client fields, fast product pick, single-page output.

**Large Quote** — for full project submissions and tenders. Multi-area builder, full client + project info, per-area notes and subtotals, services breakdown, full proposal document with cover page, scope summary, exclusions, and terms.

---

## What the App Does (Capabilities)

### 1. Capture client and project information
- Manual entry of client name, contact, address, project name, site address.
- Auto-generated quote number, date, validity period, revision letter.
- Optional: paste a tender email or upload a scope document and let the tool pre-fill these fields automatically.

### 2. Build the scope
- **Quick mode** — pick products for a single area.
- **Large mode** — add named areas (e.g. "Level 3 Boardroom", "Reception"), reorder them, duplicate them, give each area its own notes and product list.

### 3. Pick products from a live catalogue
- Filter by category → subcategory → brand, or search by description / part number.
- Adding a product adds a line with description, model, quantity, cost, margin, sell.
- Quantity, margin, and labour hours are all editable inline on each line.
- Lines can be flagged as Supply Only or Provisional / PC Sum.

### 4. Auto-allocate labour
- Each subcategory has a default install time (e.g. "ceiling speaker = 0.5 hr each").
- Labour is added automatically when products are added; the estimator can adjust per line or per area.

### 5. Group products into packages
- Common combinations (e.g. "Standard Boardroom MTR System") are saved as packages and can be applied to an area in one action.
- Once applied, all items remain individually editable.

### 6. Add services
- Project management, commissioning, programming, travel, freight, etc. are pre-defined and toggled on/off.
- Quantity and rate editable; custom services can be added free-text.

### 7. Manage margin
- Default margin set globally, with overrides at category, area, and line level (lower level wins).
- "Apply X% to all lines" quick adjust.
- A cost/margin view for the estimator that's never exposed to the client.

### 8. Review before issue
- Full summary: totals per area, services, materials cost, labour cost, margin breakdown, GST, grand total.
- Warnings for unresolved scope items, empty areas, $0 service rates, missing quantities.
- Editable exclusions checklist and terms & conditions before output.

### 9. Generate outputs
- **Internal cost sheet** (spreadsheet) — full BOM, margin breakdown, labour reconciliation. For internal use only.
- **Client-facing quote** (document) — cover page, scope summary, per-area breakdown, services, pricing summary, exclusions, terms. Cost price is never shown.

### 10. Manage quotes over time
- Quote list with status (Draft / Issued / Accepted / Declined / Expired / Revised).
- Edit, duplicate, revise (creates Rev B, keeps Rev A read-only), download.
- Every revision is a snapshot — issued quotes are never overwritten.

---

## What the App Knows About (Underlying Data)

The tool is only as good as the data behind it. It maintains:

- **Suppliers** — name, contact, lead time, preferred status.
- **Products** — every item from every supplier, with cost, RRP, category, subcategory, brand, part number, unit. Price history is retained, not overwritten.
- **Categories & subcategories** — the tree that drives the product dropdowns (Audio → Ceiling Speakers, Visual → Displays, etc.). Fully editable.
- **Labour defaults** — install hours per subcategory, by trade type.
- **Services** — pre-defined non-product charge items (PM, commissioning, travel, freight, etc.).
- **Packages** — saved combinations of products + labour that can be dropped into an area.
- **Quote templates** — saved area + product structures for common room types.
- **Exclusions and terms** — reusable clause libraries.

All of this is editable through an admin section of the same app.

---

## Scope Assistance (AI Helper)

At any point the estimator can paste an email, upload a tender PDF / Word doc, or drop in an image of a scope. The tool offers back:

- Suggested client and project info → pipes into the client info form.
- Suggested room/area names → pipes into the area builder.
- Suggested products matched against the catalogue → estimator accepts/rejects each one.
- A short client-ready scope summary paragraph for the output document.
- Suggested exclusions relevant to the scope.

Everything is suggested, not applied automatically — the estimator stays in control.

---

## Quote Lifecycle

```
Draft  →  Issued  →  Accepted / Declined / Expired
                  →  Revised (Rev A is locked, Rev B opens as draft)
```

- Quote numbers follow `SKS-YYYY-XXXX`.
- Validity defaults to 30 days, adjustable.
- Issued quotes are immutable; changes always create a new revision.

---

## How It Fits Into the Field Apps Suite

This is built **inline with how every other field app is already done** — same stack, same patterns, same conventions. The intent is that widgets, components, and patterns can be ported between apps without rework, and that the whole suite continues to feel like one product.

- Lives at `fieldapps.verdalecres.xyz/quotes/`.
- Uses the same login, same session, same per-user app access control as every other field app.
- Appears as a tile on the field apps dashboard alongside Receipts, Commissioning, Site Visits, Management, etc.
- Same backend, same database, same deploy path as the existing apps — no new infrastructure introduced.
- Visual style matches `/management` exactly — same sidebar, mobile nav, fonts, colours, modal/toast/table patterns. To a user it should feel like another section of the same product.
- Where useful data already lives in other apps (e.g. supplier and product info already used by the existing `/ordering/` app), the quotes app reads from the same source rather than duplicating it.

---

## Out of Scope for This Plan

The stack and approach are already settled by the "build inline with the existing field apps" decision above — those aren't questions to revisit. The following are deliberately deferred to the next planning round:

- The exact layout and look of each screen (covered by the mockup phase next).
- How the product/supplier catalogue is shared with the existing `/ordering/` app at the schema level — confirmed it WILL be shared, the wiring details come later.
- Phase ordering — what ships first vs second vs later.
- AI prompt details and which scope-helper features land in v1 vs later.
- Output document templating specifics.

---

## Reference Point

**Functionally, think D-Tools SI** — the industry-standard AV quoting/design tool. Big product catalogue, system/area-based design, professional client proposals out the back. That's the bar we're aiming at, delivered inside the field apps suite with the same look and feel as the rest of the product.

---

## Next Steps (Approved Direction)

1. **Commit the source documents to the repo** at `E:\GIT\field-quotes`:
   - Steven's original framework PDF (`SKS Quoting Tool Framework v2.pdf`)
   - This high-level plan (as a markdown file in the repo, e.g. `docs/00-high-level.md`)
   - Initial commit so we have a starting point on the GitHub side.
2. **Start mockups** — produce visuals of the main screens so Steven can sign off on the UX before any backend work:
   - Mode select (Quick / Large)
   - Client & project info
   - Area builder (Large mode)
   - Product picker (Category → Subcategory → Brand → search)
   - Per-area product table with inline edits + labour
   - Services section
   - Review screen
   - Quote list / dashboard
   - Admin panel (suppliers, products, categories, labour, services, packages)
   - Output document preview
   - Built using the same visual language as `/management` so they drop straight into the suite when wired up.
3. **Lower-level technical plan** — after mockups are agreed, plan the data model, the integration with the shared product/supplier tables (alongside `/ordering/`), and the phasing (Phase 1 core quoting → Phase 2 AI + packages + revisions → Phase 3 approvals, variations, integrations).
