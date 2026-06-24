FROM denoland/deno:2.8.3

WORKDIR /app

COPY deno.json deno.lock ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN deno cache --frozen --lock=deno.lock apps/api/src/main.ts

ENV APP_ENV=production
EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-sys=hostname", "apps/api/src/main.ts"]
