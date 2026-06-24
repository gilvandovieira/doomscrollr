// Moderation + safety surfaces: user blocking pushed into feed SQL, admin
// remove/restore (including share-safety of removed posts), the report queue, and
// the authorization boundary around /api/admin.

import type {
  AdminDomainBlock,
  AdminTag,
  Comment,
  FeedPost,
  ModerationAuditEvent,
  Notification,
  Report,
  UserProfile,
} from "@doomscrollr/shared/types.ts";
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
type CreatePostResponse = { post: FeedPost; canonicalUrl: string };

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
  const anonymousThread = await api<{ items: Comment[] }>(
    `/api/posts/${POSTS.fridayText.code}/comments`,
  );
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

  const renThread = await api<{ items: Comment[] }>(
    `/api/posts/${POSTS.fridayText.code}/comments`,
    {
      asUser: USERS.ren.clerkId,
    },
  );
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

e2eTest("blocked users cannot notify the blocker with mentions", async () => {
  const block = await api(`/api/users/${USERS.ren.username}/block`, {
    method: "POST",
    asUser: USERS.maya.clerkId,
  });
  assertStatus(block, 204);

  const comment = await api<Comment>(`/api/posts/${POSTS.fridayText.code}/comments`, {
    asUser: USERS.ren.clerkId,
    body: { bodyText: "Mentioning @maya from a post owned by someone else." },
  });
  assertStatus(comment, 201);

  const notifications = await api<{ items: Notification[]; unreadCount: number }>(
    "/api/notifications",
    { asUser: USERS.maya.clerkId },
  );
  assertStatus(notifications, 200);
  assert(
    !notifications.json.items.some((notification) =>
      notification.type === "mention" &&
      notification.commentCode === comment.json.publicCode &&
      notification.actor?.username === USERS.ren.username
    ),
    "blocked actor should not create a mention notification for the blocker",
  );

  const unblock = await api(`/api/users/${USERS.ren.username}/block`, {
    method: "DELETE",
    asUser: USERS.maya.clerkId,
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

  const removedNotifications = await api<{ items: Notification[]; unreadCount: number }>(
    "/api/notifications",
    { asUser: USERS.maya.clerkId },
  );
  assertStatus(removedNotifications, 200);
  assert(
    removedNotifications.json.items.some((notification) =>
      notification.type === "moderation_outcome" &&
      notification.postCode === code &&
      notification.metadata?.action === "removed" &&
      notification.metadata?.targetType === "post"
    ),
    "post owner should receive a moderation removal notification",
  );

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
  const restoredNotifications = await api<{ items: Notification[]; unreadCount: number }>(
    "/api/notifications",
    { asUser: USERS.maya.clerkId },
  );
  assert(
    restoredNotifications.json.items.some((notification) =>
      notification.type === "moderation_outcome" &&
      notification.postCode === code &&
      notification.metadata?.action === "restored" &&
      notification.metadata?.targetType === "post"
    ),
    "post owner should receive a moderation restore notification",
  );
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

e2eTest("admin can create, disable, alias, and merge tags", async () => {
  const createdTag = await api<{ ok: boolean }>("/api/admin/tags", {
    asUser: USERS.admin.clerkId,
    body: {
      slug: "coding",
      displayName: "Coding",
      description: "Programming duplicates that should merge.",
    },
  });
  assertStatus(createdTag, 201);

  const tags = await api<{ items: AdminTag[] }>("/api/admin/tags", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(tags, 200);
  assert(tags.json.items.some((tag) => tag.slug === "coding"), "new tag should appear");

  const codingPost = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.maya.clerkId,
    body: {
      postKind: "text",
      title: "E2E: duplicate tag before merge",
      bodyText: "This should move to programming after merge.",
      tags: ["coding"],
    },
  });
  assertStatus(codingPost, 201);
  assertEquals(codingPost.json.post.tags[0], "coding", "new tag is attachable while active");

  const disabled = await api<{ ok: boolean }>("/api/admin/tags/coding/disable", {
    asUser: USERS.admin.clerkId,
    body: {},
  });
  assertStatus(disabled, 200);

  const rejected = await api("/api/posts", {
    asUser: USERS.ren.clerkId,
    body: {
      postKind: "text",
      title: "E2E: disabled tag rejected",
      bodyText: "Disabled curated tags cannot be attached.",
      tags: ["coding"],
    },
  });
  assertStatus(rejected, 400);

  const alias = await api<{ ok: boolean }>("/api/admin/tags/programming/aliases", {
    asUser: USERS.admin.clerkId,
    body: { aliasSlug: "software" },
  });
  assertStatus(alias, 201);

  const aliasPost = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.ren.clerkId,
    body: {
      postKind: "text",
      title: "E2E: alias tag canonicalizes",
      bodyText: "Software should land on programming.",
      tags: ["software"],
    },
  });
  assertStatus(aliasPost, 201);
  assertEquals(aliasPost.json.post.tags[0], "programming", "alias should resolve to target");

  const merged = await api<{ ok: boolean }>("/api/admin/tags/coding/merge", {
    asUser: USERS.admin.clerkId,
    body: { targetSlug: "programming" },
  });
  assertStatus(merged, 200);

  const canonical = await api<{ canonicalSlug: string }>("/api/tags/coding");
  assertStatus(canonical, 200);
  assertEquals(canonical.json.canonicalSlug, "programming", "merged tag should redirect by alias");

  const programmingFeed = await api<FeedResponse>("/api/tags/programming/posts");
  assertStatus(programmingFeed, 200);
  assert(
    programmingFeed.json.items.some((post) => post.publicCode === codingPost.json.post.publicCode),
    "merged posts should appear under the target tag feed",
  );
});

e2eTest("admin can block domains and post creation rejects matching media links", async () => {
  const block = await api<{ ok: boolean }>("/api/admin/moderation/domain-blocks", {
    asUser: USERS.admin.clerkId,
    body: { domain: "youtube.com", reason: "e2e unsafe source" },
  });
  assertStatus(block, 201);

  try {
    const list = await api<{ items: AdminDomainBlock[] }>("/api/admin/moderation/domain-blocks", {
      asUser: USERS.admin.clerkId,
    });
    assertStatus(list, 200);
    assert(
      list.json.items.some((item) =>
        item.domain === "youtube.com" && item.reason === "e2e unsafe source"
      ),
      "blocked domain should be visible in the admin policy list",
    );

    const duplicate = await api<{ ok: boolean }>("/api/admin/moderation/domain-blocks", {
      asUser: USERS.admin.clerkId,
      body: { domain: "https://youtube.com/watch?v=dQw4w9WgXcQ" },
    });
    assertStatus(duplicate, 409);

    const blocked = await api("/api/posts", {
      asUser: USERS.maya.clerkId,
      body: {
        postKind: "youtube",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        tags: [],
      },
    });
    assertStatus(blocked, 400);
    assertIncludes(blocked.text, "youtube.com");
  } finally {
    const deleted = await api("/api/admin/moderation/domain-blocks/youtube.com", {
      method: "DELETE",
      asUser: USERS.admin.clerkId,
    });
    if (deleted.status !== 204 && deleted.status !== 404) assertStatus(deleted, 204);
  }

  const after = await api<{ items: AdminDomainBlock[] }>("/api/admin/moderation/domain-blocks", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(after, 200);
  assert(
    after.json.items.every((item) => item.domain !== "youtube.com"),
    "deleted domain should leave the admin policy list",
  );
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

e2eTest("admin can change internal trust levels and admin trust controls access", async () => {
  const before = await api<{ items: Report[] }>("/api/admin/reports?status=all", {
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
      details: "trust level e2e",
    },
  });
  assertStatus(filed, 201);

  const reportList = await api<{ items: Report[] }>("/api/admin/reports?status=all", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(reportList, 200);
  const report = reportList.json.items.find((item) => !beforeIds.has(item.id));
  assert(report !== undefined, "new user report should be visible");
  assertEquals(report.targetUserTrustLevel, "normal");

  const trusted = await api<{ ok: boolean }>(
    `/api/admin/users/${USERS.ana.username}/trust-level`,
    {
      asUser: USERS.admin.clerkId,
      body: { trustLevel: "trusted", reason: "e2e trust" },
    },
  );
  assertStatus(trusted, 200);

  const refreshed = await api<{ items: Report[] }>("/api/admin/reports?status=all", {
    asUser: USERS.admin.clerkId,
  });
  const refreshedReport = refreshed.json.items.find((item) => item.id === report.id);
  assert(refreshedReport !== undefined, "report should still be present after trust change");
  assertEquals(refreshedReport.targetUserTrustLevel, "trusted");

  const audit = await api<{ items: ModerationAuditEvent[] }>("/api/admin/moderation/audit", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(audit, 200);
  assert(
    audit.json.items.some((event) =>
      event.action === "user_trust_level_changed" &&
      event.targetCode === USERS.ana.username &&
      event.metadata.previousTrustLevel === "normal" &&
      event.metadata.trustLevel === "trusted"
    ),
    "trust level changes should be audited",
  );

  const promoted = await api<{ ok: boolean }>(
    `/api/admin/users/${USERS.ana.username}/trust-level`,
    {
      asUser: USERS.admin.clerkId,
      body: { trustLevel: "admin", reason: "e2e promote" },
    },
  );
  assertStatus(promoted, 200);

  const promotedAccess = await api<{ items: Report[] }>("/api/admin/reports", {
    asUser: USERS.ana.clerkId,
  });
  assertStatus(promotedAccess, 200);

  const selfDemote = await api(`/api/admin/users/${USERS.ana.username}/trust-level`, {
    asUser: USERS.ana.clerkId,
    body: { trustLevel: "normal", reason: "e2e self demote" },
  });
  assertStatus(selfDemote, 400);

  const demoted = await api<{ ok: boolean }>(
    `/api/admin/users/${USERS.ana.username}/trust-level`,
    {
      asUser: USERS.admin.clerkId,
      body: { trustLevel: "normal", reason: "e2e restore" },
    },
  );
  assertStatus(demoted, 200);

  const demotedAccess = await api("/api/admin/reports", { asUser: USERS.ana.clerkId });
  assertStatus(demotedAccess, 403);
});

e2eTest("trusted reporters receive higher report queue priority", async () => {
  const before = await api<{ items: Report[] }>("/api/admin/reports?status=all", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(before, 200);
  const beforeIds = new Set(before.json.items.map((report) => report.id));

  const trusted = await api<{ ok: boolean }>(
    `/api/admin/users/${USERS.ana.username}/trust-level`,
    {
      asUser: USERS.admin.clerkId,
      body: { trustLevel: "trusted", reason: "e2e report priority" },
    },
  );
  assertStatus(trusted, 200);

  try {
    const trustedDetails = "trusted reporter priority e2e";
    const normalDetails = "normal reporter priority e2e";

    const trustedReport = await api<{ ok: boolean }>("/api/reports", {
      asUser: USERS.ana.clerkId,
      body: {
        targetType: "post",
        targetCode: POSTS.fridayText.code,
        reason: "spam",
        details: trustedDetails,
      },
    });
    assertStatus(trustedReport, 201);

    const normalReport = await api<{ ok: boolean }>("/api/reports", {
      asUser: USERS.maya.clerkId,
      body: {
        targetType: "post",
        targetCode: POSTS.cacheImage.code,
        reason: "spam",
        details: normalDetails,
      },
    });
    assertStatus(normalReport, 201);

    const queue = await api<{ items: Report[] }>("/api/admin/reports", {
      asUser: USERS.admin.clerkId,
    });
    assertStatus(queue, 200);

    const newReports = queue.json.items.filter((report) => !beforeIds.has(report.id));
    const trustedItem = newReports.find((report) => report.details === trustedDetails);
    const normalItem = newReports.find((report) => report.details === normalDetails);
    assert(trustedItem !== undefined, "trusted reporter's report should be visible");
    assert(normalItem !== undefined, "normal reporter's report should be visible");
    assertEquals(trustedItem.reporterTrustLevel, "trusted");
    assertEquals(trustedItem.reviewPriority, 40);
    assertEquals(normalItem.reporterTrustLevel, "normal");
    assertEquals(normalItem.reviewPriority, 20);

    const trustedIndex = queue.json.items.findIndex((report) => report.id === trustedItem.id);
    const normalIndex = queue.json.items.findIndex((report) => report.id === normalItem.id);
    assert(
      trustedIndex !== -1 && normalIndex !== -1 && trustedIndex < normalIndex,
      "trusted reporter's older report should sort ahead of the normal reporter's newer report",
    );
  } finally {
    const restored = await api<{ ok: boolean }>(
      `/api/admin/users/${USERS.ana.username}/trust-level`,
      {
        asUser: USERS.admin.clerkId,
        body: { trustLevel: "normal", reason: "e2e restore report priority" },
      },
    );
    assertStatus(restored, 200);
  }
});

e2eTest("admin can filter reports, bulk resolve them, and leave moderation notes", async () => {
  const before = await api<{ items: Report[] }>("/api/admin/reports?status=all", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(before, 200);
  const beforeIds = new Set(before.json.items.map((report) => report.id));

  const postReport = await api<{ ok: boolean }>("/api/reports", {
    asUser: USERS.ren.clerkId,
    body: {
      targetType: "post",
      targetCode: POSTS.classicYoutube.code,
      reason: "spam",
      details: "bulk filter e2e post",
    },
  });
  assertStatus(postReport, 201);

  const userReport = await api<{ ok: boolean }>("/api/reports", {
    asUser: USERS.maya.clerkId,
    body: {
      targetType: "user",
      targetCode: USERS.ana.username,
      reason: "harassment",
      details: "bulk filter e2e user",
    },
  });
  assertStatus(userReport, 201);

  const filteredPostReports = await api<{ items: Report[] }>(
    "/api/admin/reports?status=open&targetType=post&reason=spam",
    { asUser: USERS.admin.clerkId },
  );
  assertStatus(filteredPostReports, 200);
  const minePost = filteredPostReports.json.items.find((report) => !beforeIds.has(report.id));
  assert(minePost !== undefined, "new spam post report should match filters");
  assertEquals(minePost.targetCode, POSTS.classicYoutube.code);

  const allAfter = await api<{ items: Report[] }>("/api/admin/reports?status=all", {
    asUser: USERS.admin.clerkId,
  });
  const mineUser = allAfter.json.items.find((report) =>
    !beforeIds.has(report.id) && report.targetType === "user"
  );
  assert(mineUser !== undefined, "new user report should be visible in all reports");

  const note = "Batch reviewed in e2e.";
  const bulk = await api<{ ok: boolean; count: number }>("/api/admin/reports/bulk", {
    asUser: USERS.admin.clerkId,
    body: {
      reportIds: [minePost.id, mineUser.id],
      status: "dismissed",
      note,
    },
  });
  assertStatus(bulk, 200);
  assertEquals(bulk.json.count, 2);

  const dismissedPostReports = await api<{ items: Report[] }>(
    "/api/admin/reports?status=dismissed&targetType=post&reason=spam",
    { asUser: USERS.admin.clerkId },
  );
  const resolvedPost = dismissedPostReports.json.items.find((report) => report.id === minePost.id);
  assert(resolvedPost !== undefined, "dismissed report should be filterable by status");
  assert(
    resolvedPost.notes.some((moderationNote) => moderationNote.bodyText === note),
    "bulk note should attach to the reported target",
  );

  const openReports = await api<{ items: Report[] }>("/api/admin/reports", {
    asUser: USERS.admin.clerkId,
  });
  assert(
    openReports.json.items.every((report) =>
      report.id !== minePost.id && report.id !== mineUser.id
    ),
    "bulk dismissed reports should leave the open queue",
  );

  const audit = await api<{ items: ModerationAuditEvent[] }>("/api/admin/moderation/audit", {
    asUser: USERS.admin.clerkId,
  });
  assertStatus(audit, 200);
  assert(
    audit.json.items.some((event) =>
      event.action === "report_dismissed" &&
      event.reportId === minePost.id &&
      event.targetCode === POSTS.classicYoutube.code
    ),
    "bulk report dismissal should be audited",
  );
  assert(
    audit.json.items.some((event) =>
      event.action === "note_created" && event.targetCode === POSTS.classicYoutube.code
    ),
    "bulk moderation note should be audited",
  );
});

e2eTest("admin can ban and restore a user; banned users cannot write", async () => {
  const suspended = await api<{ ok: boolean }>(
    `/api/admin/users/${USERS.ren.username}/status`,
    {
      asUser: USERS.admin.clerkId,
      body: { status: "suspended", reason: "e2e suspension" },
    },
  );
  assertStatus(suspended, 200);

  const banned = await api<{ ok: boolean }>(`/api/admin/users/${USERS.ren.username}/status`, {
    asUser: USERS.admin.clerkId,
    body: { status: "banned", reason: "e2e ban" },
  });
  assertStatus(banned, 200);

  const profile = await api<UserProfile>(`/api/users/${USERS.ren.username}`);
  assertStatus(profile, 200);
  assertEquals(profile.json.status, "banned");

  const blockedWrite = await api("/api/posts", {
    asUser: USERS.ren.clerkId,
    body: {
      postKind: "text",
      title: "E2E: banned user write blocked",
      bodyText: "This should never publish.",
    },
  });
  assertStatus(blockedWrite, 403);

  const restored = await api<{ ok: boolean }>(`/api/admin/users/${USERS.ren.username}/status`, {
    asUser: USERS.admin.clerkId,
    body: { status: "active", reason: "e2e restore" },
  });
  assertStatus(restored, 200);

  const restoredProfile = await api<UserProfile>(`/api/users/${USERS.ren.username}`);
  assertStatus(restoredProfile, 200);
  assertEquals(restoredProfile.json.status, "active");

  const allowedWrite = await api<CreatePostResponse>("/api/posts", {
    asUser: USERS.ren.clerkId,
    body: {
      postKind: "text",
      title: "E2E: restored user can post",
      bodyText: "Restoring account status should reopen writes.",
    },
  });
  assertStatus(allowedWrite, 201);

  const audit = await api<{ items: ModerationAuditEvent[] }>("/api/admin/moderation/audit", {
    asUser: USERS.admin.clerkId,
  });
  assert(
    audit.json.items.some((event) =>
      event.action === "user_status_changed" &&
      event.targetCode === USERS.ren.username &&
      event.metadata.status === "banned"
    ),
    "user status changes should be audited",
  );
});
