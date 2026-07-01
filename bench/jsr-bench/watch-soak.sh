#!/usr/bin/env bash
# Generic long `--watch` soak: does per-reload RSS ramp to OOM, or plateau?
# Usage:   [CAP_MB=3000] [MAX_RELOADS=60] bash watch-soak.sh <feed-file.ts>
#   e.g.   MAX_RELOADS=160 bash watch-soak.sh npm-feed.ts
# Method: pure module-graph retention — append a comment (→ --watch restarts in place), wait for
#   /ready, warm the feed once, sample process RSS. No sustained load (matches the 2.8.3 plateau-test).
# Stops on: (a) RSS >= CAP_MB (ramping), (b) plateau (last-10-reload growth < PLATEAU_MB), or (c) MAX_RELOADS.
# The cap is a LOOP-level stop (not a cgroup limit — a hard cgroup cap forces reclamation and fakes a plateau).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ENV="$ROOT/.env.local"
AGE="--minimum-dependency-age=0 --no-lock"
FILE="$HERE/${1:-sisal-pgjs-feed.ts}"
PORT=8094
CAP_MB="${CAP_MB:-3000}"
MAX_RELOADS="${MAX_RELOADS:-60}"
PLATEAU_MB="${PLATEAU_MB:-20}"   # <this much growth over the last 10 reloads (after ≥20) ⇒ plateau
set -a; source "$ENV" 2>/dev/null; set +a

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
ready(){ curl -s --max-time 4 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
kill8094(){ local p; p=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; }
cleanup(){ kill8094; sed -i '/^\/\/ reload [0-9]* [0-9]*$/d' "$FILE"; }
trap cleanup EXIT

# Only the DB-backed feed stacks need Postgres; the bare iso-*.ts servers don't touch DATABASE_URL.
if grep -q DATABASE_URL "$FILE"; then
  bash -c 'echo > /dev/tcp/localhost/5433' 2>/dev/null || { echo "DB :5433 down"; exit 1; }
fi
echo "Deno: $(deno --version | head -1)"
echo "stack: $(basename "$FILE")  cap=${CAP_MB}MB  max_reloads=${MAX_RELOADS}  plateau_if<${PLATEAU_MB}MB/10reloads"

kill8094; : > /tmp/soak.log
PORT=$PORT taskset -c 0-3 deno run $AGE --watch --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$FILE" >/tmp/soak.log 2>&1 &
pid=$!
t0=$(date +%s); until ready; do [ -d /proc/$pid ] || { echo "BOOT FAIL"; tail -15 /tmp/soak.log; exit 1; }; [ $(( $(date +%s)-t0 )) -gt 90 ] && { echo "BOOT TIMEOUT"; exit 1; }; done
curl -s -o /dev/null --max-time 3 "http://localhost:$PORT/api/feed/recent"
start=$(rss "$pid"); declare -a S=("$start"); traj="$start"
printf 'boot: RSS=%sMB\n' "$start"

verdict=""; reached=0
for i in $(seq 1 "$MAX_RELOADS"); do
  echo "// reload $i $(date +%s%N)" >> "$FILE"
  dl=$(($(date +%s%3N)+30000)); while [ "$(grep -c Restarting /tmp/soak.log 2>/dev/null)" -lt "$i" ]; do [ "$(date +%s%3N)" -gt "$dl" ] && break; done
  until ready; do [ -d /proc/$pid ] || break; done
  curl -s -o /dev/null --max-time 3 "http://localhost:$PORT/api/feed/recent"
  r=$(rss "$pid"); S+=("$r"); traj="$traj $r"; reached=$i
  printf 'reload %2d: RSS=%sMB  Δstart=+%sMB\n' "$i" "${r:-?}" "$(( ${r:-0} - start ))"
  if [ -n "$r" ] && [ "$r" -ge "$CAP_MB" ]; then verdict="RAMPS — hit the ${CAP_MB}MB cap at reload $i; does NOT cap out."; break; fi
  if [ "$i" -ge 20 ]; then
    prev="${S[$((i-10))]}"; grow=$(( r - prev ))
    if [ "$grow" -lt "$PLATEAU_MB" ]; then verdict="PLATEAUS — last 10 reloads grew only +${grow}MB (≈+$(( grow/10 ))MB/reload) at ~${r}MB."; break; fi
  fi
done

last=$(echo $traj | awk '{print $NF}')
tail_avg=$(echo $traj | awk '{n=NF; if(n>=11){print int(($n-$(n-10))/10)} else if(n>=2){print int(($n-$1)/(n-1))} else print 0}')
echo "---"
echo "trajectory(MB): $traj"
echo "reloads=$reached  start=${start}MB  end=${last}MB  total=+$(( last-start ))MB  overall_avg=+$(( (last-start)/(reached>0?reached:1) ))MB/reload  last10_avg=+${tail_avg}MB/reload"
[ -z "$verdict" ] && verdict="STILL CLIMBING at reload ${reached} (last-10 avg +${tail_avg}MB/reload); neither plateaued nor hit ${CAP_MB}MB within MAX_RELOADS."
echo "VERDICT: $verdict"
