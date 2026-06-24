#!/usr/bin/env bash
# Hard-hitting runtime comparison: cold start, throughput, latency, memory under load.
# Runs the SAME app on deno run / deno compile / Node / Bun against the live DB.
#
# Prerequisites (see README.md):
#   - deno, bun, node on PATH; a reachable Postgres via $ENV_FILE's DATABASE_URL
#   - Node/Bun worktrees prepared with the shim (bench/shim/*) and deps installed
#
# Override any path via env vars:
#   ENV_FILE=/path/.env.local BUN_WT=/path/wt-bun NODE_WT=/path/wt-node ./bench-comprehensive.sh
set -u
BENCH_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$BENCH_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO/.env.local}"
BUN_WT="${BUN_WT:-${REPO}-bun}"
NODE_WT="${NODE_WT:-${REPO}-node}"
DENO_BIN="${DENO_BIN:-$BENCH_DIR/api-deno-bin}"
LOAD="$BENCH_DIR/load.ts"

# server pinned to cores 0-3, load generator to 4-15 (fair, no CPU contention)
PIN="${PIN:-taskset -c 0-3}"
LOADGEN="${LOADGEN:-taskset -c 4-15 bun $LOAD}"

set -a; source "$ENV_FILE" 2>/dev/null; set +a   # child servers inherit DATABASE_URL etc.

# Build the standalone Deno binary if it isn't present.
if [ ! -x "$DENO_BIN" ]; then
  echo "compiling deno binary -> $DENO_BIN"
  ( cd "$REPO/apps/api" && deno compile --allow-net --allow-env --allow-sys=hostname \
      --output "$DENO_BIN" src/main.ts )
fi

run_mode() {
  local label=$1 port=$2 pat=$3 wd=$4; shift 4
  local log="$BENCH_DIR/cmp-$label.log" t0 t1 pid
  t0=$(date +%s%3N)
  ( cd "$wd" && $PIN env PORT=$port "$@" >"$log" 2>&1 & )
  local deadline=$((t0 + 60000))
  until curl -s -o /dev/null --max-time 2 "http://localhost:$port/health" 2>/dev/null; do
    [ "$(date +%s%3N)" -gt "$deadline" ] && { echo "=== $label: BOOT FAILED ==="; tail -15 "$log"; return 1; }
  done
  t1=$(date +%s%3N)
  pid=$(ss -ltnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1)
  [ -z "$pid" ] && pid=$(pgrep -nf "$pat")
  local idle; idle=$(awk '/VmRSS/{print $2}' /proc/$pid/status 2>/dev/null)

  $LOADGEN "http://localhost:$port/api/feed/recent" 8 2 >/dev/null 2>&1   # warmup
  local h f peak retain th
  h=$($LOADGEN "http://localhost:$port/health" 100 8 2>/dev/null)
  f=$($LOADGEN "http://localhost:$port/api/feed/recent" 50 12 2>/dev/null)
  peak=$(awk '/VmHWM/{print $2}' /proc/$pid/status 2>/dev/null)
  retain=$(awk '/VmRSS/{print $2}' /proc/$pid/status 2>/dev/null)
  th=$(awk '/Threads/{print $2}' /proc/$pid/status 2>/dev/null)

  echo "=== $label ==="
  echo "  cold_start=$((t1-t0))ms  idle=$((idle/1024))MB  peak_under_load=$((peak/1024))MB  retained_after=$((retain/1024))MB  threads=$th"
  echo "  /health   (100c/8s) : $h"
  echo "  /feed/recent(50c/12s): $f"
  kill "$pid" 2>/dev/null
  for i in $(seq 1 15); do curl -s --max-time 1 "http://localhost:$port/health" >/dev/null 2>&1 || break; done
  kill -9 "$pid" 2>/dev/null
}

echo "machine: $(nproc) cores | server pinned ${PIN##* } | env=$ENV_FILE"
run_mode deno-run      8090 'apps/api/src/main.ts' "$REPO/apps/api" \
  deno run --allow-net --allow-env --allow-sys=hostname src/main.ts
run_mode deno-compiled 8093 "$(basename "$DENO_BIN")" "$REPO/apps/api" \
  "$DENO_BIN"
run_mode node          8091 'boot.ts' "$NODE_WT" \
  node --import tsx boot.ts
run_mode bun           8092 'boot.ts' "$BUN_WT" \
  bun boot.ts
echo "done."
