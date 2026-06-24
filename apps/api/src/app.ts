import { Hono } from "hono";
import { cors } from "hono/cors";
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
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];
const configuredWebOrigin = Deno.env.get("WEB_ORIGIN");

app.use(
  "*",
  cors({
    origin: configuredWebOrigin
      ? [...new Set([...DEFAULT_CORS_ORIGINS, configuredWebOrigin])]
      : DEFAULT_CORS_ORIGINS,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-request-id"],
    credentials: true,
  }),
);
app.use("*", requestLogger);

app.onError(errorHandler);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    service: "doomscrollr-api",
    now: new Date().toISOString(),
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
