import { extractYouTubeId, isYouTubeShort } from "./youtube.service.ts";

Deno.test("extractYouTubeId supports watch, share, and shorts URLs", () => {
  const cases = [
    ["https://www.youtube.com/watch?v=jNQXAC9IVRw&feature=share", "jNQXAC9IVRw"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/aqz-KE-bpKQ", "aqz-KE-bpKQ"],
  ] as const;

  for (const [url, expected] of cases) {
    const actual = extractYouTubeId(url);

    if (actual !== expected) {
      throw new Error(`Expected ${expected} from ${url}, received ${actual}.`);
    }
  }
});

Deno.test("isYouTubeShort detects shorts URLs", () => {
  if (!isYouTubeShort("https://www.youtube.com/shorts/aqz-KE-bpKQ")) {
    throw new Error("Expected shorts URL to be detected.");
  }

  if (isYouTubeShort("https://www.youtube.com/watch?v=jNQXAC9IVRw")) {
    throw new Error("Expected watch URL not to be detected as a short.");
  }
});
