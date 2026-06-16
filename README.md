# HmsAdminStaffPortal

Admin & staff portal for the **Hotel Harmony / MHMS** hotel-management suite.
Built with TanStack Start (React 19, SSR), TanStack Router + Query, Tailwind v4
and shadcn/ui. It connects to the **golangserver** (`hms_golangserver`) Fiber +
PostgreSQL API.

## Connecting to the backend

The portal talks to the Go API via a typed client. Configure the base URL with
an environment variable:

```bash
# .env
VITE_API_URL=http://localhost:8787   # golangserver default port
```

Auth uses JWT: the login page calls `POST /api/auth/sign-in`, stores the access
& refresh tokens, sends `Authorization: Bearer <token>` on every request, and
transparently refreshes on a 401. When signed out (or the backend is
unreachable) pages fall back to a local demo dataset so the UI stays usable.

Integration code lives in [`src/lib/api/`](src/lib/api):

| File | Purpose |
|------|---------|
| `client.ts` | fetch wrapper: base URL, Bearer auth, `{ data }` envelope unwrap, 401 refresh |
| `auth.ts`   | sign-in / sign-out store (Zustand, persisted) |
| `types.ts`  | TypeScript mirrors of the Go API JSON shapes |
| `hooks.ts`  | React Query hooks: dashboard, rooms, reservations, CRM guests, housekeeping |

The **Dashboard** is wired to live data (`/api/dashboard/stats` + `/data`) with
demo fallback. Hooks for rooms, reservations, guests and housekeeping are ready
to drop into their pages.

## Develop

```bash
npm install
npm run dev      # http://localhost:8080 (or next free port)
npm run build    # production build
npm run lint     # eslint + prettier
```

## Requirements

- Node 18+ (developed on Node 25) — or Bun.
- The golangserver running and reachable at `VITE_API_URL`.
