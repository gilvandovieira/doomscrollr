#!/usr/bin/env bash
# In-container --watch reload retention test (real app, real DB traffic).
# sleeps are fine here — this runs inside the container, not the orchestrator.
set -u
PORT="${PORT:-8094}"; N="${N:-6}"

echo "runtime: $(deno --version | head -1)"
echo "glibc:   $(ldd --version | head -1)"
echo "DATABASE_URL host: ${DATABASE_URL##*@}"

echo "migrate + seed..."
deno run --allow-env --allow-net --allow-read packages/database/src/migrate.ts >/dev/null 2>&1 || { echo "migrate failed"; exit 1; }
deno run --allow-env --allow-net packages/database/src/seed.ts >/dev/null 2>&1 || echo "seed warn"

cd apps/api
env PORT="$PORT" LOG_LEVEL=info deno run --watch --allow-net --allow-env --allow-sys=hostname src/main.ts >/tmp/app.log 2>&1 &
PID=$!
echo "deno --watch pid=$PID"

# wait until the DB-backed app is actually ready (up to 60s), else dump the log and bail
READY=""
for i in $(seq 1 240); do READY="$(curl -s --max-time 2 "http://localhost:$PORT/ready" 2>/dev/null)"; case "$READY" in *'"ok"'*) break;; esac; sleep 0.25; done
echo "ready: $READY"
FEED="$(curl -s -o /dev/null -w '%{http_code} %{size_download}B' --max-time 3 "http://localhost:$PORT/api/feed/recent")"
echo "feed : $FEED  (expect 200 ~18000B once seeded)"
case "$READY" in *'"ok"'*) : ;; *) echo "APP NOT READY — app.log:"; cat /tmp/app.log; kill -9 "$PID" 2>/dev/null; exit 1;; esac

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$PID/status" 2>/dev/null; }

CONC="${CONC:-6}"; TARGET_MB="${TARGET_MB:-3000}"; NMAX="${NMAX:-80}"
# concurrent real traffic against the DB-backed route (amplifies per-reload retention)
LOADPIDS=""
for c in $(seq 1 "$CONC"); do
  ( while kill -0 "$PID" 2>/dev/null; do curl -s -o /dev/null "http://localhost:$PORT/api/feed/recent" 2>/dev/null; done ) &
  LOADPIDS="$LOADPIDS $!"
done
sleep 1

echo "----- in-container --watch RSS across reloads (load=${CONC} concurrent, stop at ${TARGET_MB} MB) -----"
prev="$(rss)"; printf 'reload %2d: RSS=%5s MB\n' 0 "$prev"
for i in $(seq 1 "$NMAX"); do
  echo "// container reload $i $(date +%s%N)" >> src/lib/og.ts   # trigger --watch (container-local copy)
  sleep 4                                                        # let it reload + settle
  for j in $(seq 1 50); do curl -sf -o /dev/null "http://localhost:$PORT/health" 2>/dev/null && break; sleep 0.1; done
  r="$(rss)"; [ -z "$r" ] && r="$prev"; d=$((r - prev)); prev="$r"
  printf 'reload %2d: RSS=%5s MB  (+%s/reload)\n' "$i" "$r" "$d"
  [ "$r" -ge "$TARGET_MB" ] && { echo ">>> reached ${TARGET_MB} MB at reload $i"; break; }
done

kill $LOADPIDS 2>/dev/null; kill -9 "$PID" 2>/dev/null
echo "---------------------------------------------------"
echo "If this series GROWS like the host (~+0.5 GB/reload), the retention is Deno's --watch,"
echo "independent of CachyOS/optimized glibc/kernel. If FLAT, it is environment-specific."
