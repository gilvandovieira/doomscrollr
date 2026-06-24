#!/usr/bin/env bash
# Dev-loop full-cycle benchmark on the REAL app under REAL work.
# Background load hits /api/feed/recent (real Postgres query) the whole time.
# Strategies (save -> serving-again):
#   A  deno run --watch          (in-process reload; reuses process)
#   B  external respawn          (kill -9 + fresh `deno run`; full cold start)
#   C  compile-on-change         (deno compile -> cold-start the binary; minimal memory)
# Measures: full-cycle latency, RSS after each cycle, and errors hitting real traffic.
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
LEAF="$API/src/lib/og.ts"; BIN="$B/dx-bin"; PORT=8094; NF=6; NC=3
set -a; source "$ENV" 2>/dev/null; set +a
cp "$LEAF" "$B/leaf-dxr.orig"

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
pidon(){ ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1; }
up(){ curl -s -o /dev/null --max-time 0.5 "http://localhost:$PORT/health" 2>/dev/null; }
upwait(){ curl -s -o /dev/null --retry 120 --retry-connrefused --retry-delay 1 --max-time 90 "http://localhost:$PORT/health"; }
ready(){ curl -s "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"' && return 0 || return 1; }
feedok(){ curl -s -o /dev/null -w '%{http_code} %{size_download}' --max-time 3 "http://localhost:$PORT/api/feed/recent" 2>/dev/null; }
spawn_watch(){ ( cd "$API" && taskset -c 0-3 env PORT=$PORT LOG_LEVEL=fatal deno run --watch --allow-net --allow-env --allow-sys=hostname src/main.ts >/dev/null 2>&1 & ); }
spawn_cold(){  ( cd "$API" && taskset -c 0-3 env PORT=$PORT LOG_LEVEL=fatal deno run --allow-net --allow-env --allow-sys=hostname src/main.ts >/dev/null 2>&1 & ); }
spawn_bin(){   ( taskset -c 0-3 env PORT=$PORT LOG_LEVEL=fatal "$BIN" >/dev/null 2>&1 & ); }
gap_latency(){ local t0=$1 dl;   # save -> down -> up, ms from t0
  dl=$(($(date +%s%3N)+5000)); while up; do [ "$(date +%s%3N)" -gt "$dl" ] && { echo "-1"; return; }; done
  dl=$(($(date +%s%3N)+30000)); until up; do [ "$(date +%s%3N)" -gt "$dl" ] && { echo "-2"; return; }; done
  echo $(( $(date +%s%3N) - t0 )); }
avg(){ local s=0 n=0 x; for x in "$@"; do case "$x" in ''|*[!0-9]*) ;; *) s=$((s+x)); n=$((n+1));; esac; done; [ $n -gt 0 ] && echo $((s/n)) || echo NA; }
loadgen(){ taskset -c 8-15 bun "$B/load.ts" "http://localhost:$PORT/api/feed/recent" 12 "$1" >"$B/dxload-$2.json" 2>/dev/null & echo $!; }

old=$(pidon); [ -n "$old" ] && kill -9 "$old" 2>/dev/null

echo "=== sanity: real work returns data? ==="
spawn_cold; upwait; ready && echo "  /ready=db ok" ; echo "  /api/feed/recent -> $(feedok)"
kill -9 "$(pidon)" 2>/dev/null; for k in $(seq 1 15); do up || break; done

# ---------------- A: --watch ----------------
lp=$(loadgen 16 A); spawn_watch; upwait; ready
latA=""; rssA="$(rss "$(pidon)")"
for i in $(seq 1 $NF); do
  t0=$(date +%s%3N); echo "// dxr $i $(date +%s%N)" >> "$LEAF"
  latA="$latA $(gap_latency "$t0")"; upwait; rssA="$rssA $(rss "$(pidon)")"
done
kill -9 "$(pidon)" 2>/dev/null; pkill -9 -f 'deno run --watch' 2>/dev/null; wait "$lp" 2>/dev/null
cp "$B/leaf-dxr.orig" "$LEAF"

# ---------------- B: external respawn (cold deno run) ----------------
lp=$(loadgen 20 B); spawn_cold; upwait; ready
latB=""; rssB="$(rss "$(pidon)")"
for i in $(seq 1 $NF); do
  old=$(pidon); t0=$(date +%s%3N); kill -9 "$old" 2>/dev/null; spawn_cold; upwait
  latB="$latB $(( $(date +%s%3N) - t0 ))"; rssB="$rssB $(rss "$(pidon)")"
done
kill -9 "$(pidon)" 2>/dev/null; wait "$lp" 2>/dev/null

# ---------------- C: compile-on-change + cold-start binary ----------------
echo "=== building initial binary (compile time samples) ==="
ct=""; for r in 1 2 3; do t0=$(date +%s%3N); ( cd "$API" && deno compile --allow-net --allow-env --allow-sys=hostname --output "$BIN" src/main.ts >/dev/null 2>&1 ); ct="$ct $(( $(date +%s%3N)-t0 ))"; done
echo "  deno compile wall time ms:$ct  (avg $(avg $ct))"
lp=$(loadgen 40 C); spawn_bin; upwait; ready
latC=""; cmplC=""; rssC="$(rss "$(pidon)")"
for i in $(seq 1 $NC); do
  old=$(pidon); t0=$(date +%s%3N)
  ( cd "$API" && deno compile --allow-net --allow-env --allow-sys=hostname --output "$BIN" src/main.ts >/dev/null 2>&1 )  # rebuild on "change"
  tc=$(date +%s%3N); cmplC="$cmplC $((tc-t0))"
  kill -9 "$old" 2>/dev/null; spawn_bin; upwait
  latC="$latC $(( $(date +%s%3N) - t0 ))"; rssC="$rssC $(rss "$(pidon)")"
done
kill -9 "$(pidon)" 2>/dev/null; wait "$lp" 2>/dev/null

cp "$B/leaf-dxr.orig" "$LEAF"
echo
echo "================ RESULTS (real app, real /api/feed/recent load) ================"
echo "A --watch (in-process)  full-cycle ms:$latA   avg $(avg $latA)   RSS MB:$rssA"
echo "B cold respawn          full-cycle ms:$latB   avg $(avg $latB)   RSS MB:$rssB"
echo "C compile+cold-start    full-cycle ms:$latC   avg $(avg $latC)   RSS MB:$rssC  (compile-only ms:$cmplC)"
echo "real-work load (errors = requests hit during reload downtime):"
for s in A B C; do echo "  $s: $(cat "$B/dxload-$s.json" 2>/dev/null)"; done
echo "og.ts junk after restore: $(grep -cE '// dxr ' "$LEAF")"