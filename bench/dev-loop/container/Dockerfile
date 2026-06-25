# Reproduces the `deno run --watch` reload retention in a clean, stock-glibc environment:
# official denoland/deno image (Debian bookworm, stock glibc) + the same official deno binary.
# If RSS still grows here, the issue is Deno's --watch, not the host (CachyOS/optimized glibc/kernel).
FROM denoland/deno:2.8.3

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY deno.json deno.lock ./
COPY apps/web/deno.json ./apps/web/deno.json
COPY packages ./packages
COPY apps/api ./apps/api
COPY bench/dev-loop/container/repro.sh /repro.sh
RUN chmod +x /repro.sh \
    && deno cache apps/api/src/main.ts packages/database/src/migrate.ts packages/database/src/seed.ts || echo "cache warn"

ENV APP_ENV=development LOG_LEVEL=fatal
ENTRYPOINT ["/repro.sh"]
