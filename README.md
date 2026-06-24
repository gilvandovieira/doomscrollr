# Doomscrollr

Doomscrollr is a Deno workspace app for an infinite meme, GIF, and short-video feed where every post
opens into its own discussion thread.

This first slice implements the spec foundation:

- Deno workspace with `apps/web`, `apps/api`, and shared packages.
- Hono API with health, feed, post detail, comments, GIF, user, and moderation routes.
- PostgreSQL migrations and seed data for the core feed loop.
- Clerk authentication for the React app and API-protected routes.
- Shared Zod schemas for media, posts, comments, users, reports, and pagination.
- React/Vite frontend using TanStack Router and TanStack Query.
- A 9-item infinite feed, post detail page, upload composer shell, profile shell, and moderation
  shell.
- Pino request logging and Zod environment validation.
- Drizzle PostgreSQL schema matching the product model.

## Commands

```sh
deno task check
deno task test
deno task db:migrate
deno task db:seed
deno task dev:api
deno task dev:web
```

The API defaults to `http://localhost:8000`. The web app defaults to `http://localhost:5173`.

Run the API and web tasks in separate terminals during development.

## Local Auth

Clerk stores local credentials in `.env.local`. The API, database, and Vite web tasks load the root
`.env.local` file automatically.

Required Clerk values:

```sh
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...
CLERK_AUTHORIZED_PARTIES=http://localhost:5173,http://127.0.0.1:5173
```

`VITE_CLERK_PUBLISHABLE_KEY` is also supported. The Vite config maps only the publishable key into
client code; it does not expose `CLERK_SECRET_KEY`.

The header shows Sign in and Sign up controls when signed out, and an account menu when signed in.
Protected API calls send the current Clerk session token as a bearer token.

## Local Database

Start Postgres:

```sh
docker compose up -d postgres
```

Use your existing `.env.local` or create one from `.env.example`, then run:

```sh
deno task db:migrate
deno task db:seed
deno task dev:api
```

When `DATABASE_URL` is set, public read APIs use PostgreSQL. Without it, the API falls back to the
same seed-shaped mock data so the frontend can still run.
