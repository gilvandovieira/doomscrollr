#!/usr/bin/env bash
# Does the +64 MB/reload retention ramp forever (blow up) or plateau (Deno reclaims lazily)?
# Long --watch reload loop, no load, sampling RSS every reload, with a hard memory guard.
# If trailing Δ/reload decays toward 0 → plateau (bounded). If it stays ~64 → linear → blowup.
#   FEED=kysely-feed.ts MAXRELOADS=50 GUARD=2700 ./plateau-test.sh
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV="${ENV:-$REPO/.env.local}"
FEED="${FEED:-kysely-feed.ts}"; file="$HERE/$FEED"
MAXRELOADS="${MAXRELOADS:-50}"; GUARD="${GUARD:-2700}"
PORT=8094
set -a; source "$ENV" 2>/dev/null; set +a

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
ready(){ curl -s --max-time 4 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
up(){ curl -s -o /dev/null --max-time 0.5 "http://localhost:$PORT/health" 2>/dev/null; }
killport(){ local p; p=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; for k in $(seq 1 15); do up || break; done; }

echo "feed=$FEED  max_reloads=$MAXRELOADS  guard=${GUARD}MB  (no load)"
killport; : > /tmp/plw.log
PORT=$PORT taskset -c 0-3 deno run --watch --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/plw.log 2>&1 &
pid=$!; until ready; do [ -d /proc/$pid ] || { echo "BOOT FAIL"; tail -5 /tmp/plw.log; exit 1; }; done
s0="$(rss "$pid")"; curve="$s0"; echo "reload 0 (boot): ${s0}MB"
for i in $(seq 1 "$MAXRELOADS"); do
  echo "// reload $i $(date +%s%N)" >> "$file"
  dl=$(($(date +%s%3N)+25000))
  while [ "$(grep -c Restarting /tmp/plw.log 2>/dev/null)" -lt "$i" ]; do [ "$(date +%s%3N)" -gt "$dl" ] && break; [ -d /proc/$pid ] || break; done
  until ready; do [ -d /proc/$pid ] || break; done
  r="$(rss "$pid")"; curve="$curve $r"
  [ $((i % 5)) -eq 0 ] && echo "  reload $i: ${r}MB"
  if [ -n "$r" ] && [ "$r" -gt "$GUARD" ]; then echo "  >>> hit guard ${GUARD}MB at reload $i — stopping"; break; fi
done
killport
sed -i '/^\/\/ reload [0-9]* [0-9]*$/d' "$file"

echo "curve: $curve"
# decay check: mean Δ over first 5 reloads vs last 5 reloads
echo "$curve" | awk '{
  n=NF; if(n<6){print "too few points"; exit}
  first_lo=$1; first_hi=$6; firstD=(first_hi-first_lo)/5;
  last_hi=$n; last_lo=$(n-5); lastD=(last_hi-last_lo)/5;
  printf "first-5 Δ/reload = +%.0f MB   last-5 Δ/reload = +%.0f MB\n", firstD, lastD;
  if(lastD < firstD*0.5) print "=> SLOPE DECAYING -> plateauing (bounded)";
  else print "=> SLOPE ~FLAT -> still linear (would keep climbing)";
}'
