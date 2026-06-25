# Dev-loop reload benchmarks (the `--watch` memory leak)

Scripts that measured how the **dev reload loop** behaves on the real app under real work, and
that reproduce the **`deno run --watch` reload memory leak**. Findings are written up for the Deno
team in [`../../DENO_TEAM_FEEDBACK.md`](../../DENO_TEAM_FEEDBACK.md).

## Headline result (2026-06-24, i7-12700H, Deno 2.8.3, server pinned to 4 cores)

Real app, real traffic on `/api/feed/recent` (a live Postgres query), `VmRSS` read after each reload:

| Dev loop | Reload latency (save → serving) | Memory across reloads |
|---|---:|---|
| `deno run --watch` (in-process reload) | ~670 ms | **634 → 878 → 1342 → 1896 → 2520 → 3011 MB** (~+475 MB/reload, never released) |
| external watcher → fresh `deno run` | ~1.0 s | **631 MB — flat** |
| external watcher → `deno compile` + binary | ~2.2 s (compile-bound) | **~221 MB — flat** |

**Conclusion:** `--watch` reuses the process and retains the previous npm/Node-compat module graph.
On a roomy host, later long-run tests showed this is effectively **linear until OOM** rather than
bounded; the earlier plateau only appeared inside a memory-capped container where cgroup pressure forced
reclamation. A fresh process per reload is flat. The fix for a non-blowing-up dev loop is an external
watcher (`watchexec`/`entr`) that **kills and respawns** instead of `--watch`. A shorter
graceful-shutdown timeout fixes the reload *hang*, not this retention. (The reload loop under load is
also CPU-bound, ~6 cores — see `container/README.md`.)

This matches Deno issue **[#28107 "Memory leak with file watcher"]** (reported on 2.1.10 with an ML
script; this is the same mechanism on 2.8.3 with an ordinary web app). External writeup:
`../../DENO_TEAM_FEEDBACK.md`.

### Where the retained memory lives (`disambig.sh`)

Same `--watch` loop, 5 reloads under load, varying one knob each time:

| Config | RSS series (MB) | Reads as |
|---|---|---|
| default | 630 → 3006 | baseline growth |
| `MALLOC_ARENA_MAX=2` | 632 → 3054 | **not** glibc malloc-arena fragmentation |
| `--v8-flags=--max-old-space-size=256` | 631 → 2985 | **not** V8 JS heap (climbs to ~3 GB past a 256 MB cap) |
| `--v8-flags=--expose-gc` + forced `gc()` | 634 → 3167; post-GC 3180 | **not** lazy GC — forced GC doesn't drop it (true retention) |

→ The retained bytes are **native, outside the JS heap, not arena fragmentation, not GC-reclaimable**
— consistent with the previous run's isolate/module-graph not being freed until process exit.

[#28107 "Memory leak with file watcher"]: https://github.com/denoland/deno/issues/28107

## Scripts

| Script | What it measures |
|---|---|
| `leak-confirm.sh` | Clean A/B: `--watch` RSS climb vs cold-respawn flat, under real 200 traffic. **Start here.** |
| `reload-dx-real.sh` | Full 3-way: `--watch` vs cold-respawn vs `deno compile`+binary — latency, RSS, compile time |
| `disambig.sh` | Localizes the retained memory: glibc-arena / V8 heap-cap / forced-GC probes |
| `watch-theory.sh` | First A/B sketch (`--watch` vs external respawn) |
| `mode-a-clean.sh` | `--watch`-only reload probe (default watch, triggers via a source touch) |
| `load.ts` | closed-loop load generator (run with `bun`) — copy of `../load.ts` |

## Running

Prereqs: `deno`, `bun`; Postgres reachable via `<repo>/.env.local` `DATABASE_URL`
(`docker compose up -d`, then `deno task db:seed`). Paths are derived from the script location;
override with env vars if needed:

```bash
# from anywhere:
bench/dev-loop/leak-confirm.sh
# outputs/logs/binary go to a fresh mktemp dir (printed as "[work dir: …]"); override with WORK=…
WORK=/tmp/myrun ENV=/path/.env.local bench/dev-loop/reload-dx-real.sh
```

Each script triggers `--watch` reloads by appending to a real source file (`apps/api/src/lib/og.ts`)
and **restores it afterward** (via a backup copy in the work dir). They kill only by PID.

## Gotchas learned the hard way
- **Never** `docker ... --filter name=t` — Docker's `name` filter is a *substring* match and will
  match `doomscrollr-pos`**`t`**`gres-1`. (Ask us how we know. The volume saved us.)
- `pkill -f '<pattern in this script>'` matches the script's **own** process — kill by PID instead.
- pino buffers stdout, so don't detect reloads by grepping the app log; poll `/health` or the socket.
