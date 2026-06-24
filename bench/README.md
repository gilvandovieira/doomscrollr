# Runtime benchmark — reproducible material

Everything used to measure the API's memory and throughput across **Deno (`deno run`),
Deno (`deno compile`), Node, and Bun**. Findings live in
[`../RUNTIME_MEMORY_REPORT.md`](../RUNTIME_MEMORY_REPORT.md) (internal) and
[`../DENO_TEAM_FEEDBACK.md`](../DENO_TEAM_FEEDBACK.md) (external). Numbers summarized in
[`RESULTS.md`](./RESULTS.md).

## What's here

```
bench/
├── README.md                 — this file
├── RESULTS.md                — the consolidated numbers
├── load.ts                   — closed-loop load generator (run with bun)
├── bench-comprehensive.sh    — the 4-mode load test (cold start, rps, latency, mem-under-load)
├── shim/                     — the ~70-line Deno-global shim that lets the app run unmodified
│   ├── deno-shim.ts          —   maps Deno.serve/env/exit/addSignalListener/resolveDns → Node/Bun
│   ├── boot.ts               —   imports the shim, then apps/api/src/main.ts
│   ├── package.json          —   deps for the Node/Bun worktrees
│   └── tsconfig.json         —   @doomscrollr/* path aliases + .ts imports
├── synthetic/                — Experiment A: minimal Hono server + the same deps, per runtime
│   ├── deno/server.ts, bun/server.ts, node/server.mjs (+ pinned package.json)
├── docker/                   — runtime-base comparison for the compiled binary
│   ├── Dockerfile.alpine-plain    (FAILS: musl)
│   ├── Dockerfile.alpine-gcompat  (FAILS: __res_init missing)
│   └── Dockerfile.distroless      (WORKS: glibc, smallest)
└── logs/                     — boot logs kept as evidence (the multi-MB per-request logs were dropped)
```

## Test machine / method

- **Machine:** 12th Gen Intel Core i7-12700H (20 logical cores), 15 GiB RAM, CachyOS (Linux 7.0.12),
  Docker 29.6.0. Runtimes: Deno 2.8.3, Node 26.1.0, Bun 1.3.14.
- **Same app code on every runtime.** Node/Bun get the `Deno` global shim (zero app changes).
- **Memory** = `VmRSS` / peak `VmHWM` from `/proc/<pid>/status`.
- **Load** = closed-loop client; `rps ≈ concurrency ÷ avg latency`. Server pinned to cores 0–3,
  load generator to 4–15 (`taskset`) so they never compete for CPU.
- Every run verifies `/ready` → `{"database":"ok"}` first.

## Reproduce

### 0. Prereqs
`deno`, `bun`, `node` on PATH; Postgres reachable via `.env.local`'s `DATABASE_URL`
(`docker compose up -d` in the repo). The feed endpoint needs seeded data (`deno task db:seed`).

### 1. Experiment A — synthetic baseline (runtime + deps only)
```bash
cd bench/synthetic/bun  && bun install && PORT=8096 bun server.ts        # measure VmRSS via /proc
cd bench/synthetic/node && npm install --legacy-peer-deps && PORT=8096 node server.mjs
cd bench/synthetic/deno && PORT=8096 deno run --allow-net --allow-env --allow-sys=hostname server.ts
```

### 2. Real app on Node/Bun — prepare worktrees with the shim
```bash
git worktree add -b bench/bun  ../doomscrollr-bun  HEAD
git worktree add -b bench/node ../doomscrollr-node HEAD
for wt in ../doomscrollr-bun ../doomscrollr-node; do
  cp bench/shim/{deno-shim.ts,boot.ts,package.json,tsconfig.json} "$wt/"
  cp .env.local "$wt/.env.local"
done
( cd ../doomscrollr-bun  && bun install )
( cd ../doomscrollr-node && npm install --legacy-peer-deps )
```
Run one: `cd ../doomscrollr-bun && PORT=8092 bun boot.ts`  (Node: `PORT=8091 node --import tsx boot.ts`).

### 3. Deno compiled binary
```bash
cd apps/api
deno compile --allow-net --allow-env --allow-sys=hostname --output ../../bench/api-deno-bin src/main.ts
```

### 4. Comprehensive load test (all four modes)
```bash
./bench/bench-comprehensive.sh         # builds the binary if missing; assumes the worktrees from step 2
```

### 5. Production image + runtime-base comparison
```bash
docker build -f apps/api/Dockerfile -t doomscrollr-api:compiled .          # the shipped multi-stage build
# compare bases (reuse the compiled binary from that image):
docker build -f bench/docker/Dockerfile.distroless    -t dsr:distroless bench/docker      # WORKS, smallest
docker build -f bench/docker/Dockerfile.alpine-gcompat -t dsr:alpine    bench/docker      # FAILS at runtime
```

## Notes
- The 231 MB compiled binary and the multi-MB per-request pino logs are intentionally **not** stored
  (binary is rebuildable in ~6 s; logs were noise). Boot logs are kept in `logs/` as evidence.
- Absolute numbers are single-machine and indicative; the **relative** ranking is the signal.
