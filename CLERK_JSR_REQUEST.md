# Request: a JSR-native `@clerk/backend` for Deno — with measured memory data (Deno 2.9)

> _Disclaimer: this request was researched and drafted with the assistance of an LLM (Anthropic's Claude). The
> measurements are real and independently reproducible via the scripts/commands referenced herein; the LLM
> assisted with the benchmarking, isolation, and write-up._

This is a feature request: please consider publishing `@clerk/backend` to **[JSR]** (the Deno/TypeScript
registry). Today there's no JSR build, so Deno users load it through npm/Node-compat — and in our
otherwise-fully-JSR Deno stack, `@clerk/backend` is the **one dependency we can't move**. On **Deno 2.9** that
turns out to matter more than before: it is now, in isolation, the single dependency that makes a JSR-native
`deno run --watch` dev server **ramp to OOM** instead of staying bounded.

## The headline (Deno 2.9.0)

Deno 2.9 **fixed** the older `--watch` memory retention for *homogeneous-`npm:`* graphs — an all-npm stack now
reclaims and **plateaus** (our all-npm API server grows then caps ~295 MB over 32 saves). **But a heavy
`npm:` dependency still retains linearly, unbounded, when it is the one `npm:` island in an otherwise-JSR
module graph — and for a JSR-native Deno app, `@clerk/backend` is that island.**

Single-variable isolation on 2.9 (a bare Hono server; add exactly one dependency; `deno run --watch`; RSS
retained per reload; ~45 reloads, 3 GB safety cap):

| minimal stack (Deno 2.9) | `--watch` behavior |
|---|---|
| `jsr:@hono/hono` | plateaus ~201 MB |
| `jsr:@hono` + `jsr:@db/postgres` | plateaus ~378 MB |
| `jsr:@hono` + `npm:postgres` (postgres.js) | plateaus ~243 MB |
| **`jsr:@hono` + `npm:@clerk/backend`** | **RAMPS +51 MB/reload → 133 → 2434 MB, no plateau (→ OOM)** |
| `npm:hono` + `npm:@clerk/backend` | plateaus ~265 MB |

**Unambiguous:** on Deno 2.9 a fully-JSR dev server stays bounded — *until you add `@clerk/backend`*, at which
point it ramps linearly to OOM (~50 saves to 3 GB). The **same** Clerk in an all-`npm:` app plateaus, and a
*light* npm dep (postgres.js) never triggers it — so it scales with the dependency's node-compat weight, and
`@clerk/backend` is heavy enough to matter. Our real app reproduces this exactly: every JSR-native stack we
build ramps to OOM, and `@clerk/backend` is the only `npm:` import in it.

The bitter irony: Deno's own guidance is to prefer JSR-native modules — but doing so is precisely what turns
Clerk's retention from a bounded plateau into an unbounded ramp. A JSR build of `@clerk/backend` removes the
node-compat path and the ramp with it. (Full write-up of the Deno-side behavior + isolation:
`DENO_TEAM_FEEDBACK.md`.)

## What we measured earlier (Deno 2.8.3, for history)

On 2.8.3 the npm-compat retention hit *every* npm dep (Drizzle +462, Clerk +62, hono +19 vs `jsr:@hono` +2/
reload). Moving everything else to JSR left `@clerk/backend` as the ~+64 MB/reload floor. 2.9 fixed the
homogeneous-npm case (all-npm now plateaus) but **not** the npm-island-in-JSR case above — which is now the
dominant remaining cost, and it's entirely Clerk for a JSR-native app. Startup peak also favors JSR (our full
npm stack spiked ~866 MB at startup vs ~82 MB for the JSR stack).

## The ask

A **JSR-native publish of `@clerk/backend`** would let Deno users import it without the node-compat loader —
eliminating the `--watch` ramp-to-OOM above, lowering warm memory, and shrinking startup peak. It aligns with
the Deno std library and Hono, which are already on JSR, and it's the one change that lets a JSR-native Deno
app keep a bounded dev loop.

## Why it's plausible — the code is already runtime-agnostic

`@clerk/backend`'s own README lists the prerequisite as **"Node.js >=20.9.0 (or later) or any V8 isolates
runtime."** So the SDK is *already* designed to run anywhere V8 runs — and it runs on Deno **today** (we use
it). The gap is purely **distribution**: it's published only to npm, so Deno loads it through node-compat,
paying the cost above. A JSR build would let Deno import it natively — a packaging/publishing change, **not a
code rewrite**. The SDK is TypeScript on Web-standard primitives (Web Crypto, `fetch`, JWT verification),
exactly what JSR is designed for.

We're happy to share the full benchmark suite, the single-variable isolation, and a one-command containerized
repro so the impact is reproducible on your side.

[JSR]: https://jsr.io
[#28107]: https://github.com/denoland/deno/issues/28107
