import { extractYouTubeId, isYouTubeShort } from "./youtube.service.ts";

Deno.test("extractYouTubeId supports watch, share, and shorts URLs", () => {
  const cases = [
    ["https://www.youtube.com/watch?v=abc123&feature=share", "abc123"],
    ["https://youtu.be/xyz789", "xyz789"],
    ["https://www.youtube.com/shorts/short_001", "short_001"],
  ] as const;

  for (const [url, expected] of cases) {
    const actual = extractYouTubeId(url);

    if (actual !== expected) {
      throw new Error(`Expected ${expected} from ${url}, received ${actual}.`);
    }
  }
});

Deno.test("isYouTubeShort detects shorts URLs", () => {
  if (!isYouTubeShort("https://www.youtube.com/shorts/short_001")) {
    throw new Error("Expected shorts URL to be detected.");
  }

  if (isYouTubeShort("https://www.youtube.com/watch?v=abc123")) {
    throw new Error("Expected watch URL not to be detected as a short.");
  }
});
