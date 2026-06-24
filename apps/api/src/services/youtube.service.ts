const YOUTUBE_PATTERNS = [
  /youtube\.com\/watch\?v=([^&]+)/,
  /youtu\.be\/([^?]+)/,
  /youtube\.com\/shorts\/([^?]+)/,
];

export function extractYouTubeId(url: string) {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = pattern.exec(url);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function isYouTubeShort(url: string) {
  return /youtube\.com\/shorts\//.test(url);
}

// Best-effort fetch of a video's title via YouTube's public oEmbed endpoint.
// No API key required. Returns null on any failure so callers can fall back to a
// manual title. Normalizes to a watch URL so shorts/youtu.be links resolve too.
export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;

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
