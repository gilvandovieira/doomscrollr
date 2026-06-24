# End-to-end tests

These tests drive the **real Hono server over real HTTP** against a **real, seeded Postgres
database**. They exercise the full path a request actually takes — CORS + logging middleware, auth,
route handlers, repositories, SQL, and the server-rendered Open Graph pages — not mocks. They are
the safety net for the v1 core loop:

```txt
create a post -> it appears in the feed -> a friend opens the share link
              -> they react / comment -> moderation + abuse controls hold
```

## Run them

```sh
docker compose up -d --wait   # Postgres must be reachable (see below)
deno task test:e2e            # full suite
deno task check:e2e           # typecheck the e2e sources only
```

Run a single file or filter by name:

```sh
deno test -A apps/api/e2e/og-sharing.e2e.test.ts
deno test -A apps/api/e2e/ --filter "core loop"
```

## How the harness works (`harness.ts`)

On the **first** `api()` call, setup runs once for the whole suite:

1. **Ephemeral database.** Connects to the maintenance Postgres and runs
   `DROP DATABASE IF EXISTS doomscrollr_test WITH (FORCE)` + `CREATE DATABASE
   doomscrollr_test`.
   Your dev database is never touched.
2. **Fresh schema + seed.** Runs the project's own `migrate.ts` and `seed.ts` against the test
   database (as subprocesses), so the schema and fixtures are identical to dev.
3. **Real server.** Sets `APP_ENV=test`, points `DATABASE_URL` at the test database, then imports
   `app.ts` and boots it with `Deno.serve` on a random port. Tests talk to it with `fetch`.

The whole suite shares one server and one database. The Deno test runner exits the process at the
end, which tears everything down; the `e2eTest()` wrapper disables the per-test resource/op
sanitizers because the server and connection pool intentionally outlive individual tests.

### Database target

Defaults to the local compose Postgres
(`postgres://doomscrollr:doomscrollr@localhost:5433/doomscrollr`). Override the maintenance
connection with `E2E_BASE_DATABASE_URL` (the harness always derives the `doomscrollr_test` database
name from it):

```sh
E2E_BASE_DATABASE_URL=postgres://user:pass@host:5432/postgres deno task test:e2e
```

## Authentication: the gated test seam

Every write goes through Clerk token verification, which normally requires a real Clerk session. For
deterministic, offline tests, `verifyClerkToken` (`apps/api/src/middleware/auth.ts`) accepts a
bearer of the form `test:<clerkUserId>` **only** when both `APP_ENV === "test"` **and**
`E2E_AUTH=1`.

This is doubly gated and can never activate in development or production (where `APP_ENV` is
`development`/`production`). The harness sets both flags and also deletes `CLERK_SECRET_KEY` from
the test process, so the real Clerk path is unreachable during a run.

In tests, impersonate a user by passing its Clerk id:

```ts
await api("/api/posts", { asUser: USERS.maya.clerkId, body: { ... } }); // -> Bearer test:clerk_mock_maya
```

Seeded users live in `harness.ts` (`USERS`, `POSTS`, `COMMENTS`, `TAGS`). A Clerk id that is **not**
seeded (e.g. `clerk_e2e_newcomer`) resolves to "authenticated but no local user yet", which is how
the onboarding/`409
USERNAME_REQUIRED` paths are tested.

## What's covered

| File                          | Surface                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `core-loop.e2e.test.ts`       | create → feed → read → comment → one-level reply → react; YouTube posts; reply-nesting guard                                  |
| `og-sharing.e2e.test.ts`      | OG metadata + readable content without JS; no-slug URL; YouTube thumbnail; 404 unavailable page; `ds_aid` funnel cookie       |
| `moderation.e2e.test.ts`      | block filtering (blocker-only); admin remove/restore; removed-post share safety; report queue + dismiss; admin authz (403)    |
| `auth-and-limits.e2e.test.ts` | 401 (no session); 409 (no username); username claim/taken/reserved/invalid; events endpoint validation; 429 rate limit        |
| `web-smoke.e2e.test.ts`       | desktop/mobile `/p` route render; mobile username claim; create text/image/YouTube; copy share; comment; react; report; block |

## Adding tests

```ts
import { api, assertEquals, assertStatus, e2eTest, USERS } from "./harness.ts";

e2eTest("a friend can react to a shared post", async () => {
  const res = await api("/api/posts/7kF3mQx9Za/reactions", {
    asUser: USERS.ana.clerkId,
    body: { value: 1 },
  });
  assertStatus(res, 200);
});
```

Conventions:

- Name files `*.e2e.test.ts` and keep them under `apps/api/e2e/`. The unit `deno task test` run
  excludes that directory via `--ignore=apps/api/e2e`; e2e runs only via `deno task test:e2e`.
- The database is shared and mutable across the suite. Prefer assertions that don't depend on
  another test's writes; when you must, snapshot-and-diff (see the report-queue test) rather than
  asserting on absolute counts.
- Use the seam, not real Clerk. Tests should stay offline and deterministic.

## Browser smoke seam

`web-smoke.e2e.test.ts` boots Vite beside the same API harness and drives the React SPA in a mobile
viewport. It uses `VITE_E2E_AUTH=1` plus `localStorage["doomscrollr.e2eClerkId"]` so the frontend
can request `test:<clerkUserId>` tokens from the API's doubly-gated test seam. Real Clerk sign-in is
still a manual production smoke concern, but the local create/comment/react/report/block UI loop is
covered offline.
