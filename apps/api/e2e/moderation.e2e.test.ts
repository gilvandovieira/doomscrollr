// Moderation + safety surfaces: user blocking pushed into feed SQL, admin
// remove/restore (including share-safety of removed posts), the report queue, and
// the authorization boundary around /api/admin.

import type { Comment, FeedPost, Report } from "@doomscrollr/shared/types.ts";
import type { ApiResponse } from "./harness.ts";
import {
  api,
  assert,
  assertEquals,
  assertIncludes,
  assertStatus,
  e2eTest,
  POSTS,
  USERS,
} from "./harness.ts";

type FeedResponse = { items: FeedPost[]; nextCursor: string | null };

function hasPost(feed: ApiResponse<FeedResponse>, code: string): boolean {
  return feed.json.items.some((post) => post.publicCode === code);
}

e2eTest("blocking hides the blocked author's posts from the blocker's feed only", async () => {
  // Anonymous feed sees ren's image post.
  const anon = await api<FeedResponse>("/api/feed/recent");
  assert(hasPost(anon, POSTS.cacheImage.code), "anonymous feed should include ren's post");

  // maya blocks ren.
  const block = await api(`/api/users/${USERS.ren.username}/block`, {
    method: "POST",
    asUser: USERS.maya.clerkId,
  });
  assertStatus(block, 204);

  // maya's authenticated feed now excludes ren's post...
  const mayaFeed = await api<FeedResponse>("/api/feed/recent", { asUser: USERS.maya.clerkId });
  assert(
    !hasPost(mayaFeed, POSTS.cacheImage.code),
    "blocked author's post should be hidden from maya",
  );

  // ...while the anonymous feed is unaffected.
  const anonAgain = await api<FeedResponse>("/api/feed/recent");
  assert(hasPost(anonAgain, POSTS.cacheImage.code), "block must not affect anonymous readers");

  // Unblock restores visibility.
  const unblock = await api(`/api/users/${USERS.ren.username}/block`, {
    method: "DELETE",
    asUser: USERS.maya.clerkId,
  });
  assertStatus(unblock, 204);
  const restored = await api<FeedResponse>("/api/feed/recent", { asUser: USERS.maya.clerkId });
  assert(hasPost(restored, POSTS.cacheImage.code), "unblock should restore visibility");
});

e2eTest("a user cannot block themselves", async () => {
  const res = await api(`/api/users/${USERS.maya.username}/block`, {
    method: "POST",
    asUser: USERS.maya.clerkId,
  });
  assertStatus(res, 400);
});

e2eTest("blocking hides the blocked author's comments from the blocker's thread", async () => {
  const anonymousThread = await api<{ items: Comment[] }>(`/api/posts/${POSTS.fridayText.code}/comments`);
  assertStatus(anonymousThread, 200);
  assert(
    anonymousThread.json.items.some((comment) => comment.author.username === USERS.maya.username),
    "anonymous thread should include maya's seeded comment",
  );

  const block = await api(`/api/users/${USERS.maya.username}/block`, {
    method: "POST",
    asUser: USERS.ren.clerkId,
  });
  assertStatus(block, 204);

  const renThread = await api<{ items: Comment[] }>(`/api/posts/${POSTS.fridayText.code}/comments`, {
    asUser: USERS.ren.clerkId,
  });
  assertStatus(renThread, 200);
  assert(
    renThread.json.items.every((comment) =>
      comment.author.username !== USERS.maya.username &&
      comment.replies.every((reply) => reply.author.username !== USERS.maya.username)
    ),
    "blocked author's comments and replies should be hidden from ren",
  );

  const unblock = await api(`/api/users/${USERS.maya.username}/block`, {
    method: "DELETE",
    asUser: USERS.ren.clerkId,
  });
  assertStatus(unblock, 204);
});

e2eTest("admin can remove and restore a post; removed posts stay share-safe", async () => {
  const code = POSTS.forumsText.code;

  const removed = await api<{ ok: boolean }>(`/api/admin/posts/${code}/remove`, {
    asUser: USERS.admin.clerkId,
    body: { reason: "E2E moderation check" },
  });
  assertStatus(removed, 200);
  assertEquals(removed.json.ok, true);

  // The API read no longer serves it.
  const apiRead = await api(`/api/posts/${code}`);
  assertStatus(apiRead, 404);

  // The canonical share page must NOT leak the original title/image (spec §11.4):
  // it returns 200 with the generic "unavailable" shell.
  const sharePage = await api(`/p/${code}`);
  assertStatus(sharePage, 200);
  assertIncludes(sharePage.text, "This post is unavailable.", "removed post share page");
  assert(
    !sharePage.text.includes("Why old forums felt better than Discord"),
    "removed post must not expose its original title",
  );

  // Restore brings it back.
  const restored = await api<{ ok: boolean }>(`/api/admin/posts/${code}/restore`, {
    method: "POST",
    asUser: USERS.admin.clerkId,
  });
  assertStatus(restored, 200);
  const readAgain = await api(`/api/posts/${code}`);
  assertStatus(readAgain, 200);
});

e2eTest("removing a post that does not exist returns 404", async () => {
  const res = await api(`/api/admin/posts/zzzzzzzzzz/remove`, {
    asUser: USERS.admin.clerkId,
    body: {},
  });
  assertStatus(res, 404);
});

e2eTest("non-admins cannot reach the admin surface", async () => {
  const res = await api("/api/admin/reports", { asUser: USERS.maya.clerkId });
  assertStatus(res, 403);
});

e2eTest("a report enters the admin queue and can be dismissed", async () => {
  // Snapshot the queue first so we can isolate exactly the report we file, even
  // though other tests also file reports against the shared database.
  const before = await api<{ items: Report[] }>("/api/admin/reports", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(before, 200);
  const beforeIds = new Set(before.json.items.map((report) => report.id));

  const filed = await api<{ ok: boolean }>("/api/reports", {
    asUser: USERS.maya.clerkId,
    body: {
      targetType: "user",
      targetCode: USERS.ana.username,
      reason: "harassment",
      details: "e2e",
    },
  });
  assertStatus(filed, 201);

  const after = await api<{ items: Report[] }>("/api/admin/reports", {
    asUser: USERS.admin.clerkId,
  });
  const mine = after.json.items.find((report) => !beforeIds.has(report.id));
  assert(mine !== undefined, "the new report should appear in the open queue");
  assertEquals(mine.targetType, "user");
  assertEquals(mine.targetCode, USERS.ana.username);

  const dismissed = await api<{ ok: boolean }>(`/api/admin/reports/${mine.id}/dismiss`, {
    asUser: USERS.admin.clerkId,
    body: {},
  });
  assertStatus(dismissed, 200);

  const final = await api<{ items: Report[] }>("/api/admin/reports", {
    asUser: USERS.admin.clerkId,
  });
  assert(
    !final.json.items.some((report) => report.id === mine.id),
    "dismissed report should leave the open queue",
  );
});
