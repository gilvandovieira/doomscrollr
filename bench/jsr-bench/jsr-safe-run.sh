#!/usr/bin/env bash
# DENO: does swapping our SAFE deps to JSR help, and does Drizzle dominate? Measures warm RSS +
# --watch retention across: all-npm(drizzle) -> drizzle+safe-JSR(hono/zod/log) -> kysely+full-safe-JSR.
# Same DB, same query, same session. Reuses run.sh's measure() verbatim.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV="${ENV:-$REPO/.env.local}"
LOAD="${LOAD:-$REPO/bench/load.ts}"
PORT=8094
set -a; source "$ENV" 2>/dev/null; set +a

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
hwm(){ awk '/VmHWM/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
ready(){ curl -s --max-time 4 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
up(){ curl -s -o /dev/null --max-time 0.5 "http://localhost:$PORT/health" 2>/dev/null; }
kill8094(){ local p; p=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; for k in $(seq 1 15); do up || break; done; }

measure(){ local name=$1 file="$HERE/$2"
  echo "================= $name ================="
  kill8094
  local t0; t0=$(date +%s%3N)
  PORT=$PORT taskset -c 0-3 deno run --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/jb.log 2>&1 &
  local pid=$!
  until ready; do [ "$(($(date +%s%3N)-t0))" -gt 60000 ] && { echo "  BOOT FAIL"; tail -8 /tmp/jb.log; return; }; [ -d /proc/$pid ] || { echo "  DIED"; tail -8 /tmp/jb.log; return; }; done
  local cold=$(( $(date +%s%3N) - t0 ))
  for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/api/feed/recent"; done
  local warm=$(rss "$pid") peak=$(hwm "$pid")
  printf '  cold_start=%sms  warm_RSS=%sMB  startup_peak=%sMB\n' "$cold" "$warm" "$peak"
  kill8094

  kill8094; : > /tmp/jbw.log
  PORT=$PORT taskset -c 0-3 deno run --watch --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/jbw.log 2>&1 &
  pid=$!; until ready; do [ -d /proc/$pid ] || break; done
  local s; s="$(rss "$pid")"
  for i in $(seq 1 6); do echo "// reload $i $(date +%s%N)" >> "$file"
    local dl=$(($(date +%s%3N)+25000)); while [ "$(grep -c Restarting /tmp/jbw.log 2>/dev/null)" -lt "$i" ]; do [ "$(date +%s%3N)" -gt "$dl" ] && break; done
    until ready; do [ -d /proc/$pid ] || break; done
    local r=$(rss "$pid"); s="$s $r"; [ -n "$r" ] && [ "$r" -gt 3000 ] && { s="$s [>3GB stop]"; break; }
  done
  local rc=$(grep -c Restarting /tmp/jbw.log)
  local first=$(echo $s|awk '{print $1}') last=$(echo $s|awk '{for(i=NF;i>=1;i--)if($i ~ /^[0-9]+$/){print $i;break}}')
  printf '  --watch reload RSS (restarts=%s): %s  => +%s MB/reload\n' "$rc" "$s" "$(( (last-first)/6 ))"
  kill8094
  sed -i '/^\/\/ reload [0-9]* [0-9]*$/d' "$file"
}

echo "real DB: ${DATABASE_URL##*@}  |  Deno $(deno --version | head -1 | awk '{print $2}')  |  server pinned 0-3"
measure "all-npm (hono+drizzle+postgres.js+pino+zod+clerk)"          npm-feed.ts
measure "drizzle + SAFE-JSR (hono/zod/log -> jsr, drizzle kept npm)" drizzle-jsr-safe.ts
measure "kysely + FULL-SAFE-JSR (hono/zod/log/@db/postgres jsr)"     kysely-jsr-full.ts
echo "done"
