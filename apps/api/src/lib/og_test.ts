import {
  BELL_CANONICAL_URL_LENGTH_THRESHOLD,
  buildCanonicalPostUrl,
  canonicalUrlsNeedBell,
  maxCanonicalPostUrlLength,
} from "./og.ts";
import type { FeedPost } from "@doomscrollr/shared/types.ts";

Deno.test("canonical post URLs remain short enough to defer BELL", () => {
  const expectedLength = "https://doomscrollr.com".length + "/p/".length + 10 + 1 + 80;

  if (maxCanonicalPostUrlLength("https://doomscrollr.com") !== expectedLength) {
    throw new Error("Canonical URL budget drifted from origin + /p/ + code + slug.");
  }

  if (canonicalUrlsNeedBell("https://doomscrollr.com")) {
    throw new Error("Canonical URLs should not require BELL short links yet.");
  }

  if (expectedLength >= BELL_CANONICAL_URL_LENGTH_THRESHOLD) {
    throw new Error("Canonical URL budget should leave room under the BELL threshold.");
  }
});

Deno.test("canonical URL builder strips a trailing origin slash", () => {
  const post = {
    publicCode: "7kF3mQx9Za",
    slug: "when-prod-breaks-on-friday",
  };
  const url = buildCanonicalPostUrl("https://doomscrollr.com/", post as FeedPost);

  if (url !== "https://doomscrollr.com/p/7kF3mQx9Za/when-prod-breaks-on-friday") {
    throw new Error(`Unexpected canonical URL: ${url}`);
  }
});
