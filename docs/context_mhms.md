<!-- REDACTED COPY for the public repo. Infrastructure details (VM IP, SSH/LISH
     endpoints, server paths, provider labels, credentials) are replaced with
     placeholders. The full operational runbook is kept private outside this repo. -->

# MHMS v2 — Full Operational Context

Last updated: 2026-06-17

Single source of truth for developing, building, deploying, and maintaining MHMS v2. Read this at the start of every session.

---

## Repos & Live URLs

| Item | URL |
|---|---|
| **Admin portal — GitHub** | https://github.com/jasmeet15069/HmsAdminStaffPortal |
| **Admin portal — Vercel project** | https://vercel.com/jasmeet15069s-projects/hms-admin-staff-portal |
| **Admin portal — live domain** | https://hmsadmin.jazverse.online |
| **Master admin alias** | https://hmsmasteradmin.jazverse.online |
| **Go API (via nginx)** | https://hmsadmin.jazverse.online/api |
| **Client portal** | https://hmsclient.jazverse.online (Vercel) |
| Go server — no GitHub repo yet | — |

### How the three admin portal URLs relate

```
GitHub (HmsAdminStaffPortal)
  └── push to main
        └── Vercel auto-builds & deploys (Vercel project: hms-admin-staff-portal)
              └── hmsadmin.jazverse.online → served by VM nginx → Docker portal container
```

- `hmsadmin.jazverse.online` DNS points to **VM IP `<VM_IP>`**, NOT Vercel.
- Nginx on the VM proxies `/*` to the Docker SSR container (port 3001).
- Vercel builds the code on every push but **the domain currently serves from VM Docker**.
- `vite.config.ts` has a Nitro `routeRules` proxy: `/api/**` → `https://hmsadmin.jazverse.online/api/**` so if the domain ever switches to Vercel the API calls still reach the VM Go server.

---

## Project Overview

MHMS v2 replaces a v1 binary-deployed system with a fully Dockerized stack on the Jazverse VM.

| Component | Technology | Exposed port |
|---|---|---|
| `golangserver` | Go 1.22 + Fiber, PostgreSQL 16, Redis 7 | 127.0.0.1:8787 |
| `HMS admin portal` | TanStack Start (React 19 + Nitro SSR), Tailwind v4, shadcn/ui | 127.0.0.1:3001 |
| Nginx | SSL termination, reverse proxy | 80 / 443 |
| PostgreSQL | Docker-managed, volume-persisted | internal only |
| Redis | Docker-managed | internal only |

**Traffic flow (VM):**

```
Browser → hmsadmin.jazverse.online (nginx, HTTPS)
  /api/*  →  127.0.0.1:8787  (Go API Docker container)
  /*      →  127.0.0.1:3001  (Nitro SSR portal Docker container)
```

---

## Local Paths

| Item | Path |
|---|---|
| Project root | `C:\Users\ACXIOM\Desktop\claude\MHMS_final` |
| Go API server | `C:\Users\ACXIOM\Desktop\claude\MHMS_final\golangserver` |
| Admin portal | `C:\Users\ACXIOM\Desktop\claude\MHMS_final\HMS admin portal` |
| Docker Compose (prod) | `golangserver\deployments\docker\docker-compose.prod.yml` |
| Go Dockerfile | `golangserver\deployments\docker\Dockerfile` |
| Portal Dockerfile | `HMS admin portal\Dockerfile` |
| Nginx config (local copy) | `golangserver\deployments\nginx\hmsadmin.jazverse.online.conf` |
| Env template | `golangserver\.env.production.example` |
| Deploy script | `deploy-vm.sh` |
| This file | `context_mhms.md` |
| Jazverse private context | `C:\Users\ACXIOM\Desktop\context-private\docs\jazverse.md` |

---

## VM / SSH Reference

| Item | Value |
|---|---|
| SSH | `ssh <SSH_USER>@<VM_IP>` |
| Provider | Linode — <LINODE_LABEL> — Mumbai |
| OS | Ubuntu 24.04 LTS |
| RAM / Disk | 4 GB RAM / 80 GB |
| IPv4 | `<VM_IP>` |
| LISH console | `ssh -t <LISH_USER>@<LISH_HOST> <LINODE_LABEL>` |

### Remote paths on VM

| Item | Path |
|---|---|
| MHMS v2 root | `<REMOTE_ROOT>` |
| Go API source | `<REMOTE_ROOT>/golangserver` |
| Admin portal source | `<REMOTE_ROOT>/HMS admin portal` |
| Compose file | `<REMOTE_ROOT>/golangserver/deployments/docker/docker-compose.prod.yml` |
| Go API env | `<REMOTE_ROOT>/golangserver/.env` |
| Nginx config | `/etc/nginx/sites-available/hmsadmin.jazverse.online` |
| Nginx symlink | `/etc/nginx/sites-enabled/hmsadmin.jazverse.online` |
| SSL cert dir | `/etc/letsencrypt/live/hmsadmin.jazverse.online/` |
| SSL expiry | **2026-09-15** |

---

## Docker Containers

All managed by `docker-compose.prod.yml`. Docker Compose project name = `docker`.

| Container | Image | Port binding |
|---|---|---|
| `docker-postgres-1` | `postgres:16-alpine` | internal only |
| `docker-redis-1` | `redis:7-alpine` | internal only |
| `docker-api-1` | built from `golangserver/` | `127.0.0.1:8787` |
| `docker-portal-1` | built from `HMS admin portal/` | `127.0.0.1:3001` |

### Docker commands (run on VM)

```bash
ssh <SSH_USER>@<VM_IP>
cd <REMOTE_ROOT>/golangserver/deployments/docker
set -a && source ../../.env && set +a          # always source .env first

docker compose -f docker-compose.prod.yml ps                        # status
docker compose -f docker-compose.prod.yml logs -f api               # API logs
docker compose -f docker-compose.prod.yml logs -f portal            # portal logs
docker compose -f docker-compose.prod.yml logs -f postgres          # DB logs
docker compose -f docker-compose.prod.yml restart portal            # restart one
docker compose -f docker-compose.prod.yml build portal              # rebuild image
docker compose -f docker-compose.prod.yml up -d portal              # start/restart
docker compose -f docker-compose.prod.yml up -d --build             # rebuild all
docker compose -f docker-compose.prod.yml down                      # stop all
```

---

## Go API (golangserver)

- **Module:** `github.com/hotelharmony/api`
- **Framework:** Fiber
- **Port:** 8787
- **DB:** PostgreSQL 16 (Docker service name `postgres` — use this as hostname, not `localhost`)
- **Cache:** Redis 7 (service name `redis`)
- **Auto-migration:** `EnsureAppSchema()` on boot — 7 SQL files in `migrations/`, tracked via `schema_migrations`
- **Health:** `GET /health`
- **All routes:** prefixed `/api/`
- **GitHub:** no repo yet

### Required `.env` keys

```env
APP_ENV=production
POSTGRES_PASSWORD=<db_password>
DATABASE_URL=postgres://hotel:<db_password>@postgres:5432/hotel_harmony?sslmode=disable
REDIS_URL=redis://redis:6379/0
JWT_ACCESS_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars>
FRONTEND_URL=https://hmsadmin.jazverse.online
SMTP_PASSWORD="<app password>"    # quote if it contains spaces — bare spaces break `source .env`
```

Full template: `golangserver/.env.production.example`

### Backend auth & tenant isolation (IMPORTANT — security-significant)

Authentication is stateless JWT (HS256, `JWT_ACCESS_SECRET`). The middleware is
`authGate(secret)` in `internal/handler/authctx.go`, mounted in
`internal/handler/router.go`.

- **Route ordering is security-significant.** `authGate` is Fiber group
  middleware (`api.Use(authGate(secret))`), and Fiber only applies it to routes
  registered **after** the mount point. So `router.go` is split into two blocks:
  public/self-authenticating handlers (Auth, Hotels, Payments, AI, Compat) are
  registered first, then `api.Use(authGate(secret))`, then every staff-only
  handler. **Do not register a route that must be public after the gate, or one
  that must be protected before it.** Mounting the gate at the very top breaks
  login (`/api/auth/sign-in` would 401).
- **Tenant resolution & the demo fallback.** Handlers derive the tenant via a
  `hotelID(c)` helper that reads the JWT `hotel_id` claim and **falls back to
  `postgres.DemoHotelID` when absent**. Because of this fallback, an *ungated*
  staff endpoint silently serves the demo tenant's real data to anyone. Every
  tenant-scoped SQL query MUST bind `hotel_id` (SELECT `WHERE hotel_id = $1`,
  INSERT the caller's `h.hotelID(c)`, UPDATE/DELETE `AND hotel_id = $N`).
- **Compat layer** (`/api/tables/:table`, `compat_handler.go`) is auth-gated
  per-method and tenant-scoped via the `scopeHotel(c, alias)` helper +
  `compatTenantScopedTables` set. `profiles`/`user_roles` have no `hotel_id`
  column and are intentionally not tenant-filtered.
- **Role checks:** `requireHotelAdmin` / `roleGate` enforce `platform_admin`,
  `hotel_admin`, or `super_admin` for admin-only writes (e.g. payment settings).
- **Known remaining gap:** role-portal settings (`/api/settings/role-portals`)
  still hardcode `DemoHotelID` — auth-gated (not a leak) but not yet
  multi-tenant-correct.

When adding a handler: decide public vs staff, register it on the correct side
of the `authGate` line, and bind `hotel_id` in every query.

---

## Admin Portal (HMS admin portal)

- **Framework:** TanStack Start (React 19 + Vite 7 + Nitro SSR)
- **Router / Query:** TanStack Router + TanStack Query
- **UI:** shadcn/ui + Tailwind v4
- **Node required:** ≥ 22.12.0 (VM runs Node 20 → **always build locally**)
- **Build preset for VM:** `NITRO_PRESET=node-server`
- **Build preset for Vercel:** handled automatically by `vite.config.ts` (`NITRO_PRESET=vercel` when `VERCEL=1`)
- **API URL:** `VITE_API_URL=` (empty) → all calls are relative `/api/...` → nginx/Nitro proxy handles routing

### Auth guard (`AppShell.tsx`)

- `isAuthenticated()` checks localStorage JWT + Zustand store
- Guard runs **after mount** only — SSR has no localStorage; running before mount causes hydration mismatch
- Unauthenticated → redirect to `/login`
- Authenticated on `/login` → redirect to `/`
- Before mount: renders `null` (blank screen) — prevents flash of portal to unauthenticated users

### Nitro API proxy (`vite.config.ts`)

```ts
routeRules: {
  "/api/**": { proxy: "https://hmsadmin.jazverse.online/api/**" },
}
```

This makes Vercel's SSR server proxy API requests to the VM Go API, so the portal works on both VM Docker and Vercel without CORS issues.

### Portal Dockerfile

- Base: `node:22-alpine`
- Copies only `.output/` — does NOT run `npm install`
- **`server/node_modules/tslib` must be present** in `.output/` or portal crashes with `ERR_MODULE_NOT_FOUND`
- Never exclude `server/node_modules` when tarballing `.output/`

---

## Step-by-Step: Push Changes to GitHub (Portal)

The admin portal repo already exists with a remote connected.

```bash
cd "C:\Users\ACXIOM\Desktop\claude\MHMS_final\HMS admin portal"

# Check what changed
git status
git diff --stat HEAD

# Stage specific files (never use git add -A blindly)
git add src/routes/index.tsx src/components/AppShell.tsx vite.config.ts
# Add other changed files as needed

# Commit
git commit -m "feat: <what you changed>"

# Push — Vercel auto-builds on push to main
git push origin main
```

### What to commit vs skip

| File/folder | Commit? | Reason |
|---|---|---|
| `src/**` | Yes | source code |
| `vite.config.ts`, `package.json` | Yes | config |
| `.env.production` | Yes | only contains `VITE_API_URL=` (not secret) |
| `Dockerfile` | Yes | VM Docker build |
| `.gitignore` | Yes | |
| `.output/` | **No** | build artifact — ship to VM separately |
| `node_modules/` | **No** | |
| `golangserver/.env` | **Never** | real secrets |

### After pushing — what auto-deploys

- **Vercel** rebuilds automatically (uses `NITRO_PRESET=vercel`)
- **VM Docker** does NOT auto-deploy — must manually rebuild portal container (see portal update steps below)

---

## Step-by-Step: Portal Update on VM (Most Common Task)

Run after any frontend source change, in addition to (or instead of) the git push.

### 1. Edit source

```
C:\Users\ACXIOM\Desktop\claude\MHMS_final\HMS admin portal\src\
```

### 2. Build locally (Node 22+ required)

```powershell
cd "C:\Users\ACXIOM\Desktop\claude\MHMS_final\HMS admin portal"
$env:NITRO_PRESET = "node-server"
$env:VITE_API_URL = ""
npm run build
```

Verify output:

```powershell
ls .output\server\node_modules\    # must contain: tslib
ls .output\server\                 # must contain: index.mjs, _ssr\
```

### 3. Package and upload

```bash
# Git Bash
cd "C:/Users/ACXIOM/Desktop/claude/MHMS_final/HMS admin portal"
tar -czf /tmp/portal-output.tar.gz .output/
scp /tmp/portal-output.tar.gz <SSH_USER>@<VM_IP>:/tmp/portal-output.tar.gz
```

### 4. Extract on VM

```bash
ssh <SSH_USER>@<VM_IP>
cd "<REMOTE_ROOT>/HMS admin portal"
rm -rf .output
tar -xzf /tmp/portal-output.tar.gz
ls .output/server/node_modules/    # must show: tslib
```

### 5. Rebuild Docker image and restart

```bash
cd <REMOTE_ROOT>/golangserver/deployments/docker
set -a && source ../../.env && set +a
docker compose -f docker-compose.prod.yml build portal
docker compose -f docker-compose.prod.yml up -d portal
```

### 6. Verify

```bash
sleep 20
docker ps --filter name=portal --format "table {{.Names}}\t{{.Status}}"
# Up ... (healthy)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/
# 200
```

---

## Step-by-Step: Go API Update on VM

### 1. Edit source

```
C:\Users\ACXIOM\Desktop\claude\MHMS_final\golangserver\
```

### 2. Upload to VM

Single file:
```bash
scp "C:/Users/ACXIOM/Desktop/claude/MHMS_final/golangserver/internal/path/file.go" \
    <SSH_USER>@<VM_IP>:<REMOTE_ROOT>/golangserver/internal/path/
```

Full resync (safer for multiple files):
```bash
rsync -av --exclude='.env' --exclude='vendor/' \
  "C:/Users/ACXIOM/Desktop/claude/MHMS_final/golangserver/" \
  <SSH_USER>@<VM_IP>:<REMOTE_ROOT>/golangserver/
```

### 3. Rebuild and restart

```bash
ssh <SSH_USER>@<VM_IP>
cd <REMOTE_ROOT>/golangserver/deployments/docker
set -a && source ../../.env && set +a
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d api
```

### 4. Verify

```bash
docker compose -f docker-compose.prod.yml logs api --tail 30
curl -s http://localhost:8787/health
```

---

## Step-by-Step: Full Fresh Deployment (new VM / from scratch)

### 1. Install Docker on VM

```bash
ssh <SSH_USER>@<VM_IP>
apt-get update -qq
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -qq
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
```

### 2. Upload source

```bash
# Upload Go server
scp -r "C:/Users/ACXIOM/Desktop/claude/MHMS_final/golangserver" \
    <SSH_USER>@<VM_IP>:<REMOTE_ROOT>/

# Upload portal Dockerfile (source stays local — only .output/ goes to VM)
scp "C:/Users/ACXIOM/Desktop/claude/MHMS_final/HMS admin portal/Dockerfile" \
    <SSH_USER>@<VM_IP>:"<REMOTE_ROOT>/HMS admin portal/Dockerfile"

# Build portal locally then upload artifact (see portal update steps)
```

### 3. Configure `.env` on VM

```bash
ssh <SSH_USER>@<VM_IP>
cp <REMOTE_ROOT>/golangserver/.env.production.example \
   <REMOTE_ROOT>/golangserver/.env
nano <REMOTE_ROOT>/golangserver/.env
# Fill all values. Quote SMTP_PASSWORD if it has spaces.
```

### 4. Issue SSL certificate

```bash
ssh <SSH_USER>@<VM_IP>
# Temp nginx config for ACME challenge
cat > /etc/nginx/sites-available/hmsadmin.jazverse.online <<'EOF'
server {
    listen 80;
    server_name hmsadmin.jazverse.online;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
EOF
ln -sf /etc/nginx/sites-available/hmsadmin.jazverse.online \
       /etc/nginx/sites-enabled/hmsadmin.jazverse.online
nginx -t && systemctl reload nginx

certbot certonly --nginx -d hmsadmin.jazverse.online \
  --non-interactive --agree-tos --email masterhotel.vaibhav2025@gmail.com
```

### 5. Deploy nginx config

```bash
ssh <SSH_USER>@<VM_IP>
cp <REMOTE_ROOT>/golangserver/deployments/nginx/hmsadmin.jazverse.online.conf \
   /etc/nginx/sites-available/hmsadmin.jazverse.online
nginx -t && systemctl reload nginx
```

### 6. Start Docker stack

```bash
ssh <SSH_USER>@<VM_IP>
cd <REMOTE_ROOT>/golangserver/deployments/docker
set -a && source ../../.env && set +a
docker compose -f docker-compose.prod.yml up -d --build
```

### 7. Verify everything

```bash
docker compose -f docker-compose.prod.yml ps        # all 4 containers healthy
curl -s http://localhost:8787/health                # Go API
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/   # portal
curl -s -o /dev/null -w "%{http_code}" https://hmsadmin.jazverse.online/
```

---

## Step-by-Step: Add New Users to Live System

Users must be created via the API — do NOT insert directly into DB (FK constraints break).

```bash
# 1. Sign up
curl -X POST https://hmsadmin.jazverse.online/api/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123","full_name":"Full Name"}'

# 2. Get admin JWT (sign in first)
curl -X POST https://hmsadmin.jazverse.online/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass"}'
# Response is wrapped: access_token is at .data.access_token

# 3. Assign role (POST .../roles — NOT PATCH .../role)
curl -X POST https://hmsadmin.jazverse.online/api/users/<user_id>/roles \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"role":"manager"}'
```

> Auth route names are `sign-up` / `sign-in` / `sign-out` / `refresh` (NOT `signup`/`login`). The API wraps every response in `{"data": ...}`.

---

## Dashboard Data Sources

All widgets use live API data. Falls back to demo store (`useMHMS`) only when not authenticated or API is unreachable.

| Widget | Live API endpoint | Fallback |
|---|---|---|
| Occupancy %, Rooms, ADR, RevPAR | `GET /api/dashboard/stats` | `useMHMS` rooms |
| Today's Arrivals / Departures | `GET /api/dashboard/stats` | `useMHMS` reservations |
| In-House Guests | `GET /api/dashboard/stats` | `useMHMS` reservations |
| Staff on Duty hint | `GET /api/dashboard/stats` → `staff_clocked_in` | 0 |
| Open Tickets | `GET /api/dashboard/stats` → `pending_complaints` | 0 |
| Total Revenue MTD | Sum of `GET /api/dashboard/data` → `department_revenue[].current` | today's revenue |
| 7-day chart (occupancy + revenue) | `GET /api/dashboard/data` → `occupancy_trend` + `revenue_trend` | zeros |
| Room Status Pie | `GET /api/rooms` grouped by status | `useMHMS` rooms |
| Department Revenue bar | `GET /api/dashboard/data` → `department_revenue` | empty |
| Pending Housekeeping list | `GET /api/housekeeping/tasks` | `useMHMS` tasks |

---

## Common Troubleshooting

### Portal HTTP 500 after container restart

`tslib` missing from image:

```bash
docker logs docker-portal-1 --tail 30
# ERR_MODULE_NOT_FOUND: Cannot find package 'tslib'
```

Fix: re-tar `.output/` without excluding `server/node_modules`, re-upload, rebuild.

### API container unhealthy

Healthcheck uses `/dev/tcp` (no wget/curl in Alpine). Check:

```bash
docker logs docker-api-1 --tail 50
```

Common causes:
- `DATABASE_URL` uses `localhost` instead of `postgres` (Docker service name)
- Postgres container still starting — wait 10s and retry
- Migration FK violation on first seed — check logs for SQL error

### `source .env` fails — "command not found"

A value contains unquoted spaces (usually `SMTP_PASSWORD`):

```bash
sed -i 's/^SMTP_PASSWORD=<SMTP_APP_PASSWORD>$/SMTP_PASSWORD="<SMTP_APP_PASSWORD>"/' \
  <REMOTE_ROOT>/golangserver/.env
```

### nginx `[warn] duplicate MIME type "text/html"`

Harmless — nginx default config already includes `text/html` in gzip_types. No action needed.

### nginx `conflicting server name "hmsmasteradmin.jazverse.online"`

Harmless — that domain has its own config file. No action needed.

### nginx `http2 on;` parse error

Nginx 1.24 (Ubuntu 24.04) does not accept standalone `http2 on;`:

```nginx
listen 443 ssl http2;   # correct
# NOT:  listen 443 ssl;  http2 on;
```

### Docker compose: `POSTGRES_PASSWORD variable is not set`

Must source `.env` before every compose command:

```bash
set -a && source ../../.env && set +a
```

### Portal blank page for unauthenticated users (expected)

`AppShell.tsx` returns `null` before mount — intentional to prevent hydration mismatch. After mount it redirects to `/login`.

### Login broke / every endpoint returns 401 after a router change

Almost always the `authGate` was registered in the wrong position in
`internal/handler/router.go`. Fiber applies `api.Use(authGate(secret))` to every
route registered **after** it. If you mount it too early (e.g. before
`h.Auth.Register`), even `/api/auth/sign-in` is gated → nobody can log in. Fix:
keep all public handlers above the `api.Use(authGate(secret))` line and all
staff handlers below it. See the Backend auth & tenant isolation section.

### A staff endpoint returns data without a token (data leak)

The handler is registered before the `authGate` line (or doesn't self-check) and
its queries fall back to `hotelID()` → `DemoHotelID`. Move the handler below the
gate and ensure every query binds `hotel_id`.

### SSL cert renewal

```bash
ssh <SSH_USER>@<VM_IP>
certbot renew --dry-run      # test
certbot renew                # renew
systemctl reload nginx
# Auto-renews via systemd: systemctl status certbot.timer
```

Current expiry: **2026-09-15**

---

## Nginx Config Reference

File: `/etc/nginx/sites-available/hmsadmin.jazverse.online`

```nginx
server {
    listen 443 ssl http2;                          # inline http2 — not "http2 on;"
    server_name hmsadmin.jazverse.online;
    ssl_certificate     /etc/letsencrypt/live/hmsadmin.jazverse.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hmsadmin.jazverse.online/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:8787;          # Go API
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;          # Nitro SSR portal
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

After any change: `nginx -t && systemctl reload nginx`

---

## Key Technical Decisions

| Decision | Reason |
|---|---|
| `NITRO_PRESET=node-server` for VM | `static` preset prerender fails — no live API during build → 404 on all routes |
| Build portal locally, ship `.output/` | VM has Node 20; TanStack Start requires Node ≥ 22.12.0 |
| `VITE_API_URL=` empty | All API calls relative `/api/...`; no CORS; works on both VM (nginx proxy) and Vercel (Nitro routeRules proxy) |
| Nitro `routeRules` proxy in vite.config | Vercel SSR must proxy `/api/**` to VM Go API — there is no nginx on Vercel |
| Auth guard client-side only | SSR has no localStorage; guard before mount = hydration mismatch |
| Docker internal network | Go API talks to `postgres` hostname, not `localhost`; services isolated from host |
| `/dev/tcp` healthcheck | Alpine has no `wget`/`curl`; bash built-in TCP check works without extra packages |
| MTD revenue = sum of dept current | No dedicated MTD stats endpoint; `department_revenue` query already sums current month per category |
| Create users via API not raw SQL | DB FK constraints (profiles, roles) require the signup flow to run in sequence |
| Staff endpoints gated by one `api.Use(authGate)` line | Fiber applies group middleware only to routes registered after it — public handlers go before the gate, staff handlers after (see Backend auth section) |
| Tenant resolved from JWT, demo-hotel fallback | `hotelID(c)` returns `DemoHotelID` when the token has no `hotel_id`; every query must still bind `hotel_id` so an ungated/unscoped endpoint can't leak the demo tenant |

---

## Quick Reference

```bash
# SSH
ssh <SSH_USER>@<VM_IP>

# Container status
ssh <SSH_USER>@<VM_IP> 'docker ps'

# Logs
ssh <SSH_USER>@<VM_IP> 'docker logs docker-portal-1 --tail 50'
ssh <SSH_USER>@<VM_IP> 'docker logs docker-api-1 --tail 50'

# Reload nginx
ssh <SSH_USER>@<VM_IP> 'nginx -t && systemctl reload nginx'

# SSL expiry
ssh <SSH_USER>@<VM_IP> 'certbot certificates'

# Smoke test
curl -s -o /dev/null -w "portal: %{http_code}\n" https://hmsadmin.jazverse.online/
curl -s -o /dev/null -w "api:    %{http_code}\n" https://hmsadmin.jazverse.online/api/health

# Git push (portal)
cd "C:\Users\ACXIOM\Desktop\claude\MHMS_final\HMS admin portal"
git add <files> && git commit -m "feat: ..." && git push origin main
# → Vercel auto-builds after push
```
