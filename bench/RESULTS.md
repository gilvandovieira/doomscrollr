# Benchmark results (2026-06-24)

Machine: i7-12700H (20 cores), 15 GiB RAM, CachyOS. Deno 2.8.3 / Node 26.1.0 / Bun 1.3.14.
Same app on every runtime (Node/Bun via the `Deno` shim). Postgres 16 in Docker.

## Experiment A — synthetic baseline (minimal Hono + same deps), cold RSS
| Runtime | Cold RSS |
|---|---:|
| Bun | 73 MB |
| Deno | 126 MB |
| Node | 180 MB |

## Experiment B — real app, idle RSS (no CPU limit / all 20 cores)
| Mode | Idle RSS |
|---|---:|
| Deno (`deno run`) | 641 MB |
| Deno (`deno compile`) | 226 MB |
| Node | 206 MB |
| Bun | 100 MB |

→ App's intrinsic working set ≈ 27 MB (Node/Bun add only ~27 MB over the empty server).
The rest is runtime overhead; `deno compile` reclaims ~415 MB of `deno run`'s.

## Comprehensive load test (server pinned to 4 cores; 0 errors everywhere)
| Mode | Cold start | Idle RSS | Peak under load | `/health` rps (p50) | `/feed/recent` rps (p50) |
|---|---:|---:|---:|---|---|
| Deno (`deno run`) | 202 ms | 254 MB | 826 MB | 5,961 (16.6 ms) | 812 (61 ms) |
| Deno (`deno compile`) | 199 ms | 215 MB | 401 MB | 5,961 (16.6 ms) | 862 (58 ms) |
| Node (tsx)¹ | 567 ms | 196 MB | 246 MB | 20,824 (4.6 ms) | 1,240 (40 ms) |
| Bun | 118 ms | 91 MB | 198 MB | 33,698 (2.8 ms) | 884 (56 ms) |

¹ Node cold start inflated by `tsx` (dev transpiler); precompiled-JS deploy starts far faster.

Reading the rps: `rps ≈ concurrency ÷ avg latency`. `/health` = pure runtime (gaps wide);
`/feed/recent` = real DB query + 18 KB JSON (DB dominates, gaps collapse to ~1.5×, Node leads).
Idle RSS scales with core count on `deno run` (254 MB @4 cores vs 641 MB @20).

## Production image — runtime base comparison (same compiled binary)
| Base | Image size | Runs? | Idle (in container) | Note |
|---|---:|:---:|---:|---|
| debian:bookworm-slim (shipped) | 421 MB | ✅ | ~177 MiB | glibc |
| distroless/cc-debian12 | 331 MB | ✅ | ~178 MiB | glibc, smallest that works |
| alpine:3.20 (plain) | 309 MB | ❌ | — | musl: `exec: no such file or directory` |
| alpine:3.20 + gcompat | 313 MB | ❌ | — | `__res_init: symbol not found` |

`deno compile` emits glibc-only binaries → Alpine (musl) can't run them. Runtime RSS is identical
across bases (same binary); only image size differs. The 231 MB binary dominates image size.

## Bottom line
- Container deploy → `deno compile` (stay on Deno, ~3× less RAM than `deno run`, no code change).
- Lambda native runtime → Node (only managed option → parity; memory ≈ compiled Deno).
- Absolute min memory → Bun (but no Lambda-native; container only).
- Throughput is ~a wash for this DB-bound app; memory + cold start are the real differentiators.
