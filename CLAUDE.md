# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**Figus Change Hub** is a mobile-first PWA for tracking a sticker album
(**"Usa Mex Can 26"** World Cup collection) and swapping duplicates with other
people. It works in two modes:

1. **Static-only** (no server): everything lives in the browser's
   `localStorage`; sharing happens via self-contained links or pasted text that
   go person-to-person.
2. **Server + database** (Docker): additionally enables a **Comunidad**
   ("community wall") where each person publishes their list to a Postgres DB
   and others find/compare against it instantly.

There is **no build step** and **no framework**. The frontend is plain
HTML/CSS/vanilla JS loaded directly via `<script>` tags. The backend is a small
Express server.

## Language & conventions

- **All user-facing text, code comments, commit messages, and docs are in
  Spanish** (Rioplatense/Argentine: "vos", "figuritas", "álbum"). Keep writing
  in Spanish to match — do not switch the codebase to English.
- Vanilla JS, no transpilation. Frontend files are plain browser scripts (not
  ES modules — they share globals like `ALBUM`, `APP_VERSION`, helper `$`/`$$`).
  The **server** (`server/index.js`) *is* an ES module (`"type": "module"`).
- Short helper names (`$`, `$$`, `load`, `save`, `toast`) and `localStorage`
  keys namespaced `fch:v1:*`.
- No test suite, no linter config. Verify changes by opening `index.html` or
  running the Docker stack.

## Layout

```
index.html              Page structure; loads data.js then app.js. Also holds the app version as a literal in the footer (#app-version)
legal.html              Standalone legal page (privacy / trademark disclaimer / liability); linked from the footer
data.js                 Album definition: sections, teams, emojis, sticker ranges → globals ALBUM, ALBUM_NAME, ALBUM_TOTAL
app.js                  All client logic (~950 lines): state, album render, import/export, share links, trade matching, community, PWA
styles.css              Mobile-first, dark-mode styles
sw.js                   Service worker (offline app-shell caching)
manifest.webmanifest    PWA manifest
icon-192.png / icon-512.png / apple-touch-icon.png   PWA icons (force-committed despite *.png in .gitignore)

server/
  index.js              Express server: serves static site + /api/collections CRUD, Postgres-backed
  package.json          Deps: express, pg (ESM, `npm start` → node index.js)

Dockerfile              node:20-alpine image for the web service
docker-compose.yml      Base stack (web + db + optional cloudflared); NO published ports — production-safe
docker-compose.override.yml   Dev-only: publishes WEB_PORT (default 8080) to the host
prod.sh                 Production deploy: git pull, generate secure .env, up without ports
.github/workflows/deploy.yml   Deploy on push to main via self-hosted runner → runs prod.sh
.env.example            Config template
```

## Key architecture

### Album model (`data.js`)
`ALBUM` is an array of sections, each `{ id, label, emoji, stickers: [...], optional? }`.
Three groups are concatenated: `SPECIAL_SECTIONS` (FWC intro), `TEAM_SECTIONS`
(one per national team, stickers 1–20), `CLOSING_SECTIONS` (Coca-Cola, 14
stickers, `optional: true`). To adjust the real-world album, edit the arrays —
the app adapts automatically. Any section flagged `optional: true` is added to
the "count optional stickers in totals" checkbox.

### Client state (`app.js`)
- `counts` = `{ sectionId: { sticker: count } }`, persisted to
  `localStorage['fch:v1:counts']`. Count 0 = missing, 1 = have, ≥2 = duplicate.
- Profile (name/contact) in `fch:v1:profile`; UI prefs in `fch:v1:ui`;
  publish info (id + editToken) in `fch:v1:published`.
- **Share links** encode the whole collection + contact into a base64 URL hash
  (no server). `encodeState`/`parseIncoming`/`buildShareLink`. Also parses the
  plain-text "Me faltan / Repetidas" export format (`parseTextList`).
- **Trade matching** (`computeTrades`): "le pedís" = what you're missing and
  they have spare; "le das" = your duplicates they need.
- Online features gate on `ONLINE` (http/https protocol) and API health.

### Server API (`server/index.js`)
Serves the static site from `STATIC_DIR` (default repo root) and exposes:
- `GET  /api/health`
- `GET  /api/admin/telemetry` — métricas agregadas de la comunidad (solo admin;
  requiere header `x-admin-token` = `ADMIN_TOKEN`; 503 si no está configurado)
- `GET  /api/admin/collections` — lista de publicaciones para moderar (solo admin)
- `DELETE /api/admin/collections/:id` — borra cualquier publicación sin `editToken` (solo admin)
- `GET  /api/collections` — list (max 200, newest first)
- `GET  /api/collections/:id`
- `POST /api/collections` — publish → returns `{ id, editToken }`
- `PUT  /api/collections/:id` — update (requires `editToken`)
- `DELETE /api/collections/:id` — delete (requires `editToken`)

Single `collections` table auto-created on boot (`initDb`, retries waiting for
Postgres). `editToken` (UUID) is the only auth — stored client-side; without it
nobody can edit/delete a publication. Input is sanitized in `clean`/`validData`
(string length caps; counts clamped 0–99). Connects via `DATABASE_URL` or
discrete `PG*` env vars.

## Versioning — read before shipping

The app version is **hard-coded as a literal in the footer of `index.html`**
(`<span id="app-version">v1.1.3</span>`) — this is the **single source of
truth**. There is no `version.js` or any separate version/config file. The value
flows outward from that one span:
- **Display**: it's already visible in the footer as plain HTML.
- **Service worker**: `app.js` reads the span from the DOM
  (`#app-version`), strips the leading `v`, and registers the SW as
  `sw.js?v=1.1.3`. `sw.js` reads that `?v=` from its own registration URL
  (`new URL(self.location).searchParams.get('v')`) and uses it to name its cache
  (`fch-shell-vX.Y.Z`). Bumping the footer therefore changes the SW URL, so the
  browser always detects the new SW, drops old caches, and serves fresh files.
- **Update prompt**: the new SW self-activates (`skipWaiting` +
  `clients.claim`) and the page reloads once ("✨ Hay una versión nueva").

**When you ship any user-visible change, edit the version literal in
`index.html`'s footer** following semver (patch = fixes, minor = compatible
features, major = big changes). It's the only place to touch. State is safe
across SW updates because it all lives in `localStorage`.

## Gotchas — read carefully

- **Adding a new root static file requires THREE edits**, or it will break in
  production / offline:
  1. Reference it in `index.html` (or wherever it's used).
  2. Add it to the `SHELL` array in `sw.js` (so it's cached for offline).
  3. Add it to the `COPY` lines in `Dockerfile` (so it ships in the image).
- Script load order in `index.html` matters: `data.js` → `app.js` (app.js
  depends on the `ALBUM`/`ALBUM_NAME`/`ALBUM_TOTAL` globals data.js defines).
- The SW never caches `/api/...` (community must be live data).
- Icons are `*.png` but explicitly un-ignored in `.gitignore`/`.dockerignore` —
  keep those negation rules if you add PWA assets.

## Running it

**Static only:** open `index.html` in a browser (community panel just won't
appear). Any static host (e.g. GitHub Pages serving the repo root) works.

**Full stack (dev):**
```bash
cp .env.example .env        # optional
docker compose up -d --build   # applies override → http://localhost:8080
```

**Production:** `./prod.sh` (deploys from `main`, or `DEPLOY_BRANCH`). No host
ports are published — expose it via Cloudflare Tunnel (set `TUNNEL_TOKEN` in
`.env` to auto-run `cloudflared` → `web:3000`). Auto-deploys on push to `main`
through the self-hosted runner in `.github/workflows/deploy.yml` (needs the
`DEPLOY_DIR` repo variable).

## Config (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `WEB_PORT` | `8080` | Local dev port (not published in prod) |
| `POSTGRES_USER` | `figus` | DB user |
| `POSTGRES_PASSWORD` | `figus` | DB password (prod.sh generates a secure one) |
| `POSTGRES_DB` | `figus` | DB name |
| `ADMIN_TOKEN` | — | Clave del menú de Admin (telemetría). Sin valor, el panel queda deshabilitado. prod.sh genera una segura si falta y la muestra en consola al ejecutarse |
| `TUNNEL_TOKEN` | — | Cloudflare Tunnel token; if set, prod.sh runs cloudflared |
