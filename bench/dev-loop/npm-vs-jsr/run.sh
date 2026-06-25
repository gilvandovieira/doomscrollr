#!/usr/bin/env bash
# npm: vs JSR — does `deno run --watch` retain memory across reloads?
#
# Decisive control: the retention is Deno's npm / Node-compatibility module layer, NOT the watcher.
#   - a 327-module JSR graph stays flat (~+6 MB/reload)
#   - a 10-module npm graph balloons (~+550 MB/reload)
#   => it's the dependency *kind* (npm vs jsr), not graph size.
#
# Must run from inside the repo working tree: Deno's file watcher did NOT pick up edits in /tmp,
# so the watched files are created in a temp dir under the repo.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WT="$REPO/.npm-vs-jsr-tmp"; PORT="${PORT:-8094}"; N="${N:-5}"; REPS="${REPS:-1}"; GUARD="${GUARD:-3000}"
mkdir -p "$WT"; trap 'rm -rf "$WT"' EXIT
w(){ cat > "$WT/$1"; }

w npm0.ts <<'TS'
Deno.serve({ port: 8094 }, () => new Response("ok"));
TS
w npm-hono.ts <<'TS'
import { Hono } from "npm:hono@^4.8.12";
const a = new Hono(); a.get("/health", (c) => c.text("ok"));
Deno.serve({ port: 8094 }, a.fetch);
TS
# SAME library, jsr resolution — the decisive isolation (npm-compat vs library/bytes)
w jsr-hono.ts <<'TS'
import { Hono } from "jsr:@hono/hono@^4.8.12";
const a = new Hono(); a.get("/health", (c) => c.text("ok"));
Deno.serve({ port: 8094 }, a.fetch);
TS
w npm-full.ts <<'TS'
import { Hono } from "npm:hono@^4.8.12";
import { verifyToken } from "npm:@clerk/backend@^3.7.1";
import { drizzle } from "npm:drizzle-orm@^0.44.5/postgres-js";
import postgres from "npm:postgres@^3.4.7";
import pino from "npm:pino@^9.7.0";
import { z } from "npm:zod@^3.25.76";
void [verifyToken, drizzle, postgres, pino, z];
const a = new Hono(); a.get("/health", (c) => c.text("ok"));
Deno.serve({ port: 8094 }, a.fetch);
TS
w jsr-oak.ts <<'TS'
import { Application, Router } from "jsr:@oak/oak";
const r = new Router(); r.get("/health", (c) => { c.response.body = "ok"; });
const a = new Application(); a.use(r.routes()); a.listen({ port: 8094 });
TS
w jsr-full.ts <<'TS'
import { Application, Router } from "jsr:@oak/oak";
import * as log from "jsr:@std/log";
import { Client } from "jsr:@db/postgres";
const c = new Client("postgres://u:p@localhost:5432/db"); void c; log.info("up");
const r = new Router(); r.get("/health", (x) => { x.response.body = "ok"; });
const a = new Application(); a.use(r.routes()); a.listen({ port: 8094 });
TS
w jsr-heavy.ts <<'TS'
import { Application, Router } from "jsr:@oak/oak";
import * as log from "jsr:@std/log";
import { Client } from "jsr:@db/postgres";
import * as path from "jsr:@std/path";
import * as fs from "jsr:@std/fs";
import * as enc from "jsr:@std/encoding";
import * as asyncu from "jsr:@std/async";
import * as col from "jsr:@std/collections";
import * as crypto from "jsr:@std/crypto";
import * as dt from "jsr:@std/datetime";
import * as http from "jsr:@std/http";
import * as streams from "jsr:@std/streams";
void [log, Client, path, fs, enc, asyncu, col, crypto, dt, http, streams];
const r = new Router(); r.get("/health", (c) => { c.response.body = "ok"; });
const a = new Application(); a.use(r.routes()); a.listen({ port: 8094 });
TS

rss(){ awk '/VmRSS/{print int($2/1024)}' "/proc/$1/status" 2>/dev/null; }
up(){ curl -s -o /dev/null --retry 50 --retry-connrefused --retry-delay 1 --max-time 30 "http://localhost:$PORT/health" 2>/dev/null; }
once(){ local f="$WT/$1" log="$WT/r.log"; : > "$log"
  local old; old=$(ss -ltnp 2>/dev/null|grep ":$PORT "|grep -oP 'pid=\K[0-9]+'|head -1); [ -n "$old" ] && kill -9 "$old" 2>/dev/null
  PORT=$PORT taskset -c 0-3 deno run --watch --allow-net --allow-env --allow-sys=hostname "$f" > "$log" 2>&1 &
  local pid=$!; up; local s; s="$(rss "$pid")"
  for i in $(seq 1 "$N"); do echo "// r $i $(date +%s%N)" >> "$f"
    local dl=$(($(date +%s%3N)+20000)); while [ "$(grep -c Restarting "$log" 2>/dev/null)" -lt "$i" ]; do [ "$(date +%s%3N)" -gt "$dl" ] && break; done
    up; local r=$(rss "$pid"); s="$s $r"; [ -n "$r" ] && [ "$r" -gt "$GUARD" ] && { s="$s [>${GUARD}MB:stop]"; break; }
  done
  local rc=$(grep -c Restarting "$log"); kill -9 "$pid" 2>/dev/null
  local first=$(echo $s|awk '{print $1}') last=$(echo $s|awk '{for(i=NF;i>=1;i--)if($i ~ /^[0-9]+$/){print $i;break}}')
  printf 'restarts=%s  ~%s MB/reload   [%s]\n' "$rc" "$(( (last-first)/N ))" "$s"
}
echo "no-load --watch retention ($N reloads, guard ${GUARD}MB, REPS=$REPS) — server pinned to cores 0-3"
printf '%-11s %-8s %s\n' "config" "modules" "result"
for cfg in npm0 npm-hono jsr-hono npm-full jsr-oak jsr-full jsr-heavy; do
  deno cache "$WT/$cfg.ts" >/dev/null 2>&1
  m=$(deno info --json "$WT/$cfg.ts" 2>/dev/null | python3 -c 'import sys,json;print(len(json.load(sys.stdin).get("modules",[])))' 2>/dev/null)
  for rep in $(seq 1 "$REPS"); do printf '%-11s %-8s ' "$cfg" "${m:-?}"; once "$cfg.ts"; done
done
