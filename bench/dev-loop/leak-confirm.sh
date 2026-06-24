#!/usr/bin/env bash
# Clean confirmation: --watch leak vs cold-respawn flat, under REAL 200 work.
# Kills only by PID (no self-matching pkill). Captures real-traffic error rate.
set -u
# --- portable paths (derived from this script's location) ---
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
cp "$LEAF" "$B/leaf-lc.orig"

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
pidon(){ ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1; }
up(){ curl -s -o /dev/null --max-time 0.5 "http://localhost:$PORT/health" 2>/dev/null; }
upwait(){ curl -s -o /dev/null --retry 120 --retry-connrefused --retry-delay 1 --max-time 90 "http://localhost:$PORT/health"; }
ready(){ curl -s --max-time 5 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
killpid(){ local p; p=$(pidon); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; for k in $(seq 1 20); do up || break; done; }
spawn_watch(){ ( cd "$API" && taskset -c 0-3 env PORT=$PORT LOG_LEVEL=fatal deno run --watch --allow-net --allow-env --allow-sys=hostname src/main.ts >/dev/null 2>&1 & ); }
spawn_cold(){  ( cd "$API" && taskset -c 0-3 env PORT=$PORT LOG_LEVEL=fatal deno run        --allow-net --allow-env --allow-sys=hostname src/main.ts >/dev/null 2>&1 & ); }
gap(){ local t0=$1 dl; dl=$(($(date +%s%3N)+5000)); while up; do [ "$(date +%s%3N)" -gt "$dl" ]&&{ echo -1;return;}; done
  dl=$(($(date +%s%3N)+30000)); until up; do [ "$(date +%s%3N)" -gt "$dl" ]&&{ echo -2;return;}; done; echo $(( $(date +%s%3N)-t0 )); }

killpid
echo "feed sanity: $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$PORT/health 2>/dev/null) (server down, expected)"

# ---- A: --watch, real 200 load ----
taskset -c 8-15 bun "$B/load.ts" "http://localhost:$PORT/api/feed/recent" 12 16 >"$B/loadA.json" 2>/dev/null & lpA=$!
spawn_watch; upwait; ready && echo "A: /ready ok, feed serving"
rssA="$(rss "$(pidon)")"; latA=""
for i in $(seq 1 $N); do t0=$(date +%s%3N); echo "// lc $i $(date +%s%N)" >> "$LEAF"
  latA="$latA $(gap "$t0")"; upwait; rssA="$rssA $(rss "$(pidon)")"; done
killpid; wait "$lpA" 2>/dev/null; cp "$B/leaf-lc.orig" "$LEAF"
loadA=$(cat "$B/loadA.json" 2>/dev/null)

# ---- B: cold respawn, real 200 load ----
taskset -c 8-15 bun "$B/load.ts" "http://localhost:$PORT/api/feed/recent" 12 16 >"$B/loadB.json" 2>/dev/null & lpB=$!
spawn_cold; upwait; ready && echo "B: /ready ok, feed serving"
rssB="$(rss "$(pidon)")"; latB=""
for i in $(seq 1 $N); do old=$(pidon); t0=$(date +%s%3N); [ -n "$old" ] && kill -9 "$old" 2>/dev/null
  spawn_cold; upwait; latB="$latB $(( $(date +%s%3N)-t0 ))"; rssB="$rssB $(rss "$(pidon)")"; done
killpid; wait "$lpB" 2>/dev/null
loadB=$(cat "$B/loadB.json" 2>/dev/null)

cp "$B/leaf-lc.orig" "$LEAF"
echo
echo "===== REAL-WORK CONFIRMATION (load = /api/feed/recent, 12 conc) ====="
echo "A  --watch        RSS MB: $rssA"
echo "A  --watch        cycle ms:$latA"
echo "A  real traffic:  $loadA"
echo "B  cold respawn   RSS MB: $rssB"
echo "B  cold respawn   cycle ms:$latB"
echo "B  real traffic:  $loadB"
echo "og.ts junk: $(grep -cE '// lc ' "$LEAF")"