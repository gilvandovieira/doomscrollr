// v1 contract tests (ROADMAP V1-004): the public boundary must not leak fields or
// providers that were removed from v1 (content ratings, ad eligibility, media
// providers, internal ids, suggestive/mature surfaces).

import { FeedPostSchema, PostKindSchema } from "./post.schema.ts";
import { NotificationSchema } from "./notification.schema.ts";
import { TagListResponseSchema } from "./tag.schema.ts";
import { AuthorSchema } from "./user.schema.ts";
import { getMockFeed, getMockPostByCode, getMockTags } from "../mock-data.ts";

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

Deno.test("post kinds include v2 reshare kinds without adding media providers", () => {
  assert(
    JSON.stringify(PostKindSchema.options) ===
      JSON.stringify(["text", "external_image", "youtube", "repost", "quote"]),
    "post_kind drifted from the supported set.",
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

Deno.test("public tag directory exposes curated tag metadata only", () => {
  const result = TagListResponseSchema.parse({ items: getMockTags() });
  for (const tag of result.items) {
    assert(!("id" in tag), "Public tag must not leak internal id.");
    assert(tag.postCount >= 0, "Public tag should expose nonnegative post counts.");
  }
});

Deno.test("public notifications address targets by public codes only", () => {
  const result = NotificationSchema.safeParse({
    id: "notice-public-id",
    type: "mention",
    actor: {
      username: "maya",
      displayName: "Maya",
      avatarUrl: "https://example.com/a.png",
    },
    postCode: "7kF3mQx9Za",
    postTitle: "When prod breaks on Friday",
    postPath: "/p/7kF3mQx9Za/when-prod-breaks-on-friday",
    commentCode: "c4Kd9Lm2Pq",
    bodyPreview: "@lucas this is relevant",
    metadata: null,
    readAt: null,
    createdAt: "2026-06-24T12:00:00.000Z",
    recipientUserId: "internal-uuid",
  });
  assert(!result.success, "NotificationSchema must reject internal recipient ids.");
});
