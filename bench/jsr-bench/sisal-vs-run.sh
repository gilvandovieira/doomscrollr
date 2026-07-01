#!/usr/bin/env bash
# Sisal vs the field, re-baselined in ONE session on the CURRENT Deno.
# Mirrors run.sh's measure() exactly (same core pinning, same load params) but:
#   - measures four stacks back-to-back: Drizzle(npm) / raw @db/postgres(jsr) / Kysely / Sisal
#   - passes --minimum-dependency-age=0 --no-lock so every stack resolves to the
#     current-latest matching versions under this Deno (the workspace pins a
#     2026-06-24 dependency-age cutoff that would otherwise block @sisal/*).
# Stacks (all share the npm @clerk/backend floor + @hono/hono + a logger + zod):
#   npm-feed.ts        hono + drizzle + postgres.js
#   jsr-feed.ts        @hono/hono + @db/postgres (raw SQL)
#   kysely-jsr-full.ts @hono/hono + kysely(compiler) + @db/postgres
#   sisal-feed.ts      @hono/hono + @sisal/orm + @sisal/pg (rides @db/postgres)
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"   # repo root (bench/ is $HERE/..)
ENV="$ROOT/.env.local"
LOAD="${LOAD:-$HERE/../load.ts}"
AGE="--minimum-dependency-age=0 --no-lock"
PORT=8094
set -a; source "$ENV" 2>/dev/null; set +a

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
hwm(){ awk '/VmHWM/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
up(){ curl -s -o /dev/null --max-time 0.5 "http://localhost:$PORT/health" 2>/dev/null; }
ready(){ curl -s --max-time 4 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
kill8094(){ local p; p=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; for k in $(seq 1 15); do up || break; done; }

# Pre-cache so cold-start numbers exclude first-time downloads.
precache(){ echo "-- pre-caching $1"; deno cache $AGE --allow-import "$HERE/$1" >/dev/null 2>&1; }

measure(){ local name=$1 file="$HERE/$2"
  echo "================= $name ================="
  kill8094
  local t0; t0=$(date +%s%3N)
  PORT=$PORT taskset -c 0-3 deno run $AGE --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/jb.log 2>&1 &
  local pid=$!
  until ready; do [ "$(($(date +%s%3N)-t0))" -gt 60000 ] && { echo "  BOOT FAIL"; tail -8 /tmp/jb.log; return; }; done
  local cold=$(( $(date +%s%3N) - t0 ))
  for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/api/feed/recent"; done
  local warm=$(rss "$pid") peak=$(hwm "$pid")
  local feed; feed=$(taskset -c 8-15 bun "$LOAD" "http://localhost:$PORT/api/feed/recent" 12 8 2>/dev/null)
  local warm2=$(rss "$pid")
  printf '  cold_start=%sms  warm_RSS=%sMB  startup_peak=%sMB  post-load_RSS=%sMB\n' "$cold" "$warm" "$peak" "$warm2"
  printf '  /feed (real DB query) load: %s\n' "$feed"
  kill8094

  kill8094; : > /tmp/jbw.log
  PORT=$PORT taskset -c 0-3 deno run $AGE --watch --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/jbw.log 2>&1 &
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

echo "Deno: $(deno --version | head -1)"
echo "real DB: ${DATABASE_URL##*@}  |  server pinned cores 0-3, loadgen 8-15"
for f in npm-feed.ts jsr-feed.ts kysely-jsr-full.ts sisal-feed.ts sisal-pgjs-feed.ts; do precache "$f"; done
ROUNDS="${ROUNDS:-3}"
for round in $(seq 1 "$ROUNDS"); do
  echo
  echo "############################## ROUND $round / $ROUNDS ##############################"
  measure "npm       (hono+drizzle+postgres.js)"       npm-feed.ts
  measure "jsr       (@hono/hono+@db/postgres raw)"     jsr-feed.ts
  measure "kysely    (@hono/hono+kysely+@db/postgres)"  kysely-jsr-full.ts
  measure "sisal     (@sisal/pg → @db/postgres)"        sisal-feed.ts
  measure "sisal-pgjs (@sisal/pg → postgres.js)"        sisal-pgjs-feed.ts
done
