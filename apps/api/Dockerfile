# ---- builder: produce a standalone, ahead-of-time compiled binary ----
# `deno compile` bundles the app + runtime so production does not pay `deno run`'s
# startup transpilation / retained module-graph cost. Measured: ~641 MB (deno run)
# -> ~226 MB (compiled) for this API, with no code changes. See RUNTIME_MEMORY_REPORT.md.
FROM denoland/deno:2.8.3 AS builder
WORKDIR /app
COPY deno.json deno.lock ./
# Workspace members must resolve; only apps/web's manifest is needed (it isn't imported).
COPY apps/web/deno.json ./apps/web/deno.json
COPY packages ./packages
COPY apps/api ./apps/api
RUN deno compile \
      --allow-net --allow-env --allow-sys=hostname \
      --lock=deno.lock \
      --output /app/server \
      apps/api/src/main.ts

# ---- runtime: minimal image, just the binary ----
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/server /app/server
ENV APP_ENV=production
EXPOSE 8000
USER nobody
CMD ["/app/server"]
