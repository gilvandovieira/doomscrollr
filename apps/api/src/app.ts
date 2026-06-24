import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error-handler.ts";
import { requestLogger } from "./middleware/request-logger.ts";
import { commentsRoutes } from "./routes/comments.routes.ts";
import { gifsRoutes } from "./routes/gifs.routes.ts";
import { mediaRoutes } from "./routes/media.routes.ts";
import { moderationRoutes } from "./routes/moderation.routes.ts";
import { postsRoutes } from "./routes/posts.routes.ts";
import { reportsRoutes } from "./routes/reports.routes.ts";
import { usersRoutes } from "./routes/users.routes.ts";

export const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["authorization", "content-type", "x-request-id"],
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

app.route("/api/posts", postsRoutes);
app.route("/api/comments", commentsRoutes);
app.route("/api/gifs", gifsRoutes);
app.route("/api/media", mediaRoutes);
app.route("/api/moderation", moderationRoutes);
app.route("/api/reports", reportsRoutes);
app.route("/api/users", usersRoutes);
