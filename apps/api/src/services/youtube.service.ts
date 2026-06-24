const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);
const YOUTU_BE_HOSTS = new Set(["youtu.be", "www.youtu.be"]);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeId(rawUrl: string) {
  const parsed = parseYouTubeUrl(rawUrl);
  return parsed?.videoId ?? null;
}

export function isYouTubeShort(rawUrl: string) {
  return parseYouTubeUrl(rawUrl)?.kind === "short";
}

function parseYouTubeUrl(rawUrl: string): { videoId: string; kind: "watch" | "short" } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const hostname = url.hostname.toLowerCase();

  if (YOUTU_BE_HOSTS.has(hostname)) {
    const videoId = firstPathSegment(url);
    return isValidVideoId(videoId) ? { videoId, kind: "watch" } : null;
  }

  if (!YOUTUBE_HOSTS.has(hostname)) return null;

  if (url.pathname === "/watch") {
    const videoId = url.searchParams.get("v") ?? "";
    return isValidVideoId(videoId) ? { videoId, kind: "watch" } : null;
  }

  const [prefix, videoId] = url.pathname.split("/").filter(Boolean);
  if (prefix === "shorts" && isValidVideoId(videoId)) return { videoId, kind: "short" };
  if (prefix === "embed" && isValidVideoId(videoId)) return { videoId, kind: "watch" };

  return null;
}

function firstPathSegment(url: URL): string {
  return url.pathname.split("/").filter(Boolean)[0] ?? "";
}

function isValidVideoId(value: string | undefined): value is string {
  return typeof value === "string" && VIDEO_ID_PATTERN.test(value);
}

// Best-effort fetch of a video's title via YouTube's public oEmbed endpoint.
// No API key required. Returns null on any failure so callers can fall back to a
// manual title. Normalizes to a watch URL so shorts/youtu.be links resolve too.
export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${
    encodeURIComponent(watchUrl)
  }&format=json`;

  try {
    const response = await fetch(oembedUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { title?: unknown };
    const title = typeof data.title === "string" ? data.title.trim() : "";
    return title.length > 0 ? title : null;
  } catch {
    return null;
  }
}
