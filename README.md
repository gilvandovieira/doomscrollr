# Doomscrollr

Doomscrollr is a Deno workspace scaffold for an infinite meme, GIF, and short-video feed where every
post opens into its own discussion thread.

This first slice implements the spec foundation:

- Deno workspace with `apps/web`, `apps/api`, and shared packages.
- Hono API with health, feed, post detail, comments, GIF, user, and moderation routes backed by mock
  data.
- Shared Zod schemas for media, posts, comments, users, reports, and pagination.
- React/Vite frontend using TanStack Router and TanStack Query.
- A 9-item infinite feed, post detail page, upload composer shell, profile shell, and moderation
  shell.
- Pino request logging and Zod environment validation.
- Drizzle PostgreSQL schema draft matching the product model.

## Commands

```sh
deno task check
deno task test
deno task dev:api
deno task dev:web
```

The API defaults to `http://localhost:8000`. The web app defaults to `http://localhost:5173`.

Run the API and web tasks in separate terminals during development.
