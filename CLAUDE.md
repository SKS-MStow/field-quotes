# field-quotes — Agent Onboarding

You're working on **the SKS Technologies quoting-tool mockup**, hosted as part of the field apps suite. Read this whole file before touching anything — every rule here is here because a past agent (probably me) burned hours or broke something by ignoring it.

---

## What this is

An interactive prototype of an AI-assisted quoting tool for SKS Technologies. Two modes — **Quick Quote** (small jobs, single area) and **Large Quote** (full project, multi-area). Built inline with the rest of the field apps suite — same vanilla-JS-no-build stack as `/management`, same `theme.css`, same look-and-feel. The point is that future widgets can port between apps.

It's a mockup — **no real data, no real users yet** — but reviewers (Mark, Steven Carmichael, Steven Falcinella) are actively using it to leave feedback via the built-in pinned-notes overlay. **Their notes are precious.** Don't drop the database.

The mockup itself self-disables on a date hard-coded in `mockups/js/mock-expiry.js` (default ~14 days from each deploy). Extend it by editing that constant and redeploying.

---

## 🚨 Critical rules — read these twice

### 1. Never `DELETE /api/quotes-mockup/notes` without explicit permission

That endpoint TRUNCATES the prod reviewer-notes table. I (Claude) did this for an E2E test cycle earlier and lost Steven's in-progress work. The user wasn't impressed.

**Before any destructive operation that affects prod data, back up first:**

```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p /c/Users/Mark/quotes-mockup-notes-backup-$TS
curl -s https://fieldapps.verdalecres.xyz/api/quotes-mockup/notes \
    > /c/Users/Mark/quotes-mockup-notes-backup-$TS/prod-api.json
ssh mark@192.168.194.146 "cd /opt/fieldapps/compose && docker compose exec -T postgres \
    pg_dump -U fieldapps -d fieldapps \
    -t quotes_mockup_comments -t quotes_mockup_page_notes \
    -t quotes_mockup_staging_comments -t quotes_mockup_staging_page_notes \
    --data-only --column-inserts" \
    > /c/Users/Mark/quotes-mockup-notes-backup-$TS/pg-data.sql
```

### 2. **Test on staging**, never on prod

There are two parallel URLs and two parallel sets of Postgres tables:

| Use-case | URL | Tables | Repo branch |
|---|---|---|---|
| Live reviews — DO NOT TOUCH | `/quotes-mockup/` | `quotes_mockup_*` | `main` |
| All testing + experiments | `/quotes-mockup-staging/` | `quotes_mockup_staging_*` | `staging` |

Both URLs serve from the same physical server, but from **separate repo checkouts** (`/opt/fieldapps/www/field-quotes/` vs `/opt/fieldapps/www/field-quotes-staging/`) on **different git branches**. The client (`mock-review.js`) auto-detects the env from the URL path.

### 3. **Field-api changes go through the field-api repo on a feature branch → staging → master**

There's a separate repo `SKS-MStow/field-api` that owns all `/api/*` routes including `/api/quotes-mockup/`. **Never SCP files directly to `/opt/fieldapps/field-api/src/`** — they'll be untracked, and the next time anyone runs the deploy script the files get wiped (this happened TWICE today). Path:

1. Canonical clone: `C:\Users\Mark\field-api\` (not `field-api-ready`, not `field-api-tmp`, not any other suffix)
2. `git checkout staging && git pull --ff-only`
3. `git checkout -b feat/whatever`
4. Edit, commit, push
5. `gh pr create --base staging` → merge
6. `gh pr create --base master --head staging` → merge
7. Deploy from `C:\Users\Mark\field-dashboard\scripts\deploy-fieldapps.ps1`

### 4. **Never destructive git ops on the server's field-api working tree** (`/opt/fieldapps/field-api/`)

That tree often has uncommitted edits from another agent or Mark. `git checkout`, `git reset --hard`, `git clean -fd` will lose work. If you need to deploy, use the deploy script from your local clone instead.

---

## How the mockup is wired

### Frontend (this repo)

```
field-quotes/
├── docs/                          # framework PDF + high-level plan (signed off)
├── shared/theme.css               # copy of field-dashboard theme.css (don't edit)
├── mockups/
│   ├── css/
│   │   ├── theme.css              # SAME copy bundled inline (mockups reference this — NOT ../shared/)
│   │   └── mockups.css            # tiny additions on top of theme.css
│   ├── js/
│   │   ├── mock-data.js           # seed catalogue, suppliers, packages, services, sample quotes
│   │   ├── mock-state.js          # in-browser quote state + math (localStorage-backed)
│   │   ├── mock-ui.js             # formatters, toast, status badge helpers
│   │   ├── mock-shell.js          # the sidebar/topbar/bottom-tabs shell (rendered into every page)
│   │   ├── mock-expiry.js         # the time-limited demo banner + expiry overlay
│   │   └── mock-review.js         # the reviewer overlay (pin notes + drawer) — server-backed
│   ├── index.html                 # mockup-index landing page
│   ├── 00-dashboard.html          # mockup screens, numbered
│   ├── 01-quote-list.html
│   ├── 02-mode-select.html
│   ├── 03-client-info.html
│   ├── 04-area-builder.html       # the meaty one
│   ├── 05-review.html
│   ├── 06-output-preview.html
│   ├── 07-admin.html              # hash-routed sub-tabs: #products / #suppliers / #categories / #packages / #services / #labour / #exclusions / #terms
│   └── 08-settings.html
└── .local-backups/                # gitignored — backups of notes data live here
```

Key gotchas:

- **`theme.css` lives at `mockups/css/theme.css`**, NOT `shared/theme.css`. Reason: the Caddy mount makes `mockups/` the root of `/quotes-mockup/`, so `../shared/` 404s. The HTML uses `<link href="css/theme.css">`. There's a duplicate copy at the repo's `shared/theme.css` (legacy, unused at runtime).
- The shell-injection in `mock-shell.js` rewrites `<body>`. **Any DOM nodes that live as siblings of `<main id="content">` get wiped.** Drawers, modals etc. MUST be inside `#content`. There's a comment in `04-area-builder.html` enforcing this — don't remove it.
- The expiry banner adds 32px padding-top to `.app-frame`. Don't fight it; respect `body.has-expiry-banner`.
- Pins are anchored via **CSS selector + offset within element**, not absolute coords. See `cssPathOf()` and `pinPosition()` in `mock-review.js`. ResizeObserver + MutationObserver re-position on layout reflow. **Do not break this** — Steven's screen is wider than mine and pins drift if anchoring breaks.
- `pageId()` **includes the hash** so admin's tabbed sub-pages (`#products` vs `#suppliers`) are distinct contexts. A pin placed on one tab doesn't leak to others. The `hashchange` event triggers a re-render.

### Backend (lives in `SKS-MStow/field-api`)

The review-notes API is in `src/quotes-mockup-notes.js`, mounted twice in `src/server.js`:

```js
app.use('/api/quotes-mockup', quotesMockupNotesRouter);                 // prod tables
app.use('/api/quotes-mockup-staging', quotesMockupStagingNotesRouter);  // staging tables
```

**Critical:** both mounts must be **before** `app.use('/api', apiLimiter)` and the `/api`-mounted `shiftsRouter`. `shiftsRouter` calls `router.use(requireAuth)` which 401s **any** `/api/*` request that falls through to it. Don't reorder these.

Postgres tables (auto-created on first request, no migration file):

| Table | What |
|---|---|
| `quotes_mockup_comments`            | one row per pin (prod) |
| `quotes_mockup_page_notes`          | one row per page-level note (prod) |
| `quotes_mockup_staging_comments`    | same, staging |
| `quotes_mockup_staging_page_notes`  | same, staging |

**Per-record storage** — pin updates do row-level upserts, NOT whole-blob overwrites. Two reviewers can write simultaneously. Don't refactor to a single JSONB row "for simplicity"; concurrent users get stomped.

API surface (each mount):

```
GET    /notes                    → { comments, pageNotes, fetchedAt, env }
PUT    /notes/comment            → upsert one comment (id in body)
DELETE /notes/comment/:id        → delete one comment
PUT    /notes/pagenote/:page     → upsert one page note
DELETE /notes/pagenote/:page     → delete one page note
DELETE /notes                    → 🚨 TRUNCATE everything — DON'T CALL WITHOUT ASKING
```

---

## Server layout

LAN: `mark@192.168.194.146`. External: `https://fieldapps.verdalecres.xyz` (Cloudflare Tunnel).

```
/opt/fieldapps/
├── compose/                              # docker-compose.yml + Caddyfile (PROD stack)
├── www/
│   ├── field-quotes/                     # PROD checkout — main branch
│   └── field-quotes-staging/             # STAGING checkout — staging branch
└── field-api/                            # field-api source for image build (PROD)

/opt/fieldapps-staging/                   # parallel stack with its own field-api, Caddy, Postgres
```

Caddy routes (see `Caddyfile`):

```
/quotes-mockup           → /opt/fieldapps/www/field-quotes/mockups/
/quotes-mockup/shared/   → /opt/fieldapps/www/field-quotes/shared/
/quotes-mockup-staging   → /opt/fieldapps/www/field-quotes-staging/mockups/
/quotes-mockup-staging/shared/ → /opt/fieldapps/www/field-quotes-staging/shared/
```

---

## Standard workflows

### Pulling a new mockup change to prod after staging-verified

```bash
ssh mark@192.168.194.146 "cd /opt/fieldapps/www/field-quotes && git pull --ff-only origin main"
# No container restart — Caddy serves the files directly. Hard-refresh your browser.
```

### Pulling a new mockup change to staging

```bash
ssh mark@192.168.194.146 "cd /opt/fieldapps/www/field-quotes-staging && git pull --ff-only origin staging"
```

### Deploying a field-api change (after PR-merged to master)

```powershell
cd C:\Users\Mark\field-api ; git checkout master ; git pull --ff-only origin master
cd C:\Users\Mark\field-dashboard ; .\scripts\deploy-fieldapps.ps1 -Target prod -Backend
```

Or — if the script isn't around / for staging — pull and rebuild manually:

```bash
ssh mark@192.168.194.146 "cd /opt/fieldapps/compose && docker compose up -d --build field-api"
# verify
curl https://fieldapps.verdalecres.xyz/api/health
curl https://fieldapps.verdalecres.xyz/api/quotes-mockup/notes | python3 -m json.tool | head -5
```

### Reading the live notes

```bash
curl -s https://fieldapps.verdalecres.xyz/api/quotes-mockup/notes \
  | python3 -c "import sys,json; d=json.load(sys.stdin); [print(c['author'],'on',c['page'],':',c['text'][:80]) for c in d['comments']]"
```

### Backing up notes (do this before any destructive op)

See "Critical rule 1" above.

---

## Things that have already burned me

1. **Whole-blob storage for notes** (now per-record) — two reviewers stomped each other.
2. **Cross-tab pin leak** (admin `#products` pin appearing on `#services`) — pageId didn't include hash.
3. **Pin coords on layout reflow** — pins drifted on different viewport widths because they were absolute pageX/pageY; now anchored to DOM element + offset.
4. **`../shared/theme.css`** — broke on the server because Caddy mounts `mockups/` as the root, so `../` 404s. Solution: bundle `theme.css` inside `mockups/css/`.
5. **SCP'ing field-api files directly** — they're untracked, get wiped by the next deploy. **Always go through the git workflow.**
6. **TRUNCATING the notes table to "reset for testing"** — lost real reviewer work. Use `/quotes-mockup-staging/` for testing, NEVER touch prod data.
7. **Drawer + modal markup as siblings of `<main>`** — MockShell rewrites body and strips them. Must live INSIDE `#content`.

---

## Repo housekeeping

- Default branch: `main`
- Staging branch: `staging` (server's `field-quotes-staging/` checkout tracks this)
- `.local-backups/` is gitignored — keep backups out of git
- `mockups/index.html` is the friendly landing page that lists every screen
- Initial commit + every subsequent change is signed `Co-Authored-By: Claude Opus 4.7 (1M context)` — keep that convention
