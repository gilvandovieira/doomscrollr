# Deno 2.8 — memory & throughput feedback from a real app

**Deno version:** 2.8.3 (stable, x86_64-unknown-linux-gnu)
**Date:** 2026-06-24
**App under test:** a normal production API — Hono + Drizzle ORM + postgres.js + Clerk + Zod +
Pino, all via `npm:` specifiers, in a Deno workspace (`apps/api` + 3 local `packages/*`), about
70 TypeScript files. (No application code or data is included here — only measurements.)

We like Deno and want to keep using it. But we hit a memory problem in day-to-day work, so we
measured it carefully. Here is what we found, in plain terms, with numbers you can reproduce.

## Test machine

| | |
|---|---|
| CPU | 12th Gen Intel Core i7-12700H — 20 logical cores |
| RAM | 15 GiB |
| OS / kernel | CachyOS, Linux 7.0.12 |
| Container engine | Docker 29.6.0 |
| Runtimes compared | Deno 2.8.3, Node 26.1.0, Bun 1.3.14 |

Single machine, local Postgres (Docker). All runs back-to-back under the same conditions.

---

## The short version

1. **`deno run` uses a lot of memory for our app — and it grows under load and does not give it
   back.** On a 4-core budget it idles at **254 MB** and climbs to **826 MB** under load. On a
   20-core machine it idles at **641 MB**. The same app on Node idles at ~196 MB, on Bun ~91 MB.
2. **This hurts day-to-day work.** We run a few dev servers and a few automated agents at once.
   Each `deno run --watch` server is big, they add up, and the machine runs out of memory — the
   server process gets killed. It looked like a memory leak; it was not. It was just Deno's
   per-process size times a handful of processes.
3. **`deno compile` fixes most of the memory problem** — same app drops from 826 MB to **401 MB**
   under load, with no code change. So a large part of `deno run`'s memory looks like a *dev/run*
   cost (transpiling + holding the whole module graph), not a hard limit of the runtime.
4. **`Deno.serve` is slower than the other runtimes' servers in our test** — about **6k requests
   per second** vs ~21k (Node) and ~34k (Bun) on the same 4 cores for a trivial endpoint.
   `deno compile` does **not** change this, so it is a serving/runtime thing, not startup.

Two asks, both about `deno run`: **(a)** can `deno run` keep memory closer to the compiled
binary? **(b)** can the HTTP server get closer to Node/Bun throughput?

---

## How we measured (so you can repeat it)

- **Same app code on every runtime.** For Node and Bun we injected a ~70-line `Deno` global shim
  (mapping `Deno.serve` / `Deno.env` / `Deno.exit` / `Deno.addSignalListener` / `Deno.resolveDns`
  onto native APIs). **Zero application changes.** Deno ran the code directly.
- **Four modes:** `deno run`, `deno compile` (standalone binary), Node 26 (via `@hono/node-server`),
  Bun 1.3 (via `Bun.serve`).
- **CPU isolation for fairness:** the server was pinned to cores 0–3 (`taskset`), the load
  generator to cores 4–15, so they never competed for CPU. (We also took an unpinned reading.)
- **Memory:** `VmRSS` (resident) and peak `VmHWM` read straight from `/proc/<pid>/status`.
- **Load:** a closed-loop client. Pure-runtime endpoint `/health` at 100 concurrent for 8 s; real
  database endpoint `/api/feed/recent` at 50 concurrent for 12 s, after a short warm-up. We report
  requests/sec and p50/p90/p99 latency.
- **Validity check:** every run confirmed a live DB connection (`/ready` → `{"database":"ok"}`)
  before and after load, so nothing was short-circuiting the work.

No personal data, credentials, hostnames, or file paths are included in this report.

---

## The numbers (4-core budget, same app, same DB)

| Mode | Cold start | Idle memory | Memory under load | /health req/s | /health p50 | DB-query req/s | DB-query p50 |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Deno** (`deno run`) | 202 ms | 254 MB | **826 MB** | 5,961 | 16.6 ms | 812 | 61 ms |
| **Deno** (`deno compile`) | 199 ms | 215 MB | **401 MB** | 5,961 | 16.6 ms | 862 | 58 ms |
| Node 26 (`@hono/node-server`) | 567 ms¹ | 196 MB | 246 MB | 20,824 | 4.6 ms | 1,240 | 40 ms |
| Bun 1.3 (`Bun.serve`) | 118 ms | 91 MB | 198 MB | 33,698 | 2.8 ms | 884 | 56 ms |

For reference, **idle memory with no CPU limit (all 20 cores):** `deno run` **641 MB**,
`deno compile` 226 MB, Node 206 MB, Bun 100 MB. (`deno run`'s idle memory scales up with the
number of cores — it was 254 MB on 4 cores, 641 MB on 20.)

¹ Node's cold start is slow only because we ran TypeScript through `tsx` (a dev transpiler). A
normal Node deploy ships plain JS and starts fast. Not a fair number against Deno — listed for
honesty, not as a point against anyone.

---

## What stands out

- **Memory under load on `deno run` is the worst part: it reaches 826 MB and stays there** after
  the load stops (the other runtimes also keep some heap, but far less: Node +50 MB, Bun +107 MB,
  `deno run` +572 MB over idle).
- **`deno compile` removes most of it** (826 → 401 MB) with no code change. This strongly suggests
  the extra memory in `deno run` is the cost of transpiling on startup and **holding the whole TS
  module graph in memory** while running. If `deno run` could release or avoid that the way the
  compiled binary does, the dev experience would match production.
- **HTTP throughput:** for a trivial endpoint, `Deno.serve` did ~6k req/s where Node did ~21k and
  Bun ~34k on the same cores. On a real database query the gap closes a lot (the DB is the limit),
  but the trivial-endpoint gap is large and `deno compile` does not change it.

## Why this matters for developers (the DX story)

The thing that actually bit us: a `deno run --watch` dev server for this app is **0.6–2 GB**.
Run two of those plus a couple of automated agents that each start one, and a 16 GB laptop runs
out of memory and the OOM killer takes the server. We spent real time thinking we had a leak in
our code. We did not — our app's live data is only ~27 MB (that is the jump Node and Bun show
from an empty server to the full app). The rest is runtime overhead that only `deno run` carries.

## Where this leaves us (the decision the numbers force)

This is the practical choice we now face. We would prefer to stay on Deno, but the memory result
pushes us toward alternatives for production:

| Deploy target | Best fit | Idle RSS (no CPU limit) | Code change | Why |
|---|---|---:|---|---|
| Container (Fargate / App Runner) | **Deno, `deno compile`** | 226 MB | none | ship a binary; stay on Deno; ~3× less RAM than `deno run` |
| Lambda (managed runtime) | **Node** | 206 MB | full rewrite | only Node is a *managed* Lambda runtime → dev/prod parity; Deno needs a custom/container runtime |
| Container, minimum memory | **Bun** | 100 MB | full rewrite | lightest; native TS; but no Lambda-native runtime |

The takeaway for you: **`deno compile` keeps us on Deno for containers** — that is the path we want.
The only reason we would leave Deno is a managed Lambda runtime (parity) or absolute minimum memory.
If `deno run` got close to `deno compile`'s memory, there would be no friction at all in dev either.

## What would help

1. Bring `deno run` memory closer to `deno compile` (don't retain the full transpiled graph, or
   release it after warmup).
2. A simple way to **cap or report** what `deno run` holds for the module graph, so we can see it.
3. If possible, a smaller-by-default footprint when fewer CPUs are available (it scales up with
   core count today).
4. Any guidance on closing the `Deno.serve` throughput gap for `npm:`-heavy Hono apps.

We are happy to share the full repro repo, the shim, and raw logs.
