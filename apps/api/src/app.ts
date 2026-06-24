import { readServerEnv } from "@doomscrollr/config/env.ts";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { checkDatabaseReady, hasDatabase } from "./db/client.ts";
import { renderDefaultOgImageSvg } from "./lib/og.ts";
import { errorHandler } from "./middleware/error-handler.ts";
import { requestLogger } from "./middleware/request-logger.ts";
import { accountRoutes } from "./routes/account.routes.ts";
import { adminRoutes } from "./routes/admin.routes.ts";
import { commentsRoutes } from "./routes/comments.routes.ts";
import { eventsRoutes } from "./routes/events.routes.ts";
import { feedRoutes } from "./routes/feed.routes.ts";
import { notificationsRoutes } from "./routes/notifications.routes.ts";
import { pageRoutes } from "./routes/pages.routes.ts";
import { postsRoutes } from "./routes/posts.routes.ts";
import { reportsRoutes } from "./routes/reports.routes.ts";
import { tagsRoutes } from "./routes/tags.routes.ts";
import { usersRoutes } from "./routes/users.routes.ts";
import { youtubeRoutes } from "./routes/youtube.routes.ts";

export const app = new Hono();
const env = readServerEnv();
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const corsOrigins = env.APP_ENV === "production"
  ? [env.WEB_ORIGIN]
  : [...new Set([...DEFAULT_CORS_ORIGINS, env.WEB_ORIGIN])];

app.use(
  "*",
  cors({
    origin: corsOrigins,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-request-id"],
    credentials: true,
  }),
);
app.use("*", securityHeaders());
app.use("*", requestLogger);

app.onError(errorHandler);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "doomscrollr-api",
    now: new Date().toISOString(),
  }));

app.get("/ready", async (c) => {
  if (!hasDatabase()) {
    return c.json({ status: "not_ready", checks: { database: "missing" } }, 503);
  }

  const databaseReady = await checkDatabaseReady();
  if (!databaseReady) {
    return c.json({ status: "not_ready", checks: { database: "unavailable" } }, 503);
  }

  return c.json({ status: "ready", checks: { database: "ok" } });
});

app.get("/og-default.svg", (c) =>
  c.body(renderDefaultOgImageSvg(), 200, {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=31536000, immutable",
  }));

app.route("/api/feed", feedRoutes);
app.route("/api/posts", postsRoutes);
app.route("/api/comments", commentsRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/tags", tagsRoutes);
app.route("/api/youtube", youtubeRoutes);
app.route("/api/events", eventsRoutes);
app.route("/api/notifications", notificationsRoutes);
app.route("/api/account", accountRoutes);
app.route("/api/reports", reportsRoutes);
app.route("/api/admin", adminRoutes);

// Server-rendered canonical post pages. Registered before any SPA fallback so
// crawlers read Open Graph metadata without executing JavaScript (spec §11).
app.route("/p", pageRoutes);

function securityHeaders(): MiddlewareHandler {
  const csp = buildContentSecurityPolicy();

  return async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    );
    c.header("Content-Security-Policy", csp);
    if (env.APP_ENV === "production") {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    await next();
  };
}

function sourceOrigin(value: string): string {
  return new URL(value).origin;
}

function buildContentSecurityPolicy(): string {
  const appOrigin = sourceOrigin(env.PUBLIC_BASE_URL);
  const webOrigin = sourceOrigin(env.WEB_ORIGIN);
  const connectSources = [...new Set(["'self'", appOrigin, webOrigin])];
  const frameAncestors = [...new Set(["'self'", webOrigin])];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${frameAncestors.join(" ")}`,
    "form-action 'self' https://*.clerk.com https://*.clerk.accounts.dev",
    "script-src 'self' 'unsafe-inline' https://*.clerk.com https://*.clerk.accounts.dev https://www.youtube.com https://s.ytimg.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https: http:",
    "media-src 'self' https: http:",
    `connect-src ${connectSources.join(" ")} https://*.clerk.com https://*.clerk.accounts.dev`,
    "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://*.clerk.com https://*.clerk.accounts.dev",
  ];

  if (env.APP_ENV === "production") directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
