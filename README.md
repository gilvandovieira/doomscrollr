# Doomscrollr

Doomscrollr is a Deno workspace app for a **SFW, mobile-first social posting experiment** centered
on WhatsApp sharing and focused post discussion. v1 exists to validate one loop:

```txt
Create post -> Share to WhatsApp -> Friend opens -> Friend reacts/comments -> Creator returns
```

## Source Of Truth

The active product and implementation contract is
[`specs/specs/doomscrollr_spec_v1.md`](specs/specs/doomscrollr_spec_v1.md). If code, README copy,
roadmap notes, or mock data conflict with the v1 spec, the v1 spec wins.

- [`ROADMAP.md`](ROADMAP.md) tracks v1 implementation tasks (and the earned v2/v3 ladder).
- v2, v3, and future milestone specs under `specs/` are not current build scope until v1 earns them.

## What v1 includes

- Deno monorepo: `apps/web`, `apps/api`, and shared packages (`config`, `database`, `shared`).
- Three post kinds only: **text**, **external image link**, and **YouTube/Shorts**. No uploads, no
  GIF providers, no ads, no content ratings, no ranking — recent feed only.
- Hono API (PostgreSQL + Drizzle, Zod, Pino) with public reads, authenticated writes, an admin
  surface, and a public funnel-event endpoint.
- **Server-rendered Open Graph previews** for canonical post pages (`/p/:postCode`) so WhatsApp
  previews never depend on client-side React.
- Clerk auth with a local username setup flow, account status enforcement, and lazy user sync.
- Comments (flat + one-level replies), up/down reactions with transactional counters, reports, admin
  remove/restore, user blocking (pushed into feed/comment SQL), and basic rate limits.
- React/Vite frontend (TanStack Router + Query) with WhatsApp / copy / native share controls and the
  anonymous share funnel.

### Public identity

Internal database ids never appear in public URLs or API payloads. Posts/comments are addressed by a
short random `public_code`; users by `@username`. Internal ids are UUIDv7 generated app-side.

## Web & API routes

```txt
Web (server-rendered OG, then SPA):   GET /p/:postCode[/:slug]
SPA routes:                           /  ·  /@:username  ·  /create  ·  /admin/reports
Public API:    GET /api/feed/recent · /api/posts/:postCode · /api/posts/:postCode/comments
               GET /api/users/:username · POST /api/events
Authenticated: POST /api/posts · /api/posts/:postCode/{comments,reactions}
               POST /api/comments/:commentCode/reactions · /api/reports
               POST|DELETE /api/users/:username/block · POST /api/account/username
Admin:         GET /api/admin/reports · POST /api/admin/{posts,comments}/:code/{remove,restore}
               POST /api/admin/reports/:reportId/dismiss
```

## Commands

```sh
deno task check        # typecheck all packages
deno task test         # run unit + contract tests
deno task test:e2e     # run API + mobile browser E2E smoke against local Postgres
deno task report:funnel # print the v1 funnel report from DATABASE_URL
deno task db:migrate   # apply migrations
deno task db:seed      # seed SFW sample data
deno task dev:api      # API on http://localhost:8000
deno task dev:web      # web on http://localhost:5173
deno task build:web    # production web build
```

Run the API and web tasks in separate terminals during development.

## Local database (clean slate)

This is pre-launch local dev. To reset to a clean slate, drop the Postgres volume and re-apply the
single v1 migration:

```sh
docker compose down -v        # drop the postgres_data volume
docker compose up -d --wait   # fresh database
deno task db:migrate
deno task db:seed
```

When `DATABASE_URL` is set, the API uses PostgreSQL. Without it, public reads fall back to
seed-shaped mock data so the frontend can still run.

## Environment

Copy `.env.example` to `.env.local`. Key values:

```sh
DATABASE_URL=postgres://doomscrollr:doomscrollr@localhost:5433/doomscrollr
PUBLIC_BASE_URL=http://localhost:8000        # canonical origin for absolute OG URLs
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...                     # VITE_CLERK_PUBLISHABLE_KEY also supported
CLERK_AUTHORIZED_PARTIES=http://localhost:5173,http://127.0.0.1:5173
YOUTUBE_API_KEY=                              # optional; v1 only parses the video id
```

The Vite config maps only the publishable key into client code; it never exposes `CLERK_SECRET_KEY`.

## Sharing preview check

Canonical post pages must serve Open Graph metadata without JavaScript:

```sh
curl -A "WhatsApp" http://localhost:8000/p/<postCode>/<slug>   # OG tags present, no JS
curl http://localhost:8000/p/<postCode>/<slug>                 # also boots the React app
```
