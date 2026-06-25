#!/usr/bin/env bash
# Memory benchmark of the Lambda image (doomscrollr-api:lambda) — what sizes the Lambda function.
# Lambda enforces a hard memory ceiling and reports "Max Memory Used" (~ peak RSS), so VmHWM is the
# number that matters. Runs the compiled binary (same one LWA fronts in Lambda) against the dev DB.
#
# CAVEAT: this runs with FULL host CPU and NO memory cap. The MEMORY numbers transfer to Lambda; the
# cold-start / throughput numbers are OPTIMISTIC — a 512 MB Lambda gets ~0.3 vCPU, so it'd be slower.
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
set -a; source "$REPO/.env.local" 2>/dev/null; set +a
IMAGE="${IMAGE:-doomscrollr-api:lambda}"
NAME=lwa-bench
PORT=8011
LOAD="$REPO/bench/load.ts"

cleanup(){ docker rm -f "$NAME" >/dev/null 2>&1; }
trap cleanup EXIT
pstat(){ docker exec "$NAME" cat /proc/1/status 2>/dev/null; }
vmrss(){ pstat | awk '/VmRSS/{print int($2/1024)}'; }
vmhwm(){ pstat | awk '/VmHWM/{print int($2/1024)}'; }
cg(){ docker stats --no-stream --format '{{.MemUsage}}' "$NAME" 2>/dev/null; }
ready(){ curl -s --max-time 3 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }

cleanup
t0=$(date +%s%3N)
docker run -d --name "$NAME" --network host \
  -e APP_ENV=development -e DATABASE_URL="$DATABASE_URL" -e PORT=$PORT \
  -e PUBLIC_BASE_URL=http://localhost:$PORT -e WEB_ORIGIN=http://localhost:5173 \
  --entrypoint /app/server "$IMAGE" >/dev/null 2>&1
until ready; do [ "$(($(date +%s%3N)-t0))" -gt 30000 ] && { echo "BOOT FAIL"; docker logs "$NAME" 2>&1|tail; exit 1; }; sleep 0.05; done
cold=$(( $(date +%s%3N) - t0 ))

sleep 1
idle_rss=$(vmrss); idle_hwm=$(vmhwm); idle_cg=$(cg)

# closed-loop load on the real feed query
feed=$(taskset -c 8-15 bun "$LOAD" "http://localhost:$PORT/api/feed/recent" 12 10 2>/dev/null)
load_rss=$(vmrss); peak_hwm=$(vmhwm); load_cg=$(cg)
cleanup; trap - EXIT

echo "=============== Lambda image memory benchmark ($IMAGE) ==============="
printf '  cold start (boot -> /ready ok) : %s ms   (process init; image-load is separate & Lambda-cached)\n' "$cold"
printf '  idle    : VmRSS %s MB   VmHWM %s MB   cgroup %s\n' "$idle_rss" "$idle_hwm" "$idle_cg"
printf '  +load   : VmRSS %s MB   VmHWM %s MB   cgroup %s\n' "$load_rss" "$peak_hwm" "$load_cg"
printf '  feed load: %s\n' "$feed"
echo
echo "  Lambda 'Max Memory Used' ~ peak VmHWM ($peak_hwm MB) + LWA ext (~3 MB) + runtime base (~30-40 MB)."
hwm=$peak_hwm
for tier in 256 512 1024; do
  need=$(( hwm + 45 ))
  printf '  fits %s MB Lambda? %s\n' "$tier" "$([ "$need" -lt "$tier" ] && echo "yes (need ~${need} MB)" || echo "NO (need ~${need} MB)")"
done
