#!/usr/bin/env bash
# One-command repro of the `deno run --watch` per-reload RSS ramp (see ../../DENO_TEAM_FEEDBACK.md).
#
# Runs TWO bare Hono servers under `deno run --watch`, saves each file N times, and prints the process
# RSS after every reload. The ONLY difference between them is where `Hono` is imported from — the
# `npm:@clerk/backend` import is identical in both:
#
#   A) iso-jsr-hono-clerk.ts   jsr:@hono/hono + npm:@clerk/backend   → RAMPS linearly, never reclaims
#   B) iso-npm-hono-clerk.ts   npm:hono       + npm:@clerk/backend   → PLATEAUS, settles
#
# No database, no app, no .env — just Deno on PATH (tested on 2.9.0).
# Linux only: RSS is read from /proc/<pid>/status and the port is freed via `ss`.
#
# The ramp only appears with an on-disk node_modules (this repo sets `nodeModulesDir: "auto"`); run it from
# the repo root. Each case stops at CAP_MB (default 3000) so it can't OOM the machine.
#
# Usage (from the repo root):
#   bash bench/jsr-bench/repro-clerk-island.sh              # 30 reloads each, then a side-by-side summary
#   RELOADS=60 bash bench/jsr-bench/repro-clerk-island.sh   # let A climb toward the 3 GB cap
#   CAP_MB=1500 bash bench/jsr-bench/repro-clerk-island.sh  # lower the safety cap
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8094}"
RELOADS="${RELOADS:-30}"
RAMP_MB="${RAMP_MB:-15}"                       # ≥ this MB/reload average ⇒ we call it a ramp
CAP_MB="${CAP_MB:-3000}"                       # stop a case early once its RSS reaches this (avoid OOMing the box)
TASKSET=""; command -v taskset >/dev/null 2>&1 && TASKSET="taskset -c 0-3"
WORK=()

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
ready(){ curl -s --max-time 3 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
freeport(){ local p; p=$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; }
cleanup(){ freeport; for f in "${WORK[@]:-}"; do [ -n "${f:-}" ] && rm -f "$f"; done; }
trap cleanup EXIT

# soak <iso-file> — streams a per-reload line to the terminal (stderr); returns "file|start|end|perReload|verdict" on stdout
soak(){
  local src="$HERE/$1" work="$HERE/.work-$1" log="/tmp/repro-$1.log"
  cp "$src" "$work"; WORK+=("$work")
  freeport; : > "$log"
  # NOTE: --watch is what makes a file save restart the process in place (same PID). Without it there is no
  # reload and RSS never moves — that is the whole mechanism under test.
  PORT=$PORT $TASKSET deno run --watch --no-lock --allow-net --allow-env --allow-sys=hostname "$work" >"$log" 2>&1 &
  local pid=$! t0; t0=$(date +%s)
  until ready; do
    [ -d /proc/$pid ] || { echo "$1||||BOOT FAILED (see $log)"; return; }
    [ $(( $(date +%s)-t0 )) -gt 90 ] && { echo "$1||||BOOT TIMEOUT (see $log)"; return; }
  done
  curl -s -o /dev/null --max-time 3 "http://localhost:$PORT/api/feed/recent"   # serve one real request per generation
  local start last; start=$(rss $pid); last=$start
  printf '  %-24s boot  %5s MB\n' "$1" "$start" >&2
  local i dl
  for i in $(seq 1 "$RELOADS"); do
    echo "// reload $i $(date +%s%N)" >> "$work"          # a save → one in-place --watch restart
    dl=$(( $(date +%s)+30 ))
    while [ "$(grep -c Restarting "$log" 2>/dev/null)" -lt "$i" ]; do [ "$(date +%s)" -gt "$dl" ] && break; done
    until ready; do [ -d /proc/$pid ] || break; done
    curl -s -o /dev/null --max-time 3 "http://localhost:$PORT/api/feed/recent"
    last=$(rss $pid)
    printf '  %-24s r%-3d %5s MB   Δ+%s\n' "$1" "$i" "${last:-?}" "$(( ${last:-0}-start ))" >&2
    if [ -n "${last:-}" ] && [ "$last" -ge "$CAP_MB" ]; then
      printf '  %-24s reached %s MB cap at reload %d — stopping so it does not OOM the box.\n' "$1" "$CAP_MB" "$i" >&2
      break
    fi
  done
  freeport
  local per=$(( (last-start)/(RELOADS>0?RELOADS:1) )) verdict
  if [ "$per" -ge "$RAMP_MB" ]; then verdict="RAMPS   ~+${per} MB/reload, no reclaim"
  else                              verdict="plateaus ~${last} MB (~+${per}/reload)"; fi
  echo "$1|$start|$last|$per|$verdict"
}

command -v deno >/dev/null 2>&1 || { echo "deno not on PATH"; exit 1; }
echo "Deno: $(deno --version | head -1)"
echo "Reloads per case: $RELOADS   (one save = one --watch restart; the same PID's VmRSS is sampled each time)"
echo "No DB or .env needed — both are bare Hono servers with an identical npm:@clerk/backend import."
echo
echo "== A) jsr:@hono/hono + npm:@clerk/backend   (the reported ramp) =="
A=$(soak iso-jsr-hono-clerk.ts)
echo
echo "== B) npm:hono + npm:@clerk/backend   (control: SAME Clerk, npm framework) =="
B=$(soak iso-npm-hono-clerk.ts)
echo
echo "======================== SUMMARY ========================"
printf '%-24s %8s   %-8s  %s\n' "case" "start" "end" "verdict"
IFS='|' read -r f s e p v <<<"$A"; printf '%-24s %5s MB   %5s MB  %s\n' "$f" "${s:-?}" "${e:-?}" "$v"
IFS='|' read -r f s e p v <<<"$B"; printf '%-24s %5s MB   %5s MB  %s\n' "$f" "${s:-?}" "${e:-?}" "$v"
echo "---------------------------------------------------------"
echo "Same npm:@clerk/backend in both; only the Hono loader differs."
echo "A keeps growing and never reclaims; B settles. That is the bug."
