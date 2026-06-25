# Request: a JSR-native `@clerk/backend` for Deno — with measured memory data

This is a feature request: please consider publishing `@clerk/backend` to **[JSR]** (the
Deno/TypeScript registry). Today there's no JSR build, so Deno users load it through npm/Node-compat —
and in our otherwise-fully-JSR Deno stack, `@clerk/backend` is the **one dependency we can't move**, and
it sets the floor on how light the app can get.

## Context

On Deno, `deno run --watch` retains `npm:` / Node-compat modules across reloads (Deno [#28107]) — the
previous module graph isn't released on restart, so memory ramps every save. JSR-native modules don't go
through the node-compat loader and don't pay that cost.

## What we measured (Deno 2.8.3)

Per-dependency, each npm dep **alone** on a `jsr:@hono/hono` base, no load, MB of RSS retained **per
`--watch` reload** (restarts verified, repeated, stable):

- **`@clerk/backend` alone: +62 MB/reload.**

After moving every other dependency in our API to JSR (Hono → `jsr:@hono/hono`, Zod → `jsr:@zod/zod`,
logging → `jsr:@std/log`, DB → `jsr:@db/postgres`), `@clerk/backend` is the remaining npm dependency and
the reason the app still climbs ~64 MB/reload instead of staying flat — ~9× slower than the all-npm
version, but not flat. It also contributes to startup-peak memory (our full npm stack spiked to ~866 MB
at startup; the JSR stack peaked at ~82 MB).

That the cost is the **npm-compat loader and not the code** is shown cleanly by a same-library control:
the identical Hono library retains **+19 MB/reload via `npm:hono` but +2 via `jsr:@hono/hono`**.

## The ask

A **JSR-native publish of `@clerk/backend`** would let Deno users avoid the node-compat path — lower warm
memory, smaller startup, and far less `--watch` reload retention. Deno is a runtime you already document
support for; a JSR build would make that support materially lighter and align with the std library and
Hono, which are already on JSR.

## Why it's plausible — the code is already runtime-agnostic

`@clerk/backend`'s own README lists the prerequisite as **"Node.js >=20.9.0 (or later) or any V8 isolates
runtime."** So the SDK is *already* designed to run anywhere V8 runs — and it runs on Deno **today** (we
use it). The gap is purely **distribution**: it's published only to npm, so Deno has to load it through
the node-compat layer, paying the overhead above. A JSR build would let Deno import it natively — a
packaging/publishing change, **not a code rewrite**. The SDK is TypeScript on Web-standard primitives
(Web Crypto, `fetch`, JWT verification), which is exactly what JSR is designed for.

We're happy to share our full benchmark suite and the per-dependency decomposition so the impact is
reproducible on your side.

[JSR]: https://jsr.io
[#28107]: https://github.com/denoland/deno/issues/28107
