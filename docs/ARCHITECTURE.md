# MHMS — Hotel Harmony Management System: Architecture & Flow

> Master Hotel Management System (v2). Multi-tenant hotel PMS + POS.
> Live at **https://hmsadmin.jazverse.online**
>
> This document maps the **current** system: deployment, request flow, auth,
> which features are wired to the live API vs. the demo store, and the core
> business flows (reservations, POS, billing, night audit).
>
> Diagrams are [Mermaid](https://mermaid.js.org/) — they render automatically on GitHub.

---

## 1. Deployment / Infrastructure

Everything runs as **4 Docker containers** on a single Linode VM (Ubuntu 24.04),
fronted by Nginx with Let's Encrypt SSL.

```mermaid
flowchart TB
    subgraph Internet
        U[Browser / Staff Device]
    end

    subgraph VM["Linode VM · Ubuntu 24.04 · 172.105.41.151"]
        NGINX["Nginx reverse proxy<br/>(SSL termination · Let's Encrypt)"]

        subgraph Docker["Docker Compose network"]
            PORTAL["docker-portal-1<br/>TanStack Start / Nitro SSR<br/>Node :3001"]
            API["docker-api-1<br/>Go 1.22 + Fiber<br/>:8787"]
            PG[("docker-postgres-1<br/>PostgreSQL 16")]
            REDIS[("docker-redis-1<br/>Redis 7")]
        end
    end

    U -- "HTTPS :443" --> NGINX
    NGINX -- "/  (app pages, SSR)" --> PORTAL
    NGINX -- "/api/*" --> API
    API -- "SQL" --> PG
    API -- "cache / sessions" --> REDIS

    EXT1["Razorpay (payments)"]
    EXT2["Email / SMS providers"]
    API -. "outbound" .-> EXT1
    API -. "outbound" .-> EXT2
```

**Key facts**
| Component | Tech | Port | Notes |
|---|---|---|---|
| Portal | TanStack Start, React 19, Nitro SSR, shadcn/ui, Tailwind v4 | 3001 | Built `NITRO_PRESET=node-server`; `.output/` shipped to VM |
| API | Go 1.22 + Fiber | 8787 | Auto-runs `EnsureAppSchema` + SQL migrations on boot |
| DB | PostgreSQL 16 | — | Multi-tenant: `hotel_id` on all tables |
| Cache | Redis 7 | — | Dashboard stats cache, sessions |
| Proxy | Nginx | 443/80 | Routes `/api/*` → API, everything else → Portal |

---

## 2. Request / Data Flow

The browser talks to **one origin** (`hmsadmin.jazverse.online`). Nginx splits
traffic: page requests go to the SSR portal, `/api/*` goes to the Go API. The
React app calls the API with **relative URLs** (same-origin, no CORS).

```mermaid
flowchart LR
    B[Browser SPA]

    subgraph Portal["Portal (Nitro SSR)"]
        ROUTER["TanStack Router<br/>(file-based routes)"]
        RQ["TanStack Query<br/>(server cache)"]
        ZU["Zustand store<br/>mhms-store-v4<br/>(demo / local state)"]
    end

    subgraph Client["src/lib/api"]
        CLIENT["client.ts · apiFetch()<br/>JWT attach · 401 refresh · {data} unwrap"]
        HOOKS["hooks.ts · React Query hooks"]
        AUTH["auth.ts · session store"]
    end

    subgraph GoAPI["Go Fiber API"]
        MW["authGate middleware<br/>(JWT verify · hotel scope)"]
        H["Domain handlers"]
    end

    DB[("PostgreSQL")]

    B --> ROUTER
    ROUTER --> RQ
    ROUTER --> ZU
    RQ --> HOOKS --> CLIENT
    AUTH --> CLIENT
    CLIENT -- "/api/* (Bearer JWT)" --> MW --> H --> DB
```

**Two data sources, by design**
- **Live API** (`TanStack Query` → `apiFetch`) — real persisted data.
- **Demo store** (`Zustand mhms-store-v4`) — local, in-browser fallback so every
  page renders even when not signed in / backend unreachable. Pages show a
  **"Live data" / "Demo data"** badge.

---

## 3. Authentication Flow

JWT-based. Access token (15 min) + refresh token (7 days) in `localStorage`.
`apiFetch` transparently refreshes once on a `401`.

```mermaid
sequenceDiagram
    actor User
    participant UI as Login Page
    participant C as apiFetch (client.ts)
    participant API as Go API /auth
    participant DB as Postgres (users, roles)

    User->>UI: email + password
    UI->>API: POST /api/auth/sign-in
    API->>DB: verify (bcrypt)
    DB-->>API: user + roles + hotel_id
    API-->>UI: { access_token, refresh_token, user }
    UI->>C: setTokens() → localStorage

    Note over C,API: Subsequent requests
    C->>API: GET /api/* (Authorization: Bearer access)
    alt token valid
        API-->>C: 200 { data }
    else 401 expired
        API-->>C: 401
        C->>API: POST /api/auth/refresh (refresh_token)
        API-->>C: new access_token
        C->>API: retry original request → 200
    end
```

**Roles** (`user_roles`): `super_admin`, `hotel_admin`, `front_desk`,
`housekeeping`, `accountant`, `fnb`, `guest`, plus a platform `platform_admin`
flag. The Users page maps these to UI labels (Admin / Manager / Front Desk / …).

---

## 4. Feature Map — Pages ↔ API Domains (Live vs. Demo)

24 portal routes. This shows what each page connects to **today**.

```mermaid
flowchart TB
    subgraph LIVE["✅ Wired to live Go API"]
        direction TB
        DASH["Dashboard /"]
        RES["Reservations<br/>(list · new · detail)"]
        FD["Front Desk"]
        CRM["CRM / Guests"]
        HK["Housekeeping"]
        BILL["Billing & Finance"]
        USERS["Users & Roles"]
    end

    subgraph DEMO["🟡 Demo store only (Zustand)"]
        direction TB
        POS["POS & Restaurant"]
        REST["Restaurant ops"]
        MENU["Menu Management"]
        REP["Reports"]
        NA["Night Audit"]
        REV["Revenue"]
        CH["Channel Manager"]
        BE["Booking Engine"]
        INV["Inventory"]
        PROC["Procurement"]
        MNT["Maintenance"]
        PROP["Properties"]
        ADM["Admin"]
    end

    subgraph APIDOMAINS["Go API handler domains"]
        A_AUTH["/auth"]
        A_DASH["/dashboard"]
        A_RES["/reservations"]
        A_ROOM["/rooms"]
        A_CRM["/crm"]
        A_HK["/housekeeping"]
        A_BILL["/billing"]
        A_USERS["/users"]
        A_NA["/night-audit"]
        A_REV["/revenue"]
        A_CH["/channel"]
        A_BOOK["/booking"]
        A_PROC["/procurement"]
        A_ASSET["/asset"]
        A_REP["/reports"]
        A_AI["/ai"]
        A_PAY["/payments (Razorpay)"]
        A_COMM["/communications"]
        A_PLAT["/platform"]
    end

    DASH --> A_DASH
    RES --> A_RES
    RES --> A_ROOM
    FD --> A_RES
    CRM --> A_CRM
    HK --> A_HK
    BILL --> A_BILL
    USERS --> A_USERS
    USERS --> A_AUTH

    %% Demo pages have matching APIs that are NOT yet wired
    NA -. "available, not wired" .-> A_NA
    REP -. "available, not wired" .-> A_REP
    REV -. "available, not wired" .-> A_REV
    CH -. "available, not wired" .-> A_CH
    BE -. "available, not wired" .-> A_BOOK
    PROC -. "available, not wired" .-> A_PROC
    MNT -. "available, not wired" .-> A_ASSET
    POS -. "available, not wired" .-> A_PAY
```

> **Legend:** solid arrow = live integration; dotted arrow = backend endpoint
> exists but the page still reads/writes the demo store. POS, Reports,
> Night-Audit, Revenue, Channel, Booking-Engine, Inventory, Procurement,
> Maintenance, Properties and Admin are demo-only today.

---

## 5. Reservation Lifecycle (live)

The New Reservation wizard now persists to the API, including **phone** and
**booking source** (Direct / Booking.com / Expedia / MakeMyTrip / Goibibo /
Agoda / Airbnb / Walk-in / Phone / Corporate).

```mermaid
sequenceDiagram
    actor Staff
    participant W as New Reservation Wizard
    participant API as /api/reservations
    participant DB as guest_stays
    participant N as Email/SMS

    Staff->>W: guest, phone, source, room, dates
    W->>API: POST /api/reservations { source, guest_phone, ... }
    API->>DB: INSERT guest_stays (... source)
    DB-->>API: stay row
    API-->>W: 200 → redirect to list

    Note over Staff,DB: Later — Front Desk
    Staff->>API: POST /reservations/:id/checkin
    API->>DB: set actual_check_in · room → occupied
    API->>N: booking confirmation (email + SMS)
    Staff->>API: POST /reservations/:id/checkout
    API->>DB: set actual_check_out · room → cleaning
    API->>N: invoice / thank-you
```

Status is **derived** server-side from timestamps:
`upcoming → pending_checkin → in_house → checked_out`.

```mermaid
stateDiagram-v2
    [*] --> upcoming: created (future check-in)
    upcoming --> pending_checkin: check-in date reached
    pending_checkin --> in_house: POST /checkin
    in_house --> checked_out: POST /checkout
    upcoming --> cancelled: DELETE
    pending_checkin --> cancelled: DELETE
    checked_out --> [*]
```

---

## 6. POS Order Flow (live · Redis-cached)

POS orders are **persisted to the backend** (`pos_orders` table, JSONB line
items) via `/api/pos/orders` when signed in, with a demo-store fallback when
offline. The order list is **cached in Redis** (15s TTL, invalidated on every
write) and polled every 15s for near-real-time KDS / Live Orders. Multi-cart,
KDS stages, table split/merge, refunds and tax depth remain client-side UI on
top of the persisted order.

```mermaid
flowchart TB
    NEW["New Order tab"]
    CART["Cart (per-table snapshot)<br/>item discount · seat · service charge · GST"]
    KOT["Send KOT"]
    KDS["Kitchen Display (KDS)"]
    PAY["Pay / Split / Comp"]
    HIST["History"]

    NEW --> CART
    CART -->|"Send KOT"| KOT --> KDS
    CART -->|"Pay"| PAY --> HIST
    KDS -->|"served"| PAY

    subgraph KDSFLOW["KDS multi-stage (per ticket + per item bump)"]
        S1[New] --> S2[Accepted] --> S3[Preparing] --> S4[Ready] --> S5[Served]
    end
    KDS -.-> KDSFLOW

    subgraph TABLES["Tables tab"]
        T1["Transfer"]
        T2["Split (move items → new table)"]
        T3["Merge (combine tables → one party)"]
    end
    CART -. "drafts per table" .-> TABLES

    HIST -->|"manager PIN"| REF["Refund / Credit Note"]
```

**POS order state (store):** `Open → Sent → Paid`. KDS stages and refund/credit
records are tracked in component state keyed by order id.

---

## 7. Billing Flow (live)

```mermaid
flowchart LR
    GS["guest_stays<br/>(booking)"] --> F["folios"]
    F --> FC["folio_charges<br/>(room, F&B, tax)"]
    F --> P["payments"]
    F --> INV["invoices"]

    UI["Billing page"] -->|"GET /billing/folios"| F
    UI -->|"POST /folios/:id/charges"| FC
    UI -->|"POST /folios/:id/payments"| P
    UI -->|"POST /billing/invoices"| INV
    UI -->|"POST /invoices/:id/email"| MAIL["Email service"]

    F -->|"balance = charges + tax − paid"| UI
```

Payments attach to the **booking** (`guest_stay_id`); when a booking has
multiple folios, completed payments are attributed to the earliest (canonical)
folio to avoid double counting.

---

## 8. Core Data Model (key tables)

```mermaid
erDiagram
    hotels ||--o{ users : "has staff"
    hotels ||--o{ rooms : "has"
    hotels ||--o{ guest_stays : "has bookings"
    users ||--o{ user_roles : "assigned"
    guest_stays }o--|| rooms : "occupies"
    guest_stays ||--o{ folios : "billed via"
    folios ||--o{ folio_charges : "line items"
    guest_stays ||--o{ payments : "settled by"
    folios ||--o{ invoices : "generates"
    hotels ||--o{ guests : "CRM profiles"
    guests ||--o| loyalty_members : "enrolled"
    loyalty_tiers ||--o{ loyalty_members : "tier"

    guest_stays {
        uuid id PK
        uuid hotel_id FK
        string guest_name
        string guest_phone
        string source "Direct / Booking.com / ..."
        date check_in_date
        date check_out_date
        timestamptz actual_check_in
        timestamptz actual_check_out
    }
    folios {
        uuid id PK
        uuid booking_id FK
        string status
    }
    payments {
        uuid id PK
        uuid guest_stay_id FK
        numeric amount
        string payment_method
    }
```

Every tenant-scoped table carries `hotel_id`. Default demo hotel:
`The Grand Demo Hotel` (`00000000-0000-0000-0000-000000000001`).

---

## 9. Build & Deploy Pipeline

```mermaid
flowchart LR
    DEV["Local edit<br/>(portal + golangserver)"]

    subgraph PORTAL_DEPLOY["Portal"]
        B1["npm run build<br/>NITRO_PRESET=node-server"]
        B2["tar .output → scp → VM"]
        B3["docker compose build portal<br/>up -d portal"]
    end

    subgraph GO_DEPLOY["Go API"]
        G1["scp changed .go files → VM"]
        G2["docker compose build api<br/>up -d api"]
        G3["EnsureAppSchema runs on boot<br/>(idempotent DDL + migrations)"]
    end

    GH["git push → GitHub"]
    VC["Vercel auto-build<br/>(preview; domain serves from VM)"]

    DEV --> B1 --> B2 --> B3
    DEV --> G1 --> G2 --> G3
    DEV --> GH --> VC
```

> Note: `hmsadmin.jazverse.online` DNS points at the **VM** (Docker), not Vercel.
> Vercel builds on push for preview only; production traffic is served by the VM.

---

## 10. Summary — What's Real vs. Demo (today)

| Area | Status |
|---|---|
| Auth, JWT, roles | ✅ Live |
| Dashboard, Reservations, Front Desk, CRM, Housekeeping | ✅ Live |
| Billing (folios/charges/payments/invoices), Users | ✅ Live |
| Booking source (OTA) on reservations | ✅ Live |
| POS orders (`pos_orders`, Redis-cached) | ✅ Live |
| POS KDS stages, split/merge, refunds, tax depth | 🟡 Client-side UI over the persisted order |
| Reports, Night Audit, Revenue, Channel Mgr, Booking Engine | 🟡 Demo — backend endpoints exist, not wired |
| Inventory, Procurement, Maintenance, Properties, Admin | 🟡 Demo |

**Biggest next integration:** post POS F&B + room-charge to guest folios
(closes the POS ↔ Billing loop), and persist KDS stage / refund records.

---
*Generated as a snapshot of the system on this branch. Update alongside feature changes.*
