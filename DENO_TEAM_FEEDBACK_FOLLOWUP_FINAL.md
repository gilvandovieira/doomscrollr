# Final follow-up on #35664 — the actual switch is the `deno.lock`

_This supersedes the earlier follow-up comment (the "it's the `node_modules` contents" one)._

Every reproduction I posted earlier passed `--no-lock` — I'd copied it from our repo's bench scripts without
noticing — and that flag was quietly **suppressing** the effect in a fresh folder. It sent me down two wrong
paths ("it scales with `node_modules` size", then "it's the `node_modules` contents"). Both were artifacts of
`--no-lock`. With a normal `deno.lock` present, the ramp reproduces in a **bare two-file project** — no big
repo, no workspace, no particular package, no database.

## Minimal reproduction

```
mkdir ramp && cd ramp
```

```jsonc
// deno.json
{ "nodeModulesDir": "auto" }
```

```ts
// server.ts
import { Hono } from "jsr:@hono/hono";
import { verifyToken } from "npm:@clerk/backend";
void verifyToken; // keep the import live
Deno.serve(new Hono().get("/", (c) => c.text("ok")).fetch);
```

```sh
deno install                 # creates deno.lock + node_modules (11 packages)
deno run --watch server.ts   # now save server.ts a few times and watch the process RSS
```

On Deno 2.9.0 / Linux x86_64, RSS climbs **~+48 MB on every save, dead linear, and never comes back → OOM**.
No requests needed — just the reloads (each save restarts the watcher in place; the PID stays the same, so you
can sample `/proc/<pid>/status`).

## The on/off switches

```sh
deno run --watch --no-lock server.ts             # same saves → FLAT (~+5 MB/save, reclaims)
deno run --watch --node-modules-dir=none server.ts   # also FLAT
```

So it needs **both**: (a) a **resolved lockfile** (a `deno.lock`, default mode — or a workspace `deno.json`,
which is why our repo ramps even with `--no-lock`), and (b) the npm deps **materialized on disk**
(`nodeModulesDir: "auto"`). Remove either and it plateaus.

## It scales with the npm dependency's weight — not `node_modules` size or count

A 2-file, 11-package project ramps at the **same rate** as our 200-package app (~+48 MB/save), so it isn't
about how big `node_modules` is. It tracks the *weight* of the `npm:` dependency's node-compat graph — the same
ordering as the per-dependency table in the original post:

| npm dep on disk (+ `deno.lock`, `--watch`) | per-reload |
|---|---|
| `@clerk/backend` | ~+48 MB |
| `hono` (npm) | ~+17 MB |
| `postgres` (postgres.js) | ~+2 MB |
| none (pure `jsr:` graph, 0 npm deps) | ~0 |

## What this looks like

`deno run --watch` seems to retain the **node-compat module graph of the resolved `npm:` dependencies** on every
reload and never reclaim it. A `deno.lock` (or workspace `deno.json`) is what makes Deno resolve that full set;
`--no-lock` drops the resolution, and the retention with it. `--node-modules-dir=none` keeps the deps out of the
on-disk tree, which also avoids it.

One correction to the original post: the **`jsr`-vs-`npm` "island" framing doesn't hold up**. With a lockfile,
`npm:hono` + Clerk ramps too (~+66 MB/save) — the `jsr`-framework-plus-`npm`-island distinction only showed up
under our repo's `--no-lock` + workspace setup, so it was an artifact, not the cause.

## Environment

| | |
|---|---|
| Deno | 2.9.0 (stable, x86_64-unknown-linux-gnu) |
| OS | Linux (RSS read from `/proc/<pid>/status`) |
| Reproduces with | 2 files + `deno install`; no DB, no workspace, no large `node_modules` |
