# Follow-up: the minimal repro, in plain terms

Thanks for taking a look. Here's the smallest version of the problem, stripped of our app and the DB.

## The one comparison that matters

Two bare Hono servers. Same Deno (2.9.0), same machine, same reload loop, **same Clerk import**. The only
difference is where `Hono` comes from:

```ts
// A — ramps linearly to OOM
import { Hono } from "jsr:@hono/hono";
import { verifyToken } from "npm:@clerk/backend";
```

```ts
// B — plateaus and stays flat
import { Hono } from "npm:hono";
import { verifyToken } from "npm:@clerk/backend";
```

Run each under `deno run --watch` and save the file repeatedly. What we measure is the RSS of the (same,
long-lived) process after each reload:

- **A (`jsr:@hono` + `npm:@clerk/backend`): ramps ~+51 MB per reload, dead straight — 133 MB → 2.4 GB in 45 saves, no plateau.**
- **B (`npm:hono` + `npm:@clerk/backend`): plateaus around ~265 MB and reclaims.**

So it isn't "a reload leaks memory" in general, and it isn't "an `npm:` dependency is present" — because B has
the exact same `npm:@clerk/backend` and it's fine. The thing that ramps is the **heavy `npm:@clerk/backend`
node-compat module graph specifically when it's the minority `npm:` island inside a JSR-dominant graph.** Swap
the JSR framework for its npm twin and the ramp disappears.

## Why we're confident it's that and not something nearby

Same loop, one variable at a time, each soaked long enough to tell a plateau from a ramp (a short 5–6 reload
window can't — a ramp and a plateau look identical early):

| minimal stack | result |
|---|---|
| `jsr:@hono/hono` alone | plateaus (~201 MB) |
| `npm:hono` alone | plateaus (~225 MB) |
| `jsr:@hono` + `npm:postgres` (a *light* npm dep) | plateaus (~243 MB) |
| **`jsr:@hono` + `npm:@clerk/backend`** | **ramps +51 MB/reload → OOM** |
| `npm:hono` + `npm:@clerk/backend` | plateaus (~265 MB) |

Reading it off: the loader by itself isn't the axis (both bare framework imports plateau), and "any npm dep in a
JSR graph" isn't it either (postgres.js is a lightweight npm dep and plateaus). It's the combination — a **heavy**
npm node-compat graph left un-reclaimed per reload when it's the odd `npm:` dependency in an otherwise-JSR graph.

This matters for real apps because Clerk has no JSR build, so a JSR-native Deno app can't avoid it: the one
required `npm:@clerk/backend` import is itself the trigger.

## The reload loop, in ~10 lines (no DB, no app)

Save one of the two snippets as `server.ts`, then:

```bash
deno run --watch --no-lock --allow-net --allow-env --allow-sys=hostname server.ts &
pid=$!            # deno --watch keeps the SAME pid across reloads, so we can sample it
sleep 5
for i in $(seq 1 45); do
  echo "// reload $i" >> server.ts        # a save = one --watch restart, in place
  sleep 3                                  # let it tear down + come back up
  awk -v i="$i" '/VmRSS/{printf "reload %2d: %d MB\n", i, $2/1024}' /proc/$pid/status
done
kill "$pid"
```

Run it against A and you'll watch the number climb every single reload and never come back down; run it against
B and it settles. (A hard memory cap on the process would force reclamation and fake a plateau, so this just
watches RSS and lets it ramp.)

## Offer

If it helps triage, I can drop this into a tiny standalone reproduction repo — pinned versions, a `deno.json`,
the two entry files, and the `watch-soak.sh` loop we use — so you can clone and run it in one command. Just say
the word.
