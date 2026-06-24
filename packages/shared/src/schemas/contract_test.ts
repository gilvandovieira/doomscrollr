// v1 contract tests (ROADMAP V1-004): the public boundary must not leak fields or
// providers that were removed from v1 (content ratings, ad eligibility, media
// providers, internal ids, suggestive/mature surfaces).

import { FeedPostSchema, PostKindSchema } from "./post.schema.ts";
import { AuthorSchema } from "./user.schema.ts";
import { getMockFeed, getMockPostByCode } from "../mock-data.ts";

const EXCLUDED_KEYS = [
  "id",
  "contentRating",
  "content_rating",
  "adEligibility",
  "media",
  "mediaAssetId",
  "upvoteCount",
  "downvoteCount",
  "monetizationStatus",
  "unsafeCommentCount",
  "pendingReviewCommentCount",
  "publishedAt",
];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("public post payloads expose no v1-excluded fields", () => {
  const { items } = getMockFeed({ limit: 50 });
  assert(items.length > 0, "Expected mock feed to return posts.");

  for (const post of items) {
    const keys = Object.keys(post);
    for (const excluded of EXCLUDED_KEYS) {
      assert(!keys.includes(excluded), `Public post leaked excluded field: ${excluded}`);
    }
  }
});

Deno.test("FeedPostSchema rejects payloads carrying excluded fields", () => {
  const base = getMockPostByCode("7kF3mQx9Za");
  assert(base !== null, "Expected a known mock post.");

  // Strict schema must reject a payload that smuggles a removed field through.
  const tainted = { ...base, contentRating: "mature" } as unknown;
  const result = FeedPostSchema.safeParse(tainted);
  assert(!result.success, "FeedPostSchema must reject excluded fields (strict).");
});

Deno.test("post kinds are limited to the three v1 kinds", () => {
  assert(
    JSON.stringify(PostKindSchema.options) ===
      JSON.stringify(["text", "external_image", "youtube"]),
    "post_kind drifted from the v1 set.",
  );
});

Deno.test("public author carries username, not an internal id", () => {
  const result = AuthorSchema.safeParse({
    username: "lucas",
    displayName: "Lucas",
    avatarUrl: "https://example.com/a.png",
    id: "internal-uuid",
  });
  assert(!result.success, "AuthorSchema must reject internal id on the public boundary.");
});
