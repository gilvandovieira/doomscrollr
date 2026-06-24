// v1 contract tests (ROADMAP V1-004): the public boundary must not leak fields or
// providers that were removed from v1 (content ratings, ad eligibility, media
// providers, internal ids, suggestive/mature surfaces).

import {
  CreatePostSchema,
  CreateQuotePostSchema,
  FeedPostSchema,
  PostKindSchema,
} from "./post.schema.ts";
import { NotificationSchema } from "./notification.schema.ts";
import { TagListResponseSchema } from "./tag.schema.ts";
import { AuthorSchema, UserProfileSchema } from "./user.schema.ts";
import { getMockFeed, getMockPostByCode, getMockTags } from "../mock-data.ts";

const EXCLUDED_KEYS = [
  "id",
  "adultVerified",
  "ageGate",
  "ageVerified",
  "ageVerification",
  "contentRating",
  "content_rating",
  "contentControls",
  "dateOfBirth",
  "dob",
  "adultContent",
  "explicitContent",
  "isAdult",
  "isSuggestive",
  "mature",
  "matureContent",
  "pornography",
  "nsfw",
  "suggestive",
  "suggestiveContent",
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

Deno.test("create post schemas reject suggestive and mature content fields", () => {
  const textPost = {
    postKind: "text",
    bodyText: "Plain SFW post.",
    tags: [],
    suggestive: true,
  };
  const imagePost = {
    postKind: "external_image",
    title: "Plain linked image",
    imageUrl: "https://example.com/image.png",
    tags: [],
    contentRating: "suggestive",
  };
  const quotePost = {
    bodyText: "Quoting with a removed mature-content flag should fail.",
    nsfw: false,
  };

  assert(!CreatePostSchema.safeParse(textPost).success, "Text posts must reject suggestive flags.");
  assert(!CreatePostSchema.safeParse(imagePost).success, "Image posts must reject rating fields.");
  assert(
    !CreateQuotePostSchema.safeParse(quotePost).success,
    "Quote posts must reject mature/suggestive fields.",
  );
});

Deno.test("mature and adult UGC remain outside post kind contracts", () => {
  const excludedKinds = ["mature", "adult", "nsfw", "explicit", "pornography"];

  for (const postKind of excludedKinds) {
    assert(
      !PostKindSchema.options.includes(postKind as never),
      `PostKindSchema must not expose mature/adult kind: ${postKind}`,
    );
    assert(
      !CreatePostSchema.safeParse({
        postKind,
        title: "Excluded mature/adult post",
        bodyText: "This requires a separate roadmap, legal, and compliance decision.",
        tags: [],
      }).success,
      `CreatePostSchema must reject mature/adult kind: ${postKind}`,
    );
  }
});

Deno.test("age verification fields remain outside public and create contracts", () => {
  const profile = {
    username: "lucas",
    displayName: "Lucas",
    avatarUrl: "https://example.com/a.png",
    role: "user",
    status: "active",
    postCount: 0,
    commentCount: 0,
    createdAt: "2026-06-24T12:00:00.000Z",
    ageVerified: true,
  };
  const post = {
    postKind: "text",
    bodyText: "Plain SFW post with no age gate.",
    tags: [],
    dateOfBirth: "2000-01-01",
  };
  const quote = {
    bodyText: "Plain SFW quote with no age verification.",
    ageGate: "18+",
  };

  assert(!UserProfileSchema.safeParse(profile).success, "Profiles must reject age verification.");
  assert(!CreatePostSchema.safeParse(post).success, "Posts must reject age verification fields.");
  assert(!CreateQuotePostSchema.safeParse(quote).success, "Quotes must reject age gate fields.");
});

Deno.test("post kinds include v2 reshare kinds without adding media providers", () => {
  assert(
    JSON.stringify(PostKindSchema.options) ===
      JSON.stringify(["text", "external_image", "youtube", "repost", "quote"]),
    "post_kind drifted from the supported set.",
  );
});

Deno.test("create post schema rejects deferred media provider kinds", () => {
  const deferredKinds = [
    "provider_gif",
    "uploaded_image",
    "uploaded_gif",
    "giphy",
    "tenor",
    "link",
  ];

  for (const postKind of deferredKinds) {
    const result = CreatePostSchema.safeParse({
      postKind,
      title: "Deferred provider",
      bodyText: "This should not be accepted without an earned provider decision.",
      imageUrl: "https://example.com/media.gif",
      youtubeUrl: "https://youtu.be/jNQXAC9IVRw",
      tags: [],
    });
    assert(!result.success, `CreatePostSchema must reject deferred kind: ${postKind}`);
  }
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
