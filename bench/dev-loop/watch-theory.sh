#!/usr/bin/env bash
# Theory: does `deno run --watch` accumulate memory across reloads (same process),
# such that an external watcher that respawns a FRESH `deno run` stays flat?
# Same app, same 4-core pin, N reloads each. Non-destructive: reloads are triggered
# by touching an external watch-file, never by editing source.
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
T="$BENCH/wt-trigger.txt"
PORT=8094
N=12
PIN="taskset -c 0-3"

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
pidon(){ ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1; }
wait_boots(){ local want=$1 log=$2 dl=$(( $(date +%s%3N) + 40000 ));
  while [ "$(grep -c api_starting "$log" 2>/dev/null)" -lt "$want" ]; do
    [ "$(date +%s%3N)" -gt "$dl" ] && return 1; done; }
wait_health(){ curl -s -o /dev/null --retry 50 --retry-connrefused --retry-delay 1 --max-time 40 "http://localhost:$PORT/health"; }

echo "available external watchers: $(for t in watchexec entr nodemon fswatch inotifywait; do command -v $t >/dev/null && printf '%s ' $t; done; echo)"
echo "//0" > "$T"
old=$(pidon); [ -n "$old" ] && kill -9 "$old" 2>/dev/null

# ---------- Mode A: deno run --watch (reloads in the SAME process) ----------
logA="$BENCH/watchA.log"; : > "$logA"
( cd "$API" && $PIN env PORT=$PORT LOG_LEVEL=info deno run --watch="$T" \
    --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" src/main.ts >"$logA" 2>&1 & )
wait_boots 1 "$logA" && wait_health
pidA=$(pidon)
seriesA="$(rss "$pidA")"
printf 'A  --watch       reload %2d: RSS=%4s MB (pid %s)\n' 0 "$(rss "$pidA")" "$pidA"
for i in $(seq 1 $N); do
  echo "//$i" > "$T"
  wait_boots $((i+1)) "$logA" || { echo "A: reload $i boot timeout"; break; }
  cur=$(pidon); [ -z "$cur" ] && cur=$pidA
  r=$(rss "$cur"); seriesA="$seriesA $r"
  printf 'A  --watch       reload %2d: RSS=%4s MB (pid %s)\n' "$i" "$r" "$cur"
done
kill -9 "$(pidon)" 2>/dev/null; pkill -9 -f "watch=$T" 2>/dev/null

# ---------- Mode B: external watcher -> FRESH `deno run` each reload ----------
logB="$BENCH/watchB.log"; seriesB=""
for i in $(seq 0 $N); do
  old=$(pidon)
  if [ -n "$old" ]; then kill "$old" 2>/dev/null
    for k in $(seq 1 20); do curl -s --max-time 1 "http://localhost:$PORT/health" >/dev/null 2>&1 || break; done
    kill -9 "$old" 2>/dev/null; fi
  : > "$logB"
  ( cd "$API" && $PIN env PORT=$PORT LOG_LEVEL=info deno run \
      --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" src/main.ts >"$logB" 2>&1 & )
  wait_boots 1 "$logB" && wait_health
  pidB=$(pidon); r=$(rss "$pidB"); seriesB="$seriesB $r"
  printf 'B  ext-respawn   reload %2d: RSS=%4s MB (pid %s)\n' "$i" "$r" "$pidB"
done
kill -9 "$(pidon)" 2>/dev/null

echo
echo "A (--watch, same process) RSS MB:  $seriesA"
echo "B (ext respawn, fresh)    RSS MB:  $seriesB"