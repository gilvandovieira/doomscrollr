#!/usr/bin/env bash
# Real-DB npm-vs-JSR benchmark: matched feed servers, same Postgres, same query.
#   npm-feed.ts = hono + drizzle + postgres.js + pino + zod + clerk
#   jsr-feed.ts = @hono/hono + @db/postgres(raw) + @std/log + @zod/zod + clerk(npm floor)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WT="$(cd "$HERE/.." && pwd)"
ENV="$WT/.env.local"
LOAD="${LOAD:-$WT/load.ts}"
PORT=8094
set -a; source "$ENV" 2>/dev/null; set +a

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
hwm(){ awk '/VmHWM/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
up(){ curl -s -o /dev/null --max-time 0.5 "http://localhost:$PORT/health" 2>/dev/null; }
ready(){ curl -s --max-time 4 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
kill8094(){ local p; p=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; for k in $(seq 1 15); do up || break; done; }

measure(){ local name=$1 file="$HERE/$2"
  echo "================= $name ================="
  # ---- plain run: cold start, warm RSS, startup peak, /feed load ----
  kill8094
  local t0; t0=$(date +%s%3N)
  PORT=$PORT taskset -c 0-3 deno run --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/jb.log 2>&1 &
  local pid=$!
  until ready; do [ "$(($(date +%s%3N)-t0))" -gt 60000 ] && { echo "  BOOT FAIL"; tail -5 /tmp/jb.log; return; }; done
  local cold=$(( $(date +%s%3N) - t0 ))
  for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/api/feed/recent"; done
  local warm=$(rss "$pid") peak=$(hwm "$pid")
  local feed; feed=$(taskset -c 8-15 bun "$LOAD" "http://localhost:$PORT/api/feed/recent" 12 8 2>/dev/null)
  local warm2=$(rss "$pid")
  printf '  cold_start=%sms  warm_RSS=%sMB  startup_peak=%sMB  post-load_RSS=%sMB\n' "$cold" "$warm" "$peak" "$warm2"
  printf '  /feed (real DB query) load: %s\n' "$feed"
  kill8094

  # ---- --watch reload retention (the npm-compat signal) ----
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
  # strip the appended reload-trigger comments
  sed -i '/^\/\/ reload [0-9]* [0-9]*$/d' "$file"
}

echo "real DB: ${DATABASE_URL##*@}  |  server pinned cores 0-3, loadgen 8-15"
measure "npm  (hono+drizzle+postgres.js+pino+zod+clerk)" npm-feed.ts
measure "jsr  (@hono/hono+@db/postgres+@std/log+@zod/zod, clerk floor)" jsr-feed.ts
