# Follow-up on #35664 — how to reproduce it (in simple terms)

> ⚠️ **Superseded by `DENO_TEAM_FEEDBACK_FOLLOWUP_FINAL.md`.** This version blamed the on-disk `node_modules`
> (its size, then its contents). That was an artifact of `--no-lock`, which every repro here inherited from our
> bench scripts and which suppresses the effect in a fresh folder. The real switch is the **`deno.lock`**: with
> a lockfile present, a bare two-file project ramps ~+48 MB/save → OOM; `--no-lock` makes it flat. See the FINAL
> follow-up for the correct, minimal reproduction. The steps below still work (our repo does ramp), but the
> *explanation* here is wrong.

A quick update to make this easy to reproduce. One extra thing we found:

**The ramp only shows up when the npm packages are installed on disk in a `node_modules` folder** — the normal
setup, `"nodeModulesDir": "auto"` in `deno.json`. If you just drop the two files into an empty folder, it does
**not** ramp. That's most likely why a small snippet wouldn't reproduce.

## The quickest check — same file, one flag

Run the same server two ways and watch its memory after each save:

```
deno run --watch bench/jsr-bench/iso-jsr-hono-clerk.ts                          → grows every save, never comes back → OOM
deno run --watch --node-modules-dir=none bench/jsr-bench/iso-jsr-hono-clerk.ts  → stays flat (~120 MB)
```

The only difference: the second one reads the npm packages from Deno's global cache instead of an on-disk
`node_modules`. Same code, opposite result.

## Run it in our repo — full steps

You need Deno and Linux (we read memory from `/proc`). No database, no `.env`.

```bash
git clone https://github.com/gilvandovieira/doomscrollr && cd doomscrollr
deno install                                   # puts the packages on disk in node_modules — this is the part that matters
RELOADS=60 bash bench/jsr-bench/repro-clerk-island.sh
```

It runs two servers, prints the memory after each reload, and stops at **3 GB** so it won't OOM your machine.
What we see (Deno 2.9.0, Linux x86_64):

```
jsr:@hono + npm:@clerk/backend  →  climbs ~55 MB every save, straight line → hits the 3 GB cap
npm:hono  + npm:@clerk/backend  →  settles around ~270 MB
```

If you skip `deno install`, only the two servers' own packages land in `node_modules` (small) and it stays
flat. The full app's `node_modules` is what makes it ramp. We also checked *what* about it matters, and it's the
**contents of the real install, not the size**: copying our `node_modules` into a bare folder with a one-line
`deno.json` (no workspace) reproduces the ramp (+48 MB/reload), while a *synthetic* `node_modules` of the same
size stays flat. Individual heavy packages on their own don't trigger it either — importing `drizzle-orm`'s full
module graph, or adding `@jsr/zod`, each stays flat — so it seems to need the full real dependency set. We
haven't pinned the exact package(s) yet.

## The two files

- `bench/jsr-bench/iso-jsr-hono-clerk.ts` and `iso-npm-hono-clerk.ts` — two ~10-line Hono servers. The only
  difference is the `Hono` import (`jsr:` vs `npm:`); the `npm:@clerk/backend` import is the same in both.
- `bench/jsr-bench/repro-clerk-island.sh` — runs both and prints the numbers, with the 3 GB cap.

Happy to trim this further or answer anything.
