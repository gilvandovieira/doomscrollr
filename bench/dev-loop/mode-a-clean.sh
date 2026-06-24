set -u
# --- portable paths (derived from this script's location) ---
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV="${ENV:-$REPO/.env.local}"
API="$REPO/apps/api"
WORK="${WORK:-$(mktemp -d -t dsr-bench-XXXXXX)}"
B="$WORK"
cp "$HERE/load.ts" "$B/load.ts" 2>/dev/null || true
echo "[work dir: $WORK]"
LEAF="$API/src/lib/og.ts"
PORT=8094; N=12; LOG="$B/A3.log"
rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
pidon(){ ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | head -1; }
hup(){ curl -s -o /dev/null --retry 60 --retry-connrefused --retry-delay 1 --max-time 50 "http://localhost:$PORT/health"; }
boots(){ grep -c api_starting "$LOG" 2>/dev/null; }
waitboots(){ local w=$1 dl=$(( $(date +%s%3N)+60000 )); while [ "$(boots)" -lt "$w" ]; do [ "$(date +%s%3N)" -gt "$dl" ] && return 1; done; }

cp "$LEAF" "$LEAF.bak"; : > "$LOG"
old=$(pidon); [ -n "$old" ] && kill -9 "$old" 2>/dev/null
( cd "$API" && taskset -c 0-3 env PORT=$PORT LOG_LEVEL=info deno run --watch \
    --allow-net --allow-env --allow-sys=hostname --env-file="$ENV" src/main.ts >"$LOG" 2>&1 & )
waitboots 1; hup; pid=$(pidon)
for w in 1 2 3; do hup; done                 # settle
series="$(rss "$pid")"; printf 'reload %2d: RSS=%4s MB (boots=%s pid=%s)\n' 0 "$(rss "$pid")" "$(boots)" "$pid"
for i in $(seq 1 $N); do
  echo "// watch-reload probe $i $(date +%s%N)" >> "$LEAF"
  waitboots $((i+1)) || { echo "reload $i timeout (boots=$(boots))"; break; }
  hup; cur=$(pidon); [ -z "$cur" ] && cur=$pid
  r=$(rss "$cur"); series="$series $r"
  printf 'reload %2d: RSS=%4s MB (boots=%s pid=%s)\n' "$i" "$r" "$(boots)" "$cur"
done
echo "series MB: $series"
kill -9 "$(pidon)" 2>/dev/null; pkill -9 -f 'deno run --watch' 2>/dev/null
mv "$LEAF.bak" "$LEAF"      # restore source exactly
echo "leaf restored: $(git -C $REPO status --porcelain src/lib/og.ts apps/api/src/lib/og.ts 2>/dev/null | head -1 || echo clean-ish)"
