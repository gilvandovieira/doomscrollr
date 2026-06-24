// The v1 core loop, end to end over real HTTP against a seeded Postgres:
//   create a post -> it appears in the recent feed -> a friend reads it ->
//   comments (incl. one-level replies) -> reacts.
// Each assertion is a real request through the full middleware + repository stack.

import type { Comment, FeedPost, Notification, PostDetail } from "@doomscrollr/shared/types.ts";
import { api, assert, assertEquals, assertStatus, e2eTest, POSTS, USERS } from "./harness.ts";

type FeedResponse = { items: FeedPost[]; nextCursor: string | null };
type CreatePostResponse = { post: PostDetail; canonicalUrl: string };
type ReactionResult = { value: 1 | -1 | null; score: number; reactionCount: number };
type Tag = { slug: string; displayName: string; description: string | null; postCount: number };

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

e2eTest("recent feed can be filtered by post kind", async () => {
  const youtube = await api<FeedResponse>("/api/feed/recent?kind=youtube");
  assertStatus(youtube, 200);
  assert(youtube.json.items.length > 0, "youtube filtered feed should have seeded posts");
  assert(
    youtube.json.items.every((post) => post.postKind === "youtube"),
    "youtube filtered feed should only include youtube posts",
  );

  const images = await api<FeedResponse>("/api/feed/recent?kind=external_image");
  assertStatus(images, 200);
  assert(images.json.items.length > 0, "image filtered feed should have seeded posts");
  assert(
    images.json.items.every((post) => post.postKind === "external_image"),
    "image filtered feed should only include image-link posts",
  );
});

e2eTest("tag directory and tag feeds serve curated discovery pages", async () => {
  const tags = await api<{ items: Tag[] }>("/api/tags");
  assertStatus(tags, 200);
  const programming = tags.json.items.find((tag) => tag.slug === "programming");
  assert(programming !== undefined, "programming tag should be listed");
  assertEquals(programming.displayName, "Programming", "tag display name");
  assertEquals(programming.postCount, 2, "programming seeded post count");

  const detail = await api<{ tag: Tag; requestedSlug: string; canonicalSlug: string }>(
    "/api/tags/dev",
  );
  assertStatus(detail, 200);
  assertEquals(detail.json.requestedSlug, "dev", "alias requested slug");
  assertEquals(detail.json.canonicalSlug, "programming", "alias canonical slug");

  const feed = await api<FeedResponse>("/api/tags/programming/posts");
  assertStatus(feed, 200);
  assert(feed.json.items.length > 0, "programming feed should have posts");
  assert(
    feed.json.items.every((post) => post.tags.includes("programming")),
    "programming feed should only include posts tagged programming",
  );
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
  assertEquals(created.json.post.score, 1, "new post opens at one point (author self-upvote)");
  assertEquals(created.json.post.reactionCount, 1, "author self-upvote counts as one reaction");
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
    body: { bodyText: "Mine only does it on Fridays. @lucas has seen this too." },
  });
  assertStatus(comment, 201);
  const commentCode = comment.json.publicCode;
  assertEquals(comment.json.author.username, "ren");
  assertEquals(comment.json.parentCommentCode, null, "top-level comment has no parent");

  const mayaNotifications = await api<{ items: Notification[]; unreadCount: number }>(
    "/api/notifications",
    { asUser: USERS.maya.clerkId },
  );
  assertStatus(mayaNotifications, 200);
  const postReplyNotice = mayaNotifications.json.items.find((notification) =>
    notification.type === "post_reply" &&
    notification.postCode === code &&
    notification.commentCode === commentCode &&
    notification.actor?.username === USERS.ren.username
  );
  assert(postReplyNotice !== undefined, "post owner should receive a post reply notification");
  assert(postReplyNotice.readAt === null, "new post reply notification should be unread");

  const readPostReply = await api(`/api/notifications/${postReplyNotice.id}/read`, {
    method: "POST",
    asUser: USERS.maya.clerkId,
  });
  assertStatus(readPostReply, 200);
  const mayaNotificationsAfterRead = await api<{ items: Notification[]; unreadCount: number }>(
    "/api/notifications",
    { asUser: USERS.maya.clerkId },
  );
  const readNotice = mayaNotificationsAfterRead.json.items.find((notification) =>
    notification.id === postReplyNotice.id
  );
  assert(readNotice?.readAt !== null, "marking a notification read should persist readAt");

  const lucasNotifications = await api<{ items: Notification[]; unreadCount: number }>(
    "/api/notifications",
    { asUser: USERS.admin.clerkId },
  );
  assertStatus(lucasNotifications, 200);
  assert(
    lucasNotifications.json.items.some((notification) =>
      notification.type === "mention" &&
      notification.postCode === code &&
      notification.commentCode === commentCode &&
      notification.actor?.username === USERS.ren.username
    ),
    "mentioned users should receive a mention notification",
  );

  // 5. ana replies to ren (one level deep).
  const reply = await api<Comment>(`/api/posts/${code}/comments`, {
    asUser: USERS.ana.clerkId,
    body: { bodyText: "Friday keyboards are a known hazard.", parentCommentCode: commentCode },
  });
  assertStatus(reply, 201);
  assertEquals(reply.json.parentCommentCode, commentCode, "reply should reference its parent");

  const renNotifications = await api<{ items: Notification[]; unreadCount: number }>(
    "/api/notifications",
    { asUser: USERS.ren.clerkId },
  );
  assertStatus(renNotifications, 200);
  assert(
    renNotifications.json.items.some((notification) =>
      notification.type === "comment_reply" &&
      notification.postCode === code &&
      notification.commentCode === reply.json.publicCode &&
      notification.actor?.username === USERS.ana.username
    ),
    "parent comment author should receive a comment reply notification",
  );

  // 6. The comment thread now nests the reply under the top-level comment.
  const thread = await api<{ items: Comment[] }>(`/api/posts/${code}/comments`);
  assertStatus(thread, 200);
  const top = thread.json.items.find((item) => item.publicCode === commentCode);
  assert(top !== undefined, "thread should include the top-level comment");
  assertEquals(top.replies.length, 1, "top-level comment should have one reply");
  assertEquals(top.replies[0].author.username, "ana");

  // 7. The post already carries the author's self-upvote, so ana's upvote takes it
  // to two; clearing hers leaves the author's one behind.
  const up = await api<ReactionResult>(`/api/posts/${code}/reactions`, {
    asUser: USERS.ana.clerkId,
    body: { value: 1 },
  });
  assertStatus(up, 200);
  assertEquals(up.json.value, 1, "reaction value after upvote");
  assertEquals(up.json.score, 2, "author self-upvote plus ana's upvote");
  assertEquals(up.json.reactionCount, 2, "reaction count after ana's upvote");

  const cleared = await api<ReactionResult>(`/api/posts/${code}/reactions`, {
    asUser: USERS.ana.clerkId,
    body: { value: 0 },
  });
  assertStatus(cleared, 200);
  assertEquals(cleared.json.value, null, "ana's reaction cleared");
  assertEquals(cleared.json.score, 1, "author self-upvote remains after ana clears");
  assertEquals(cleared.json.reactionCount, 1, "author self-upvote remains in the count");
});

e2eTest("tag aliases canonicalize on post creation", async () => {
  const created = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.maya.clerkId,
    body: {
      postKind: "text",
      title: "E2E: alias tags should merge",
      bodyText: "The dev alias should land on programming.",
      tags: ["dev"],
    },
  });
  assertStatus(created, 201);
  assertEquals(created.json.post.tags.length, 1, "canonicalized tag count");
  assertEquals(created.json.post.tags[0], "programming", "alias should store canonical tag");
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

e2eTest("a youtube post with no title still posts with a derived title", async () => {
  const created = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.ren.clerkId,
    body: { postKind: "youtube", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  });
  assertStatus(created, 201);
  assertEquals(created.json.post.postKind, "youtube");
  // Title comes from oEmbed when reachable, else a safe fallback — always valid.
  assert(
    created.json.post.title.trim().length >= 3,
    `expected a derived title, got ${JSON.stringify(created.json.post.title)}`,
  );
});

e2eTest("replies cannot be nested deeper than one level", async () => {
  // The seeded reply (lucas) is already one level deep; replying to it must 400.
  const res = await api(`/api/posts/${POSTS.fridayText.code}/comments`, {
    asUser: USERS.ana.clerkId,
    body: { bodyText: "Trying to nest a third level.", parentCommentCode: "c7Rn3Tb8Wx" },
  });
  assertStatus(res, 400);
});

e2eTest("a text post with no title takes its title from the body's first sentence", async () => {
  const created = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.maya.clerkId,
    body: {
      postKind: "text",
      bodyText: "Friday deploys are a trap. Change my mind in the comments below.",
      tags: [],
    },
  });
  assertStatus(created, 201);
  assertEquals(
    created.json.post.title,
    "Friday deploys are a trap.",
    "title derived from the body's first sentence",
  );
  assertEquals(
    created.json.post.bodyText,
    "Friday deploys are a trap. Change my mind in the comments below.",
    "body text is preserved",
  );

  // An explicit title still wins over the body.
  const titled = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.maya.clerkId,
    body: {
      postKind: "text",
      title: "My own title",
      bodyText: "A different first line.",
      tags: [],
    },
  });
  assertStatus(titled, 201);
  assertEquals(titled.json.post.title, "My own title", "an explicit title is kept as-is");
});
