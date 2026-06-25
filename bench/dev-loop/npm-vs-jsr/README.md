# `npm:` vs JSR — the `--watch` retention is the npm/Node-compat layer

The decisive control for the `deno run --watch` memory finding: **the retained memory is the `npm:`
module state, not the watcher and not graph size.** A fully Deno-native (JSR) stack stays flat across
reloads; the equivalent `npm:` stack grows ~100× more.

## Result (2026-06-24, Deno 2.8.3, no load, restarts verified; per-reload = delta ÷ 5)

**The decisive control — same library (Hono), two loaders (×2 stable):**

| import | modules | per reload |
|---|---:|---:|
| `npm:hono` | 5 | **~+19 MB** |
| `jsr:@hono/hono` | 39 | **~+2 MB** |

Identical library and code; only the `npm:`/Node-compat resolution path differs (and `jsr:@hono/hono`
pulls *more* modules). This isolates the npm-compat loader from the library and its byte size.

**Stack sweep — and it isn't graph size either (the confound is reversed):**

| config | modules | per reload |
|---|---:|---:|
| `npm:hono` | 5 | ~+19 MB |
| `+ npm:` clerk/drizzle/postgres/pino/zod | 10 | **~+549 MB** |
| `jsr:@oak/oak` | 146 | ~+5 MB |
| `+ jsr:@std/log + jsr:@db/postgres` | 198 | ~+6 MB |
| `+ 8 more jsr:@std/*` | **327** | **~+7 MB** |

The JSR graphs have *far more* modules (146–327) than the npm ones (5–10) yet retain ~100× less. If
graph size drove it, the 327-module graph would be worst; it's the best. (`deno info` counts each npm
package as ~one module but loads its bundled code + `node:` compat surface.)

Conclusion: `deno run --watch` does not release `npm:`/Node-compat modules across reloads. Matches
Deno #28107 (whose repro uses `@huggingface/transformers`, an npm package).

## Run

```bash
bench/dev-loop/npm-vs-jsr/run.sh           # one pass each
REPS=3 N=5 GUARD=3000 bench/dev-loop/npm-vs-jsr/run.sh   # repeat x3, stop any run at 3 GB
```

Creates throwaway server files in `<repo>/.npm-vs-jsr-tmp/` (Deno's watcher doesn't fire on `/tmp`),
runs each under `--watch` with **verified restart counts** and a hard RSS guard, then cleans up.
Needs `deno`, `python3`; no DB and no load (isolates module-graph retention).
