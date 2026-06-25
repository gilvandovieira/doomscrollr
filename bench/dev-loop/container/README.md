# Containerized `deno run --watch` reload-retention repro

One command, fully self-contained (bundles its own Postgres). Demonstrates that the `--watch` reload
memory retention reproduces in a **clean, stock-glibc environment** (the official `denoland/deno`
image), so it is **not** specific to an optimized-distro host (e.g. CachyOS / custom glibc / custom
kernel). This is the cross-environment control for the finding in `../../../DENO_TEAM_FEEDBACK.md`.

## Run

```bash
docker compose -f bench/dev-loop/container/docker-compose.yml run --rm --build repro
```

`--build` matters: without it `docker compose run` reuses the cached image and silently ignores edits
to `repro.sh` / the app (this bit us; the symptom was `feed: 000`).

## Result (2026-06-24)

Official `denoland/deno:2.8.3`, **Debian stock glibc 2.41**, app serving real DB traffic
(`/ready` → db ok, `/api/feed/recent` → 200):

```
RSS across 6 reloads (serial load):  131 → 182 → 209 → 229 → 256 → 278 → 298 MB   (~+28 MB/reload)
```

It **grows** — same mechanism as on the host, so it reproduces independent of the host's glibc/kernel.

**But run it long and it is *bounded*.** With concurrent load (`CONC=6`) over 20–80 reloads it
**ramps then plateaus around ~550–650 MB and oscillates** there (deltas go negative — Deno reclaims
old graphs lazily). It does **not** climb to the 2–3 GB / 4 GB cap. So this is a high, lagging
watermark that scales with load — not the strictly-unbounded growth of #28107's ML case.

**It is CPU-bound, not memory-bound.** During the load the test uses **~6 of 20 cores** (per-core
`/proc/stat`: ~40–46% on the busy threads; container `docker stats` median ~444%, max ~532%), while
RSS stays flat ~550 MB far under the 4 GB cap. The "fan spins up" is the concurrent load + per-reload
transpilation, not a memory wall.

Knobs (via `-e`): `CONC` (concurrent load loops), `NMAX` (max reloads), `TARGET_MB` (stop at RSS).
`mem_limit: 4g` in the compose file is a hard safety cap so a runaway can't touch the host.

## Files

| File | Role |
|---|---|
| `Dockerfile` | `denoland/deno:2.8.3` + curl + the app (`apps/api` + packages), deps pre-cached |
| `repro.sh` | migrate + seed, start `deno run --watch`, drive N reloads, sample `VmRSS` from `/proc` |
| `docker-compose.yml` | `db` (postgres:16-alpine, healthchecked) + `repro` (runs the test) |

## Notes
- Cross-environment, not cross-OS: this runs a **Linux** container. Windows/macOS need a different
  setup (Windows containers can't run on a Linux host) — a CI matrix is the practical path.
