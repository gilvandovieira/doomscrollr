#!/usr/bin/env bash
# Localize the --watch reload RSS growth: V8 JS heap? glibc arena frag? native retention?
# For each config: --watch + real /api/feed/recent load + 5 reloads, RSS series.
#   default   : plain deno run --watch
#   arena2    : MALLOC_ARENA_MAX=2 (tests glibc malloc arena fragmentation)
#   heapcap   : --v8-flags=--max-old-space-size=256 (if RSS still grows >> cap, it's NOT JS heap)
#   gc        : --v8-flags=--expose-gc + SIGUSR1->gc() after each reload (does RSS drop = reclaimable?)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV="${ENV:-$REPO/.env.local}"
API="$REPO/apps/api"
WORK="${WORK:-$(mktemp -d -t dsr-bench-XXXXXX)}"
B="$WORK"
cp "$HERE/load.ts" "$B/load.ts" 2>/dev/null || true
echo "[work dir: $WORK]"
LEAF="$API/src/lib/og.ts"; PORT=8094; N=5
set -a; source "$ENV" 2>/dev/null; set +a
cp "$LEAF" "$B/leaf-da.orig"
cat > "$API/gc-probe.ts" <<'TS'
Deno.addSignalListener("SIGUSR1", () => { (globalThis as { gc?: () => void }).gc?.(); });
await import("./src/main.ts");
TS

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
pidon(){ ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1; }
up(){ curl -s -o /dev/null --max-time 0.5 "http://localhost:$PORT/health" 2>/dev/null; }
upwait(){ curl -s -o /dev/null --retry 120 --retry-connrefused --retry-delay 1 --max-time 90 "http://localhost:$PORT/health"; }
gap(){ local t0=$1 dl; dl=$(($(date +%s%3N)+5000)); while up; do [ "$(date +%s%3N)" -gt "$dl" ]&&return; done
  dl=$(($(date +%s%3N)+30000)); until up; do [ "$(date +%s%3N)" -gt "$dl" ]&&return; done; }
killpid(){ local p; p=$(pidon); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; for k in $(seq 1 20); do up||break; done; }

run_cfg(){ local name=$1; shift            # remaining args: env+command to launch
  killpid
  taskset -c 8-15 bun "$B/load.ts" "http://localhost:$PORT/api/feed/recent" 12 20 >/dev/null 2>&1 & local lp=$!
  ( cd "$API" && taskset -c 0-3 "$@" >/dev/null 2>&1 & )
  upwait; local pid; pid=$(pidon); local series; series="$(rss "$pid")"; local gcline=""
  for i in $(seq 1 $N); do
    echo "// da $i $(date +%s%N)" >> "$LEAF"; local t0; t0=$(date +%s%3N); gap "$t0"; upwait
    local cur; cur=$(pidon); [ -z "$cur" ] && cur=$pid; series="$series $(rss "$cur")"
    if [ "$name" = gc ]; then kill -USR1 "$cur" 2>/dev/null; up; up; gcline="$gcline $(rss "$cur")"; fi
  done
  kill -9 "$(pidon)" 2>/dev/null; kill "$lp" 2>/dev/null
  printf '%-9s RSS MB: %s\n' "$name" "$series"
  [ "$name" = gc ] && printf '%-9s post-GC RSS MB: %s\n' "$name" "$gcline"
  cp "$B/leaf-da.orig" "$LEAF"
}

echo "feed sanity: $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$PORT/health 2>/dev/null)"
run_cfg default                       env PORT=$PORT LOG_LEVEL=fatal deno run --watch --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" src/main.ts
run_cfg arena2   env MALLOC_ARENA_MAX=2 PORT=$PORT LOG_LEVEL=fatal deno run --watch --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" src/main.ts
run_cfg heapcap                       env PORT=$PORT LOG_LEVEL=fatal deno run --watch --v8-flags=--max-old-space-size=256 --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" src/main.ts
run_cfg gc                            env PORT=$PORT LOG_LEVEL=fatal deno run --watch --v8-flags=--expose-gc --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" gc-probe.ts

rm -f "$API/gc-probe.ts"; cp "$B/leaf-da.orig" "$LEAF"
echo "og.ts junk: $(grep -cE '// da ' "$LEAF")  | gc-probe removed: $([ -f "$API/gc-probe.ts" ] && echo no || echo yes)"