# Follow-up on #35664 — how to reproduce it (in simple terms)

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

If you skip `deno install`, only the two servers' own packages land in `node_modules` (small), so it plateaus
instead of ramping. The full app's `node_modules` is what makes it ramp — and the bigger `node_modules` is, the
faster it climbs.

## The two files

- `bench/jsr-bench/iso-jsr-hono-clerk.ts` and `iso-npm-hono-clerk.ts` — two ~10-line Hono servers. The only
  difference is the `Hono` import (`jsr:` vs `npm:`); the `npm:@clerk/backend` import is the same in both.
- `bench/jsr-bench/repro-clerk-island.sh` — runs both and prints the numbers, with the 3 GB cap.

Happy to trim this further or answer anything.
