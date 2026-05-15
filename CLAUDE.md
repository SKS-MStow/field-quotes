# field-quotes — Mockups platform onboarding

You're working on the **mockups platform** — a small framework hosting interactive prototypes of new field apps so reviewers can walk full flows and leave precise feedback before real implementation. Currently one app lives here (the SKS quoting tool), but the structure is built for more.

Read the whole file before touching anything. Each rule below exists because a past agent (probably me) burned hours by ignoring it.

---

## What this is

```
URL    https://fieldapps.verdalecres.xyz/mockups/<slug>/
       https://fieldapps.verdalecres.xyz/mockups-staging/<slug>/

API    /api/mockups/<slug>/notes              ← review notes (per-record Postgres)
       /api/mockups/<slug>/notes/revisions    ← snapshots of feedback rounds
       /api/mockups/<slug>/notes/revisions/cycle  ← atomic snapshot+truncate (deploy hook)
       /api/mockups/<slug>/state              ← per-record state objects (e.g. quote bodies)
       /api/mockups/<slug>/state/:id          ← upsert/get/delete one
       /api/mockups-staging/<slug>/...        ← staging mirror (separate tables)

Postgres mockup_<slug>_{comments,page_notes,revisions,state}
         mockup_<slug>_staging_*

Repo   mockups/
         _shared/
           review-tools/mock-review.js   ← shared toolbar / drawer / draw-shapes / history
         <slug>/
           index.html, 00-...html, ...
           css/, js/{mock-data,mock-state,mock-shell,mock-ui,mock-expiry}.js
         index.html                       ← /mockups/ landing page

Server /opt/fieldapps/www/field-quotes/mockups/<slug>/        ← prod
       /opt/fieldapps/www/field-quotes-staging/mockups/<slug>/  ← staging
```

Slugs use hyphens in URLs (`quotes-tool`) and underscores in table names (`quotes_tool`). The `makeMockupRouter(slug)` factory in `field-api/src/mockups-router.js` does the conversion.

The current app is **`quotes-tool`** — an AI-assisted quoting tool with Quick + Large modes, area builder, services & labour, output preview, draggable review toolbar, and full server-backed state sync.

The mockup self-disables on a date hard-coded in `mockups/quotes-tool/js/mock-expiry.js` (default ~14 days from each deploy). Extend by editing the constant + redeploying.

**Reviewers** (Mark, Steven Carmichael, Steven Falcinella) actively leave feedback via the in-page review toolbar. Their notes are precious — back up before destructive ops.

---

## 🚨 Critical rules — read these twice

### 1. Never `DELETE /api/mockups/<slug>/notes` without explicit permission

That endpoint TRUNCATES the prod reviewer-notes tables. I (Claude) did this for an E2E test cycle earlier and lost Steven's in-progress work. The user wasn't impressed.

**Before any destructive op affecting prod data, back up first:**

```bash
TS=$(date +%Y%m%d-%H%M%S); BK=/c/Users/Mark/mockups-backup-$TS
mkdir -p $BK
curl -s https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/notes > $BK/prod-notes-api.json
curl -s https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/notes/revisions > $BK/prod-revisions-api.json
curl -s https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/state > $BK/prod-state-api.json
ssh mark@192.168.194.146 "cd /opt/fieldapps/compose && docker compose exec -T postgres \
    pg_dump -U fieldapps -d fieldapps -t 'mockup_quotes_tool*' --data-only --column-inserts" > $BK/pg-data.sql
```

### 2. **Test on staging, never on prod**

| Use-case | URL | Tables |
|---|---|---|
| Live reviews — DO NOT TOUCH | `/mockups/quotes-tool/` | `mockup_quotes_tool_*` |
| Testing + experiments | `/mockups-staging/quotes-tool/` | `mockup_quotes_tool_staging_*` |

Both URLs serve from the same physical server but **separate repo checkouts** (`/opt/fieldapps/www/field-quotes/` vs `/opt/fieldapps/www/field-quotes-staging/`) on different git branches (`main` vs `staging`). The client (`mock-review.js` + `mock-state.js`) auto-detects env from the URL path.

### 3. **Auto-cycle prod notes before every prod mockup push**

User does NOT want to remember this. Each prod deploy must run:

```bash
curl -s -X POST https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/notes/revisions/cycle \
     -H 'Content-Type: application/json' \
     -d '{"createdBy":"Auto-deploy"}'
```

Atomically snapshots current notes to a new `vN` revision, then TRUNCATEs live tables so reviewers open prod to a clean slate. The previous round stays browseable in the History drawer. Abort the deploy if response isn't 200.

See [[feedback-notes-cycle-workflow]] in memory.

### 4. **Field-api changes go through the proper PR cycle**

Path: `C:\Users\Mark\field-api\` (canonical clone) → `git checkout staging && git pull --ff-only` → `git checkout -b feat/whatever` → edit, commit, push → `gh pr create --base staging` → merge → `gh pr create --base master --head staging` → merge → deploy via `C:\Users\Mark\field-dashboard\scripts\deploy-fieldapps.ps1 -Backend -Target prod`.

**Never SCP files directly to `/opt/fieldapps/field-api/src/`** — they'll be untracked, the next deploy script run wipes them.

### 5. **Never destructive git ops on the server's field-api working tree** (`/opt/fieldapps/field-api/`)

That tree often has uncommitted edits from another agent or Mark. `git checkout`, `git reset --hard`, `git clean -fd` will lose work. Use the deploy script (which builds from your local canonical clone) instead.

### 6. **Caddy reload trap — file inode rotation**

Editing the Caddyfile via `mv` rotates the inode and the bind mount (`./Caddyfile:/etc/caddy/Caddyfile:ro`) keeps reading the OLD inode. Either:
- `cp` over the existing file (preserves inode), then `caddy reload`
- Or `mv` then `docker compose restart caddy` (re-resolves the bind mount)

`caddy validate` will lie and say "config is unchanged" when this happens.

---

## How the mockups platform is wired

### Frontend — `mockups/<slug>/`

Each app is self-contained. Standard pages start at `00-`, `01-`, etc. Per-app JS lives in `js/`. Each HTML loads:

```html
<script src="js/mock-data.js?v=..."></script>
<script src="js/mock-state.js?v=..."></script>
<script src="js/mock-ui.js?v=..."></script>
<script src="js/mock-shell.js?v=..."></script>
<script src="js/mock-expiry.js?v=..."></script>
<script src="../_shared/review-tools/mock-review.js?v=..."></script>
```

`../_shared/review-tools/mock-review.js` is the **shared library** — every mockup gets the toolbar, drawer, draw-shapes, history, sync status, and notes-revisions UI for free. It auto-detects the URL pattern and derives `API_BASE`:

```js
// /mockups/<slug>/         → API_BASE = /api/mockups/<slug>
// /mockups-staging/<slug>/ → API_BASE = /api/mockups-staging/<slug>
// (legacy /quotes-mockup/ aliases also recognised until 2026-05-22)
```

### State sync (`mock-state.js`)

Every quote body is mirrored at `/api/mockups/<slug>/state/<quoteId>`:

- **On mount**: `pullStateFromServer()` runs once, then every 12s + on focus
- **On save**: each touched quote is marked dirty, debounced PUT 800ms later
- **Conflict model**: last-write-wins per quote (server `updatedAt` wins on merge)
- **Pages re-render** on the `mock-state-synced` event

### Backend — `field-api/src/mockups-router.js`

Single factory `makeMockupRouter(slug)` builds a Router with:
- `/notes`, `/notes/comment`, `/notes/pagenote/:page`
- `/notes/revisions` (list/POST/DELETE/cycle)
- `/state`, `/state/:id` (get/put/delete)

Mounted in `server.js`:

```js
const { makeMockupRouter } = require('./mockups-router');
const mockupsRouter = require('express').Router();
mockupsRouter.use('/quotes-tool', makeMockupRouter('quotes_tool'));
const mockupsStagingRouter = require('express').Router();
mockupsStagingRouter.use('/quotes-tool', makeMockupRouter('quotes_tool_staging'));
app.use('/api/mockups',          mockupsRouter);
app.use('/api/mockups-staging',  mockupsStagingRouter);
```

Both mounts must be **before** `app.use('/api', apiLimiter)` and the `/api`-mounted `shiftsRouter` (whose `requireAuth` would 401 any /api/* request that falls through).

Tables are created on first request via `ensureSchema()`. Slug rule: `/^[a-z][a-z0-9_]*$/` (letters/digits/underscores; the URL slug's hyphens convert to underscores for tables).

---

## Standard workflows

### Pulling a new mockup change to prod (after staging-verified)

```bash
# 1. Cycle prod notes
curl -s -X POST https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/notes/revisions/cycle \
     -H 'Content-Type: application/json' -d '{"createdBy":"Auto-deploy"}'

# 2. Merge + push
cd E:/GIT/field-quotes && git checkout main && git merge --ff-only staging && git push origin main

# 3. Pull on prod server
ssh mark@192.168.194.146 "cd /opt/fieldapps/www/field-quotes && git pull --ff-only origin main"
```

No container restart needed for mockup changes — Caddy serves the files directly. Hard-refresh your browser.

### Pulling a mockup change to staging only

```bash
ssh mark@192.168.194.146 "cd /opt/fieldapps/www/field-quotes-staging && git pull --ff-only origin staging"
```

### Deploying a field-api change

After PR merged to master:

```powershell
cd C:\Users\Mark\field-api ; git checkout master ; git pull --ff-only origin master
cd C:\Users\Mark\field-dashboard ; .\scripts\deploy-fieldapps.ps1 -Target prod -Backend
```

If the PowerShell script throws because docker writes build progress to stderr, ignore it and verify by hitting an endpoint:

```bash
curl https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/notes/revisions
```

### Reading the live notes

```bash
curl -s https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/notes \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(c['author'],'on',c['page'],':',c['text'][:80]) for c in d['comments']]"
```

### Reading what reviewers see (cross-browser test)

```bash
# Mark's quote built in Browser A → server has it
curl -s https://fieldapps.verdalecres.xyz/api/mockups/quotes-tool/state \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(q['number'],'·', q.get('mode'), '·', q.get('updatedBy','?')) for q in d['items']]"
```

---

## Spawning a new mockup app

1. **Pick a slug** — letters/digits/hyphens only, e.g. `solar-monitor`.
2. **Repo**: `cp -r mockups/quotes-tool mockups/<slug>` and trim/customise. Update `<title>` and `data-page` on each HTML.
3. **API**: in `field-api/src/server.js` add one line:
   ```js
   mockupsRouter.use('/<slug>',         makeMockupRouter('<slug_underscored>'));
   mockupsStagingRouter.use('/<slug>',  makeMockupRouter('<slug_underscored>_staging'));
   ```
   Deploy via the standard PR cycle.
4. **Landing page**: add a card to `mockups/index.html` so reviewers can find it.
5. **First reviewer round**: cycle is a no-op until there's content; reviewers can start dropping notes immediately at `/mockups/<slug>/`.

The shared review tools, state sync, notes revisions, and history drawer all work out of the box because they're slug-driven from the URL.

---

## Things that have already burned me

1. Whole-blob notes storage → two reviewers stomped each other. Fixed: per-record Postgres rows.
2. Cross-tab pin leak (admin#products pin appearing on #services). Fixed: `pageId()` includes `location.hash`.
3. Pin coords on layout reflow → drift across viewport widths. Fixed: anchored to DOM element + fractional offset.
4. `../shared/theme.css` 404'd because Caddy mount changed root. Fixed: bundle inside `mockups/<slug>/css/`.
5. SCP'ing field-api files directly → wiped by next deploy. Always go through git.
6. TRUNCATING notes "to reset for testing" → lost real work. Use `/mockups-staging/`, never prod.
7. Drawer + modal as siblings of `<main>` → MockShell rewrites body and strips them. Must live INSIDE `#content`.
8. **Quote state in localStorage only** → reviewers couldn't see each other's in-progress quotes; quote-scoped notes were orphaned. Fixed: server-side `/state` sync.
9. Caddyfile `mv` rotated inode → bind-mounted container kept reading old file. Fixed: `cp` over the file or restart container.

---

## Repo housekeeping

- Default branch: `main` (prod)
- Staging branch: `staging` (server's `field-quotes-staging/` checkout tracks this)
- `.local-backups/` is gitignored
- `mockups/index.html` is the landing page that lists every mockup app
- Initial commit + every change signed `Co-Authored-By: Claude Opus 4.7 (1M context)`

---

## Deprecated (delete after 2026-05-22)

- `/quotes-mockup/*` and `/quotes-mockup-staging/*` URLs → 301 redirect to `/mockups/quotes-tool/*`
- `/api/quotes-mockup/*` and `/api/quotes-mockup-staging/*` → aliased to the new factory
- `field-api/src/quotes-mockup-notes.js` — old file, replaced by `mockups-router.js`
