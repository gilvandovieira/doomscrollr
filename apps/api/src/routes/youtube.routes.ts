import { Hono } from "hono";
import { badRequest } from "../lib/errors.ts";
import { ensureAnonSession } from "../lib/anon-session.ts";
import { enforceRateLimit, publicRateLimitKey, RATE_LIMITS } from "../lib/rate-limit.ts";
import {
  extractYouTubeId,
  fetchYouTubeTitle,
  isYouTubeShort,
} from "../services/youtube.service.ts";

export const youtubeRoutes = new Hono();

// GET /api/youtube/oembed?url=... — resolve a YouTube URL to its video id and
// title via the public oEmbed endpoint (no API key). Used to prefill the create
// form so a user can post a video with just a link. Title may be null if the
// lookup fails; the client then keeps a manual title.
youtubeRoutes.get("/oembed", async (c) => {
  const url = c.req.query("url")?.trim() ?? "";
  const videoId = extractYouTubeId(url);
  if (!videoId) throw badRequest("That YouTube URL is not supported.");

  // Light per-session budget: this hits an external service.
  const sessionId = ensureAnonSession(c);
  await enforceRateLimit(
    await publicRateLimitKey(c, "yt-oembed", sessionId),
    RATE_LIMITS.youtubeLookup,
  );

  const title = await fetchYouTubeTitle(url);
  return c.json({ videoId, isShort: isYouTubeShort(url), title });
});
