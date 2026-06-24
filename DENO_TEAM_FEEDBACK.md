# Deno 2.8.3: `deno run --watch` RSS grows across reloads under real traffic

## Summary

On a real Hono + Drizzle + postgres.js API, a single `deno run --watch` process **accumulates
resident memory on every reload** while the app is serving real traffic: the same process climbed
**634 MB → 3,011 MB over 5 file-change reloads** (~+475 MB per reload, not reclaimed). A **control**
that reloads by starting a **fresh process** (external watcher → `deno run`, or `deno compile` +
binary) stays **flat** under the identical app and workload. From a developer's point of view this
behaves like a reload leak — RSS grows on every save and is not given back, so a normal editing
session OOMs the machine.

We have **not** captured V8 heap snapshots, so we describe this as "retains/accumulates RSS" rather
than asserting unreachable-memory retention. The behavior is consistent and reproducible; the
control isolates it to `--watch` **process reuse** rather than the application workload.

## Environment

| | |
|---|---|
| Deno | 2.8.3 (stable, x86_64-unknown-linux-gnu) |
| Also compared | Node 26.1.0, Bun 1.3.14 |
| CPU | 12th Gen Intel Core i7-12700H — 20 logical cores |
| RAM | 15 GiB |
| OS / kernel | CachyOS, Linux 7.0.12 |
| Container engine | Docker 29.6.0 (local Postgres 16) |
| App under test | Hono + Drizzle ORM + postgres.js + Clerk + Zod + Pino, all `npm:` specifiers, Deno workspace (`apps/api` + 3 local `packages/*`), ~70 TS files |

Single machine, all runs back-to-back under identical conditions. No personal data, credentials,
hostnames, or file paths are included here.

## Main finding: watch reload accumulation

`deno run --watch`, server pinned to 4 cores, with a closed-loop client hitting `/api/feed/recent`
(a real Postgres query) throughout. `VmRSS` read from `/proc/<pid>/status` after each reload (the
PID is stable — `--watch` reloads in-process):

| Reload | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---:|---:|---:|---:|---:|---:|
| RSS (MB) | 634 | 878 | 1342 | 1896 | 2520 | 3011 |

~+475 MB per reload, monotonic, not reclaimed. Reload latency itself is fine (~670 ms); only memory
grows. The accumulation is **much more visible under real traffic + live DB connections** than at
idle — idle-only probes made `--watch` look stable, which is likely why this is easy to miss.

## Control: fresh-process reload stays flat

Same app, same load, same 4-core pin — but each reload is a **new process**:

| Reload strategy | RSS across reloads | Reload latency |
|---|---|---:|
| `deno run --watch` (in-process reuse) | 634 → 3011 MB (grows) | ~670 ms |
| external watcher → fresh `deno run` | **~631 MB, flat** | ~1.0 s |
| external watcher → `deno compile` + run binary | **~221 MB, flat** | ~2.2 s (compile-bound) |

A fresh process per reload is flat under the identical workload. This strongly suggests the
accumulation is tied to `--watch` **process reuse** — the previous module graph / isolate not being
reclaimed on restart — rather than the application code or the workload. (For reference, the
compiled binary cold-starts in ~30 ms; the 2.2 s above is entirely `deno compile`, not startup. Also
note: shortening the app's graceful-shutdown timeout makes reloads snappier but does **not** affect
the accumulation — it's about process reuse, not shutdown timing.)

## Reproduction method

```bash
# (1) the affected loop — watch, in-process reload (RSS grows across reloads)
cd apps/api
deno run --watch --allow-net --allow-env --allow-sys=hostname --env-file=../../.env.local src/main.ts

# (2) control A — external watcher, fresh process each change (flat memory)
#     (watchexec/entr kill + respawn; we used kill -9 + re-exec)
watchexec -r -e ts -- deno run --allow-net --allow-env --allow-sys=hostname src/main.ts

# (3) control B — compile then run the binary (flat, minimal memory)
deno compile --allow-net --allow-env --allow-sys=hostname --output /tmp/server src/main.ts && /tmp/server

# real-work load (closed-loop, ~12 concurrent) against a DB-backed route, for the whole run
bun load.ts http://localhost:8000/api/feed/recent 12 16     # tiny fetch-loop client

# force a --watch reload without semantic change (append a comment to a file in the graph)
echo "// reload $(date +%s%N)" >> apps/api/src/lib/og.ts

# sample RSS after each reload (PID is stable under --watch)
awk '/VmRSS|VmHWM/{print}' /proc/<pid>/status
```

Fairness/validity: server pinned `taskset -c 0-3`, load generator `taskset -c 8-15` (no CPU
contention); every run verified a live DB (`/ready` → `{"database":"ok"}`) before measuring.

> Footnote, in the spirit of honest benchmarking: during one cleanup pass a script ran
> `docker rm -f $(docker ps -aq --filter name=t)` to remove a throwaway container named `t`.
> Docker's `name` filter is a *substring* match, and `postgres` contains a `t` — so we briefly,
> heroically "dropped the prod database" mid-run (hence a few stray `/api/feed/recent` 500s in the
> logs). It was a local dev container, the data was in a named volume, and `docker compose up -d`
> restored all 50 rows. No production database was harmed; one engineer's composure was.

## Raw numbers

Watch-reload RSS series (MB): `634 878 1342 1896 2520 3011` over reloads 0–5.
Fresh-process controls (MB): `deno run` → `631 631 631 …` (flat); `deno compile` binary → `~221`
(flat). Reload latencies: `--watch` ~670 ms; cold `deno run` ~1.0 s; `deno compile`+binary ~2.2 s
(of which ~30 ms is binary startup, the rest is `deno compile`). 0 errors except the self-inflicted
DB-removal window noted above.

## Why this hurts DX

A `deno run --watch` server for this app starts around **0.6 GB** and then **climbs ~0.5 GB per
save**. A focused half-hour of editing — plus a couple of automated agents that each spawn their own
dev server — and a 16 GB laptop starts swapping, then the OOM killer takes a process. We lost real
time assuming the accumulation was a bug in our code; the control runs suggest it isn't — the
application-specific increment looks small next to the runtime/`--watch` overhead (Node and Bun add
only ~27 MB going from an empty server to the full app, which is the closest proxy we have, not a
true live-set measurement). The per-reload growth under `--watch` is the part that actually hurts.

## Secondary observation: `deno run` memory and `Deno.serve` throughput

Separate from the reload issue, two lower-priority data points (same app, 4-core budget):

| Mode | Idle RSS | Under load | `/health` req/s (p50) | DB-route req/s (p50) |
|---|---:|---:|---|---|
| `deno run` | 254 MB | 826 MB | 5,961 (16.6 ms) | 812 (61 ms) |
| `deno compile` | 215 MB | 401 MB | 5,961 (16.6 ms) | 862 (58 ms) |
| Node 26 (`@hono/node-server`) | 196 MB | 246 MB | 20,824 (4.6 ms) | 1,240 (40 ms) |
| Bun 1.3 (`Bun.serve`) | 91 MB | 198 MB | 33,698 (2.8 ms) | 884 (56 ms) |

- `deno run` baseline is heavy and **scales with core count** (254 MB on 4 cores → 641 MB on 20).
  `deno compile` reclaims most of it with no code change, so much of it reads as a *dev/run*
  transpile-and-retain cost rather than a hard runtime floor.
- `Deno.serve` trivial-route throughput trailed Node/Bun at equal cores. **Treat this as weak
  evidence:** Node and Bun use different server implementations and ran via a small `Deno` global
  shim, so it is not an apples-to-apples runtime comparison. On the real DB route the gap mostly
  closes (the database dominates).

## What would help

1. **Confirm/fix `--watch` reload accumulation** (primary): fully reclaim the previous module
   graph / isolate on restart. Even a documented "restart the process every N reloads" escape hatch,
   or a flag to fork a fresh process per reload, would resolve the DX pain.
2. A way to **report** what `deno run` / `--watch` retains for the module graph, so developers can
   see growth themselves.
3. (Lower priority) bring the `deno run` baseline closer to `deno compile`, and any guidance on the
   `Deno.serve` throughput gap for `npm:`-heavy Hono apps.

## Artifacts available

We can share, for a clean repro or reduction:

- exact `deno run --watch` command, external-watcher command, and `deno compile` + run-binary commands (above);
- the closed-loop load generator and its invocation;
- the file-change trigger script used to drive reloads;
- the RSS sampling method and **raw `/proc/<pid>/status` samples** per reload;
- a dependency-graph summary of the app (`npm:` specifiers, ~70 TS files);
- the ~70-line `Deno` global shim used only for the Node/Bun comparison.

We can provide a **reduced, self-contained reproduction repo** on request, or share the full repo
privately with a maintainer — whichever is preferred. For triage, the exact commands above should be
enough to reproduce the accumulation on any `npm:`-heavy Deno app.
