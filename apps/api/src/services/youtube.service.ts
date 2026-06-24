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
