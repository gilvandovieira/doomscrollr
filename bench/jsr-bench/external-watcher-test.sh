#!/usr/bin/env bash
# Theory: an EXTERNAL watcher (watchexec -r) kills + respawns a FRESH `deno run` per change, so the
# previous run's npm-compat layer dies with the process — nothing stacks. Expect FLAT RSS across
# reloads (vs `deno run --watch`'s linear climb). Uses the real watchexec, capturing each respawned
# deno's RSS via the listening port. Pairs with plateau-test.sh (the --watch climb) for the 2x2.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV="${ENV:-$REPO/.env.local}"
RELOADS="${RELOADS:-18}"
PORT=8094
set -a; source "$ENV" 2>/dev/null; set +a

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
ready(){ curl -s --max-time 4 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
portpid(){ ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1; }
hardkill(){ pkill -x watchexec 2>/dev/null; local p; p=$(portpid); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; sleep 0.3; }

run_external(){ local name=$1 file="$HERE/$2"
  echo "================= $name — watchexec -r (fresh process per change) ================="
  hardkill
  watchexec -r -q -w "$file" -- env PORT=$PORT deno run --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/xw.log 2>&1 &
  local wpid=$!
  local t=0; until ready; do sleep 0.1; t=$((t+1)); [ $t -gt 600 ] && { echo "  BOOT FAIL"; tail -5 /tmp/xw.log; kill -9 $wpid 2>/dev/null; return; }; done
  local pid; pid=$(portpid); local curve; curve="$(rss "$pid")"; local lat=""
  for i in $(seq 1 "$RELOADS"); do
    local old="$pid"; local t0; t0=$(date +%s%3N)
    echo "// reload $i $(date +%s%N)" >> "$file"          # the "edit" watchexec reacts to
    # wait for a FRESH pid bound to the port + ready
    local k=0; while :; do pid=$(portpid); [ -n "$pid" ] && [ "$pid" != "$old" ] && ready && break; sleep 0.03; k=$((k+1)); [ $k -gt 1000 ] && break; done
    local cold=$(( $(date +%s%3N) - t0 ))
    curl -s -o /dev/null "http://localhost:$PORT/api/feed/recent"   # one warm hit
    curve="$curve $(rss "$pid")"; lat="$lat $cold"
  done
  hardkill; sed -i '/^\/\/ reload [0-9]* [0-9]*$/d' "$file"
  echo "  RSS per fresh process: $curve"
  echo "$curve|$lat" | awk -F'|' '{
    n=split($1,a," "); split($2,b," ");
    lo=a[1]; hi=a[1]; for(i=1;i<=n;i++){if(a[i]<lo)lo=a[i]; if(a[i]>hi)hi=a[i];}
    ls=0; for(i=1;i<=split($2,b," ");i++) ls+=b[i]; meanlat=ls/(split($2,b," "));
    printf "  reloads=%d  RSS range %d-%d MB (spread %d)  | mean respawn latency %.0f ms\n", n-1, lo, hi, hi-lo, meanlat;
    print (hi-lo<60) ? "  => FLAT (no stacking) — fresh process per reload" : "  => NOT flat — unexpected";
  }'
}

echo "real DB: ${DATABASE_URL##*@}  |  reloads=$RELOADS via real watchexec -r"
run_external "minimal npm, raw SQL (jsr-feed: @db/postgres, only Clerk is npm)" jsr-feed.ts
run_external "minimal npm, ORM feel (kysely-feed: npm:kysely compiler + @db/postgres + clerk)" kysely-feed.ts
run_external "heavy npm (npm-feed: drizzle + postgres.js + clerk)"             npm-feed.ts
echo "done"
