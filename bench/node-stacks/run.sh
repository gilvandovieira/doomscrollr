#!/usr/bin/env bash
# Node-runtime Lambda-style memory bench (concurrency=1): Drizzle vs Kysely, and npm vs JSR-safe deps.
# Point: on Node there is no Deno npm-compat loader, so the JSR swaps (hono/zod) should be a wash;
# the only real lever is the query layer. Measures boot peak (VmHWM) + warm peak under c1 load.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
set -a; source "$REPO/.env.local" 2>/dev/null; set +a
PORT=8021
rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
hwm(){ awk '/VmHWM/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
ready(){ curl -s --max-time 3 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
killport(){ local p; p=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; sleep 0.3; }

measure(){ local name=$1 file=$2
  killport
  local t0; t0=$(date +%s%3N)
  PORT=$PORT DATABASE_URL="$DATABASE_URL" taskset -c 0-3 node "$HERE/$file" >/tmp/nsb.log 2>&1 &
  local pid=$!; local n=0; until ready; do sleep 0.1; n=$((n+1)); [ $n -gt 300 ] && { echo "  $name BOOT FAIL"; tail -3 /tmp/nsb.log; return; }; [ -d /proc/$pid ] || { echo "  $name DIED"; tail -3 /tmp/nsb.log; return; }; done
  local cold=$(( $(date +%s%3N) - t0 )) boot_hwm=$(hwm $pid)
  local feed; feed=$(taskset -c 8 bun "$REPO/bench/load.ts" "http://localhost:$PORT/api/feed/recent" 1 10 2>/dev/null)
  printf '  %-16s cold=%4sms  boot_peak=%sMB  warm_RSS=%sMB  peak=%sMB  | %s\n' \
    "$name" "$cold" "$boot_hwm" "$(rss $pid)" "$(hwm $pid)" "$(echo "$feed" | grep -oE '"rps":[0-9]+' )"
  killport
}

echo "Node $(node --version) | real DB ${DATABASE_URL##*@} | concurrency=1 (Lambda per-instance)"
measure "drizzle (npm)"     node-drizzle.mjs
measure "kysely (npm)"      node-kysely.mjs
measure "kysely+jsr-safe"   node-kysely-jsr.mjs
