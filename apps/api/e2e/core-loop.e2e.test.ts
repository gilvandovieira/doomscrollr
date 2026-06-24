// The v1 core loop, end to end over real HTTP against a seeded Postgres:
//   create a post -> it appears in the recent feed -> a friend reads it ->
//   comments (incl. one-level replies) -> reacts.
// Each assertion is a real request through the full middleware + repository stack.

import type { Comment, FeedPost, PostDetail } from "@doomscrollr/shared/types.ts";
import { api, assert, assertEquals, assertStatus, e2eTest, POSTS, USERS } from "./harness.ts";

type FeedResponse = { items: FeedPost[]; nextCursor: string | null };
type CreatePostResponse = { post: PostDetail; canonicalUrl: string };
type ReactionResult = { value: 1 | -1 | null; score: number; reactionCount: number };

e2eTest("health endpoint reports ok", async () => {
  const res = await api<{ status: string; service: string }>("/health");
  assertStatus(res, 200);
  assertEquals(res.json.status, "ok");
  assertEquals(res.json.service, "doomscrollr-api");
});

e2eTest("recent feed serves seeded posts to anonymous readers", async () => {
  const res = await api<FeedResponse>("/api/feed/recent");
  assertStatus(res, 200);
  assert(Array.isArray(res.json.items), "feed items should be an array");

  const friday = res.json.items.find((post) => post.publicCode === POSTS.fridayText.code);
  assert(friday !== undefined, "seeded Friday post should be in the recent feed");
  // Public shape contract: addressed by code + slug, author by username, no internal ids.
  assertEquals(friday.author.username, "lucas", "Friday post author");
  assertEquals(friday.canonicalPath, `/p/${POSTS.fridayText.code}/${POSTS.fridayText.slug}`);
  assert(!("authorId" in friday), "public post must not leak internal authorId");
});

e2eTest("create -> appears in feed -> read -> comment -> reply -> react", async () => {
  // 1. maya creates a text post.
  const created = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.maya.clerkId,
    body: {
      postKind: "text",
      title: "E2E: my keyboard has feelings",
      bodyText: "It double-types every vowel after 3pm. AMA.",
      tags: ["programming"],
    },
  });
  assertStatus(created, 201);
  const code = created.json.post.publicCode;
  assertEquals(created.json.post.author.username, "maya", "new post author");
  assert(
    created.json.canonicalUrl.includes(`/p/${code}/`),
    `canonical url should target the new post, got ${created.json.canonicalUrl}`,
  );

  // 2. It shows up at the top of the recent feed.
  const feed = await api<FeedResponse>("/api/feed/recent");
  assertStatus(feed, 200);
  assert(
    feed.json.items.some((post) => post.publicCode === code),
    "freshly created post should appear in the recent feed",
  );

  // 3. A friend reads the canonical post.
  const detail = await api<PostDetail>(`/api/posts/${code}`);
  assertStatus(detail, 200);
  assertEquals(detail.json.title, "E2E: my keyboard has feelings");

  // 4. ren comments on it.
  const comment = await api<Comment>(`/api/posts/${code}/comments`, {
    asUser: USERS.ren.clerkId,
    body: { bodyText: "Mine only does it on Fridays." },
  });
  assertStatus(comment, 201);
  const commentCode = comment.json.publicCode;
  assertEquals(comment.json.author.username, "ren");
  assertEquals(comment.json.parentCommentCode, null, "top-level comment has no parent");

  // 5. ana replies to ren (one level deep).
  const reply = await api<Comment>(`/api/posts/${code}/comments`, {
    asUser: USERS.ana.clerkId,
    body: { bodyText: "Friday keyboards are a known hazard.", parentCommentCode: commentCode },
  });
  assertStatus(reply, 201);
  assertEquals(reply.json.parentCommentCode, commentCode, "reply should reference its parent");

  // 6. The comment thread now nests the reply under the top-level comment.
  const thread = await api<{ items: Comment[] }>(`/api/posts/${code}/comments`);
  assertStatus(thread, 200);
  const top = thread.json.items.find((item) => item.publicCode === commentCode);
  assert(top !== undefined, "thread should include the top-level comment");
  assertEquals(top.replies.length, 1, "top-level comment should have one reply");
  assertEquals(top.replies[0].author.username, "ana");

  // 7. ana reacts +1 on the post, then clears it.
  const up = await api<ReactionResult>(`/api/posts/${code}/reactions`, {
    asUser: USERS.ana.clerkId,
    body: { value: 1 },
  });
  assertStatus(up, 200);
  assertEquals(up.json.value, 1, "reaction value after upvote");
  assertEquals(up.json.score, 1, "score after a single upvote on a new post");
  assertEquals(up.json.reactionCount, 1, "reaction count after upvote");

  const cleared = await api<ReactionResult>(`/api/posts/${code}/reactions`, {
    asUser: USERS.ana.clerkId,
    body: { value: 0 },
  });
  assertStatus(cleared, 200);
  assertEquals(cleared.json.value, null, "reaction cleared");
  assertEquals(cleared.json.score, 0, "score back to zero after clearing");
});

e2eTest("youtube posts are accepted and expose the parsed video id", async () => {
  const created = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.ren.clerkId,
    body: {
      postKind: "youtube",
      title: "E2E: this short explains my week",
      youtubeUrl: "https://www.youtube.com/shorts/jNQXAC9IVRw",
    },
  });
  assertStatus(created, 201);
  assertEquals(created.json.post.postKind, "youtube");
  assertEquals(created.json.post.youtubeVideoId, "jNQXAC9IVRw");
  assertEquals(created.json.post.youtubeIsShort, true);
});

e2eTest("replies cannot be nested deeper than one level", async () => {
  // The seeded reply (lucas) is already one level deep; replying to it must 400.
  const res = await api(`/api/posts/${POSTS.fridayText.code}/comments`, {
    asUser: USERS.ana.clerkId,
    body: { bodyText: "Trying to nest a third level.", parentCommentCode: "c7Rn3Tb8Wx" },
  });
  assertStatus(res, 400);
});
