# NovaTech Hub

A production-grade, community-driven gadget review & rating platform. Think "write honest reviews, earn the trust of the crowd" — ratings are **computed live from the database**, never faked, never cached.

Built as an npm-workspaces monorepo: a TypeScript-first Express + Prisma + PostgreSQL API, a React 18 + Vite web client, and a shared Zod contract package that guarantees the two can never drift apart.

---

## Features

- **Community reviews, computed live** — every average, histogram, and "trending" score is a Postgres aggregate over *visible* reviews at request time. Nothing is seeded into the response.
- **Honest-by-construction ratings** — one review per user per product (`@@unique([productId, userId])`), a 1–10 rating scale, and admin moderation that *suspends* (never deletes) offending reviews so the numbers keep reflecting reality.
- **Trending with a visible formula** — each product ships a score *and* a readable breakdown (`0.55·rating + 0.30·saturating-volume + 0.15·recency`), so the frontend can show *why* something is trending. Formula and SQL stay in sync via a shared single source of truth.
- **Real-time review delivery** — Socket.IO pushes `review:created` events so a new review lands on every open product page instantly.
- **Deferred trust auth** — HttpOnly refresh cookie with **rotation**: every refresh bumps a `refreshTokenVersion`, so an old cookie is dead the moment a newer one is issued.
- **Fully shareable catalog** — search, category, min-rating, min/max price, sort, and pagination all live in the URL query string. Debounced search; every filter reset returns to page 1.
- **Admin studio** — product CRUD + a review moderation queue (suspend/restore/hard-delete), recharts-backed dashboard, all behind a role guard.
- **Wishlists, profiles & avatars** — per-user saves, public profile pages with stats and review history, and avatar uploads served from local disk.
- **Zero external services to run** — embedded Postgres boots and seeds with one command (`npm run db:setup`); everything runs on `localhost`.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                 Browser                                    │
│                                                                            │
│  React 18 + Vite  ·  TanStack Query  ·  Zustand  ·  React Router  ·  Recharts│
│  Tailwind CSS  ·  lucide-react icons  ·  socket.io-client                  │
└───────────────▲───────────────────────────▲────────────────────────────────┘
                │ HTTP /api/v1               │ Socket.IO / ws
                │ credentials: include        │ review:created events
┌───────────────┴───────────────────────────┴────────────────────────────────┐
│                              @novatech/api (Express)                       │
│                                                                            │
│  middleware → helmet · cors · express-rate-limit · zod validation (body,   │
│                query, params) · auth (JWT access + HttpOnly refresh cookie)│
│                                                                            │
│  routers ── auth ── products ── reviews ── trending ── users ── admin      │
│                │            │           │           │        │             │
│                ▼            ▼           ▼           ▼        ▼             │
│                └───── services → Prisma ORM / raw SQL ───────┘             │
│                                     │                                      │
│  @novatech/shared  ←── Zod schemas + TS types shared verbatim with the web │
│                                     │                                      │
└─────────────────────────────────────┴──────────────────────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │  PostgreSQL    │
                              │  (embedded,    │
                              │  localhost:5433│
                              │  novatech_hub) │
                              └────────────────┘
```

### Monorepo layout

| Path                | Role                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `packages/shared`   | **The contract.** Zod schemas + inferred TS types for every request body, query, and response DTO. Consumed raw (no build step) by both apps. |
| `apps/api`          | Express API. Auth, catalog, reviews, trending, users/profile, admin. Prisma + PostgreSQL, Socket.IO realtime, embedded Postgres bootstrapping. |
| `apps/web`          | React SPA. URL-driven catalog, live product pages, profile editor, wishlist, admin dashboard. |

### The shared contract (why nothing drifts)

`@novatech/shared` is a TypeScript *source* package: `exports` points straight at `src/index.ts`. Both apps import `@novatech/shared` directly, so the Zod schemas (server-side validation) and the TS types (client-side consumption) are literally the same code — a field renamed on the API is a compile error on the web app, not a silent 500.

---

## Tech stack

**API** — Node 20+ · TypeScript 5 · Express 4 · Prisma 5 (PostgreSQL) · Zod · Socket.IO · jsonwebtoken (access) + HttpOnly refresh cookie · bcryptjs · multer · helmet · express-rate-limit · vitest · tsx · tsup

**Web** — React 18 · TypeScript · Vite 5 · TanStack Query v5 · Zustand · React Router 6 · Tailwind CSS 3 · Recharts

**DB** — PostgreSQL via [embedded-postgres](https://www.npmjs.com/package/embedded-postgres) (a real Postgres server, no Docker) — money stored as **integer minor units** (`priceMinor` = cents).

---

## Getting started

### Prerequisites

- **Node.js ≥ 20** and **npm**. That's it — Postgres is embedded and self-installs on first boot.

### 1. Install

```bash
npm install
```

### 2. Configure environment

The dev defaults already work out of the box with embedded Postgres:

```bash
cp apps/api/.env.example apps/api/.env   # only needed if you haven't already
```

Key values (see `apps/api/.env.example` for the full set):

| Variable              | Dev default                                       |
| --------------------- | ------------------------------------------------- |
| `DATABASE_URL`        | `postgresql://postgres:postgres@localhost:5433/novatech_hub` |
| `EMBEDDED_PG`         | `true` (boot embedded Postgres when nothing listens on port 5433) |
| `WEB_ORIGIN`          | `http://localhost:5173` (CORS + credentials)      |
| `PORT`                | `4000`                                            |

The JWT secrets in `.env.example` are fine for local dev; generate real ones for anything public (`openssl rand -hex 32`).

### 3. Set up the database (embedded Postgres + migrate + seed)

```bash
npm run db:setup
```

This: boots embedded Postgres on port `5433` if nothing is listening → creates the `novatech_hub` database → runs Prisma migrations → seeds 6 primary users (1 admin + 5 demo), 36 products across 6 categories, and ≈270 reviews plus votes and wishlist rows. On the very first run the embedded Postgres binary is downloaded automatically.

### 4. Run it

```bash
npm run dev          # API (:4000) + web (:5173) together, with reload
```

Open **http://localhost:5173**.

### 5. Stop

Press **Ctrl+C** in the `npm run dev` terminal. Postgres is stopped automatically.

If Postgres ever gets stuck (port 5433 occupied but server not responding):
```bash
npm run db:kill     # force-kill all orphaned postgres.exe processes
```

To stop Postgres without stopping the dev server:
```bash
npm run db:stop     # stop embedded Postgres only
```

### 6. Verify

| Command            | What it does                                      |
| ------------------ | ------------------------------------------------- |
| `npm run typecheck`| `tsc --noEmit` across shared, api, and web        |
| `npm test`         | Vitest — trending formula contract tests          |
| `npm run build`    | Bundle the API (tsup) + web (tsc && vite build)   |

### Demo accounts

All seeded users share the password **`novatech123`**:

| Role   | Sign in as            | Email                |
| ------ | --------------------- | -------------------- |
| Admin  | `admin`               | `admin@novatech.dev` |
| User   | `priya.k`             | `priya@example.com`  |
| User   | `marco.dev`           | `marco@example.com`  |
| User   | `elena`               | `elena@example.com`  |
| User   | `tom.bike`            | `tom@example.com`    |
| User   | `riley`               | `riley@example.com`  |

Plus 12 filler reviewers behind the scenes so every product has a realistic histogram.

---

## API reference

All endpoints are namespaced under `/api/v1`. Request and response payloads are validated/typed by `@novatech/shared`.

| Method   | Path                                          | Auth     | Description |
| -------- | --------------------------------------------- | -------- | ----------- |
| `GET`    | `/api/v1/health`                              | —        | Liveness probe |
| `POST`   | `/api/v1/auth/register`                       | —        | Create account; returns `{ accessToken, user }` + HttpOnly refresh cookie |
| `POST`   | `/api/v1/auth/login`                          | —        | Sign in (rate-limited) |
| `POST`   | `/api/v1/auth/refresh`                        | cookie   | Rotate the refresh cookie → fresh access token |
| `POST`   | `/api/v1/auth/logout`                         | cookie   | Revoke refresh tokens, clear cookie |
| `GET`    | `/api/v1/auth/me`                             | ✓        | Current user (session hydrate) |
| `GET`    | `/api/v1/products`                            | opt ✓    | Catalog — `page, pageSize, q, category, sort, minPrice, maxPrice, minRating`; live aggregates per row |
| `GET`    | `/api/v1/products/:slug`                      | opt ✓    | Product detail + live rating summary (avg, count, 1–10 histogram) |
| `GET`    | `/api/v1/products/:productId/reviews`         | opt ✓    | Paginated reviews with per-requester vote state — `page, pageSize, sort` |
| `POST`   | `/api/v1/products/:productId/reviews`         | ✓        | Create review (1/user/product); emits `review:created` |
| `PATCH`  | `/api/v1/products/:productId/reviews/:reviewId` | ✓      | Edit your own review |
| `DELETE` | `/api/v1/products/:productId/reviews/:reviewId` | ✓      | Delete your review (admin: any) |
| `POST`   | `/api/v1/reviews/:reviewId/vote`              | ✓        | `{ value: 1 \| -1 }` — idempotent toggle |
| `GET`    | `/api/v1/trending?limit`                      | —        | Top products by live trending score + breakdown |
| `GET`    | `/api/v1/home`                                | —        | Homepage round-trip: featured, per-category best sellers + counts, trending shortlist |
| `GET`    | `/api/v1/users/:username`                     | opt ✓    | Public profile + stats |
| `GET`    | `/api/v1/users/:username/reviews`             | opt ✓    | Reviews by that user, with product, paginated |
| `GET`    | `/api/v1/users/me`                            | ✓        | Own profile (includes email) |
| `PATCH`  | `/api/v1/users/me`                            | ✓        | Update name / bio |
| `POST`   | `/api/v1/users/me/avatar`                     | ✓        | Multipart upload (`avatar`) → new avatar URL |
| `GET`    | `/api/v1/users/me/wishlist`                   | ✓        | Saved products |
| `PUT`    | `/api/v1/users/me/wishlist/:productId`        | ✓        | Add to wishlist (idempotent) |
| `DELETE` | `/api/v1/users/me/wishlist/:productId`        | ✓        | Remove from wishlist |
| `GET`    | `/api/v1/admin/stats`                         | admin    | Dashboard aggregates |
| `GET`    | `/api/v1/admin/products`                      | admin    | Product management list |
| `POST`   | `/api/v1/admin/products`                      | admin    | Create product |
| `PUT`    | `/api/v1/admin/products/:id`                  | admin    | Update product |
| `DELETE` | `/api/v1/admin/products/:id`                  | admin    | Delete product (cascades reviews/votes/wishlists) |
| `GET`    | `/api/v1/admin/reviews?status`                | admin    | Moderation queue (VISIBLE / SUSPENDED) |
| `PUT`    | `/api/v1/admin/reviews/:id/status`            | admin    | Suspend or restore a review |
| `DELETE` | `/api/v1/admin/reviews/:id`                   | admin    | Hard-delete a review |

---

## How trending works

```text
score = 10 · ( 0.55·(Rating−1)/9
              + 0.30·min(1, ln(1+Reviews)/ln(32))
              + 0.15·e^(−DaysSinceLastReview/21) )

A product with no visible reviews scores 0 (no signal). The min(1, …) clamp
keeps the volume term from ever exceeding its 0.30 weight, so the score is
bounded to [0, 10] by construction.
```

| Term    | Weight | Shape                                                       | Why |
| ------- | ------ | ----------------------------------------------------------- | --- |
| Rating  | 0.55   | Linear, 1–10 → 0–1                                          | Quality dominates, but a 10/10 from one person can't corner the chart |
| Volume  | 0.30   | **Saturating log**, clamped at 1.0 (full weight ≈31 reviews) | "Many recent reviews" beat "one ancient rave" without letting popularity snowball forever — and no flood of reviews can push a 10/10 past 10.0 |
| Recency | 0.15   | **Exponential decay**, half-life ≈ 21 days                  | Cool-down: an old hit naturally slides down unless the community keeps engaging |

Every term is computed from live DB rows at request time — no cached scores, no background jobs. The formula lives in **one file** (`score.ts`) and ships both the SQL (checked in to the queries) *and* a JS mirror (used by tests), so the two can never drift. Each trending row exposes its `scoreBreakdown` so the UI can show *why* a product ranks where it does.

---

## Architecture decisions

1. **The DB is the single source of truth for every number.**
   Averages, histograms, counts, and trending scores are all Postgres aggregates computed at request time. There is intentionally no cached "average" column anywhere — monotonic consistency and zero staleness bugs by construction.

2. **Money is `priceMinor: Int`, never a float.**
   Integer minor units (cents) eliminate floating-point and `Decimal` rounding surprises end to end.

3. **The shared Zod contract is the boundary.**
   Server validates every body, query, and param with Zod; the web client consumes the same schemas' inferred types. Renaming a field on the API is a compile error in the web app.

4. **`noUncheckedIndexedAccess` is on, everywhere.**
   Index-signature lookups are `T | undefined` by default. The API narrows validated route params through a `routeParam` helper, and the web app narrows at the edge — making "possibly undefined" failures part of the type system instead of a runtime surprise.

5. **Refresh-token rotation via a version counter.**
   `refreshTokenVersion` on the user bumps on every refresh and logout. An old refresh cookie is invalid the instant a newer one is issued — logout revokes everything in one transaction. Reuse detection is trivial (stale version ⇒ revoked).

6. **Suspension over deletion for moderation.**
   Admin "moderation" flips a review to `SUSPENDED` — the row stays (for audits and eventual restore), but the review joins the `VISIBLE` filter on every aggregation. Aggregates literally cannot see hidden reviews.

7. **Embedded Postgres for zero-friction dev.**
   `embedded-postgres` runs a real PostgreSQL 18 instance on a dedicated port with a single `npm run db:setup`. No Docker, no global installs — CI and new machines converge on the same schema via migrations.

8. **Realtime as an enhancement, not a dependency.**
   Socket.IO pushes `review:created` and the client simply invalidates its queries. Miss an event? Polling/refetch still works — realtime never owns correctness.

---

## Project scripts

| Script                    | Where         | What |
| ------------------------- | ------------- | ---- |
| `dev`                     | root          | API (:4000) + web (:5173) with reload |
| `typecheck`               | root          | `tsc --noEmit` for shared, api, web |
| `test`                    | root          | Vitest (api) |
| `build`                   | root          | Bundle api (tsup) then web (tsc + vite build) |
| `db:setup`                | root → api    | Boot embedded PG → migrate → seed → status |
| `db:start` / `db:stop`    | root → api    | Start / stop embedded PG |
| `db:migrate`              | root → api    | Ensure PG + `prisma migrate dev` |
| `db:reset`                | root → api    | Drop, re-migrate, re-seed (`--force`) |
| `db:migrate:prod`         | api           | `prisma migrate deploy` (production path) |

---

*Rated by the community, computed by Postgres, shipped in a monorepo where the API and its client can't drift apart.*