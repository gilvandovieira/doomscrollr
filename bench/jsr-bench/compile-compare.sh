#!/usr/bin/env bash
# Does `deno compile` help the JSR stack the way it helped the npm stack (641->226)?
# Answer: no. It converges both stacks to a fixed ~234 MB binary floor — a 2.7x WIN for
# the npm/Drizzle stack, but a ~1.5x LOSS for the JSR stack (whose `deno run` is already
# lighter than the compiled binary's embedded-runtime baseline).
#
# Measures warm RSS + startup peak for `deno run` vs a `deno compile` binary, matched
# feed servers, same real Postgres. Run from anywhere; needs the repo's .env.local
# (DATABASE_URL) and Postgres up (`docker compose up -d`).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV="${ENV:-$REPO/.env.local}"
BIN="$(mktemp -d)"; trap 'rm -rf "$BIN"' EXIT
PORT="${PORT:-8094}"
set -a; source "$ENV" 2>/dev/null; set +a
echo "DB: ${DATABASE_URL##*@}  | binaries -> $BIN"

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
hwm(){ awk '/VmHWM/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
ready(){ curl -s --max-time 4 "http://localhost:$PORT/ready" 2>/dev/null | grep -q '"ok"'; }
killport(){ local p; p=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$p" ] && kill -9 "$p" 2>/dev/null; for k in $(seq 1 20); do curl -s -o /dev/null --max-time 0.3 "http://localhost:$PORT/health" 2>/dev/null || break; done; }

# warm the server (40 real /feed queries), then report "warm peak"
warm_measure(){ local pid=$1
  for i in $(seq 1 40); do curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/api/feed/recent"; done
  sleep 1; echo "$(rss "$pid") $(hwm "$pid")"; }

run_mode(){ local label=$1 file="$HERE/$2"
  killport; local t0 cold pid; t0=$(date +%s%3N)
  PORT=$PORT taskset -c 0-3 deno run --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" "$file" >/tmp/cj.log 2>&1 &
  pid=$!
  until ready; do [ -d /proc/$pid ] || { echo "  $label deno-run BOOT FAIL"; tail -4 /tmp/cj.log; return; }; [ "$(($(date +%s%3N)-t0))" -gt 60000 ] && { echo "  BOOT TIMEOUT"; return; }; done
  cold=$(( $(date +%s%3N) - t0 )); read warm peak <<<"$(warm_measure "$pid")"
  printf '  %-4s deno run      cold=%4sms  warm=%4sMB  peak=%4sMB\n' "$label" "$cold" "$warm" "$peak"
  killport; }

compile_mode(){ local label=$1 file="$HERE/$2" out="$BIN/$3"
  killport; rm -f "$out"; local cstart csec
  cstart=$(date +%s%3N)
  if ! deno compile --allow-net --allow-env --allow-sys=hostname --output "$out" "$file" >/tmp/cjc.log 2>&1; then
    echo "  $label COMPILE FAIL:"; tail -8 /tmp/cjc.log; return; fi
  csec=$(( $(date +%s%3N) - cstart )); local mb=$(( $(stat -c %s "$out")/1024/1024 ))
  local t0 cold pid; t0=$(date +%s%3N)
  PORT=$PORT taskset -c 0-3 env DATABASE_URL="$DATABASE_URL" "$out" >/tmp/cjb.log 2>&1 &
  pid=$!
  until ready; do [ -d /proc/$pid ] || { echo "  $label binary BOOT FAIL"; tail -4 /tmp/cjb.log; return; }; [ "$(($(date +%s%3N)-t0))" -gt 60000 ] && { echo "  BOOT TIMEOUT"; return; }; done
  cold=$(( $(date +%s%3N) - t0 )); read warm peak <<<"$(warm_measure "$pid")"
  printf '  %-4s deno compile  cold=%4sms  warm=%4sMB  peak=%4sMB  | compile=%sms bin=%sMB\n' "$label" "$cold" "$warm" "$peak" "$csec" "$mb"
  killport; }

echo "===== JSR stack (@hono/hono + @db/postgres + @std/log + @zod/zod, clerk floor) ====="
run_mode     "JSR" jsr-feed.ts
compile_mode "JSR" jsr-feed.ts jsr-bin
echo "===== npm stack (hono + drizzle + postgres.js + pino + zod + clerk) ====="
run_mode     "npm" npm-feed.ts
compile_mode "npm" npm-feed.ts npm-bin
echo "done"
