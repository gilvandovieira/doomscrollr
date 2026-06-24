// V2 reposts and quote posts: one-hop embedded targets, duplicate repost guard,
// target counters, and moderation/blocking visibility rules.

import type { FeedPost, PostDetail, UserProfile } from "@doomscrollr/shared/types.ts";
import { api, assert, assertEquals, assertStatus, e2eTest, POSTS, USERS } from "./harness.ts";

type AccountState = { needsUsername: boolean; user: UserProfile | null };
type CreatePostResponse = { post: PostDetail; canonicalUrl: string };
type ErrorBody = { error: { code: string; message: string } };
type FeedResponse = { items: FeedPost[]; nextCursor: string | null };

e2eTest("a user can repost a published post once and the target count increments", async () => {
  const actor = await claimUser("clerk_e2e_reposter", "reposter");
  const targetCode = POSTS.cacheImage.code;
  const before = await api<PostDetail>(`/api/posts/${targetCode}`);
  assertStatus(before, 200);

  const repost = await api<CreatePostResponse>(`/api/posts/${targetCode}/reposts`, {
    method: "POST",
    asUser: actor,
  });
  assertStatus(repost, 201);
  assertEquals(repost.json.post.postKind, "repost");
  assertEquals(repost.json.post.author.username, "reposter");
  assertEquals(repost.json.post.bodyText, null, "reposts do not carry new body text");
  assertEquals(repost.json.post.tags.length, 0, "reposts do not copy source tags");
  assertEquals(
    repost.json.post.repostOf?.publicCode,
    targetCode,
    "repost should embed the original target",
  );
  assertEquals(
    repost.json.post.repostOf?.author.username,
    POSTS.cacheImage.author,
    "embedded target keeps its author",
  );
  assert(
    !("id" in repost.json.post.repostOf!),
    "embedded target must not expose internal ids",
  );

  const after = await api<PostDetail>(`/api/posts/${targetCode}`);
  assertStatus(after, 200);
  assertEquals(
    after.json.repostCount,
    before.json.repostCount + 1,
    "target repost count should increment once",
  );

  const feed = await api<FeedResponse>("/api/feed/recent", { asUser: actor });
  assertStatus(feed, 200);
  assert(
    feed.json.items.some((post) =>
      post.publicCode === repost.json.post.publicCode &&
      post.repostOf?.publicCode === targetCode
    ),
    "new repost should appear in the actor's feed with its embedded target",
  );

  const duplicate = await api<ErrorBody>(`/api/posts/${targetCode}/reposts`, {
    method: "POST",
    asUser: actor,
  });
  assertStatus(duplicate, 409);
  assertEquals(duplicate.json.error.code, "REPOST_EXISTS");
});

e2eTest("duplicate concurrent reposts are controlled by the database guard", async () => {
  const actor = await claimUser("clerk_e2e_repost_racer", "repostrace");
  const targetCode = POSTS.shortYoutube.code;

  const results = await Promise.all([
    api<CreatePostResponse | ErrorBody>(`/api/posts/${targetCode}/reposts`, {
      method: "POST",
      asUser: actor,
    }),
    api<CreatePostResponse | ErrorBody>(`/api/posts/${targetCode}/reposts`, {
      method: "POST",
      asUser: actor,
    }),
  ]);
  const statuses = results.map((result) => result.status).sort();
  assertEquals(statuses[0], 201);
  assertEquals(statuses[1], 409);
});

e2eTest("a user can quote a published post and the target quote count increments", async () => {
  const actor = await claimUser("clerk_e2e_quoter", "quoter");
  const targetCode = POSTS.fridayText.code;
  const quoteBody = "This is exactly the incident report energy I needed today.";
  const before = await api<PostDetail>(`/api/posts/${targetCode}`);
  assertStatus(before, 200);

  const quote = await api<CreatePostResponse>(`/api/posts/${targetCode}/quotes`, {
    asUser: actor,
    body: { bodyText: quoteBody },
  });
  assertStatus(quote, 201);
  assertEquals(quote.json.post.postKind, "quote");
  assertEquals(quote.json.post.author.username, "quoter");
  assertEquals(quote.json.post.bodyText, quoteBody);
  assertEquals(
    quote.json.post.repostOf?.publicCode,
    targetCode,
    "quote should embed the original target",
  );

  const after = await api<PostDetail>(`/api/posts/${targetCode}`);
  assertStatus(after, 200);
  assertEquals(
    after.json.quoteCount,
    before.json.quoteCount + 1,
    "target quote count should increment once",
  );
});

e2eTest("block relationships prevent reposting and quoting in either direction", async () => {
  const actor = await claimUser("clerk_e2e_blocked_reposter", "reshareblk");
  const targetCode = POSTS.forumsText.code; // owned by maya

  const blockedByAuthor = await api(`/api/users/reshareblk/block`, {
    method: "POST",
    asUser: USERS.maya.clerkId,
  });
  assertStatus(blockedByAuthor, 204);

  const blockedRepost = await api<ErrorBody>(`/api/posts/${targetCode}/reposts`, {
    method: "POST",
    asUser: actor,
  });
  assertStatus(blockedRepost, 403);

  const unblock = await api(`/api/users/reshareblk/block`, {
    method: "DELETE",
    asUser: USERS.maya.clerkId,
  });
  assertStatus(unblock, 204);

  const actorBlocksAuthor = await api(`/api/users/${USERS.maya.username}/block`, {
    method: "POST",
    asUser: actor,
  });
  assertStatus(actorBlocksAuthor, 204);

  const blockedQuote = await api<ErrorBody>(`/api/posts/${targetCode}/quotes`, {
    asUser: actor,
    body: { bodyText: "Trying to quote someone I blocked." },
  });
  assertStatus(blockedQuote, 403);
});

e2eTest("reshares of a target disappear from feeds after that target is removed", async () => {
  const owner = await claimUser("clerk_e2e_reshare_owner", "reshareown");
  const actor = await claimUser("clerk_e2e_reshare_viewer", "reshareview");

  const original = await api<CreatePostResponse>("/api/posts", {
    asUser: owner,
    body: {
      postKind: "text",
      title: "E2E: a post that will be removed",
      bodyText: "This target starts visible and then gets moderated.",
      tags: [],
    },
  });
  assertStatus(original, 201);

  const repost = await api<CreatePostResponse>(
    `/api/posts/${original.json.post.publicCode}/reposts`,
    {
      method: "POST",
      asUser: actor,
    },
  );
  assertStatus(repost, 201);

  const feedBeforeRemoval = await api<FeedResponse>("/api/feed/recent", { asUser: actor });
  assertStatus(feedBeforeRemoval, 200);
  assert(
    feedBeforeRemoval.json.items.some((post) => post.publicCode === repost.json.post.publicCode),
    "reshare should be visible while its target is published",
  );

  const removed = await api<{ ok: boolean }>(
    `/api/admin/posts/${original.json.post.publicCode}/remove`,
    {
      asUser: USERS.admin.clerkId,
      body: { reason: "E2E reshare target removal" },
    },
  );
  assertStatus(removed, 200);

  const feedAfterRemoval = await api<FeedResponse>("/api/feed/recent", { asUser: actor });
  assertStatus(feedAfterRemoval, 200);
  assert(
    !feedAfterRemoval.json.items.some((post) => post.publicCode === repost.json.post.publicCode),
    "reshare should not remain in feeds after its target is removed",
  );

  const lateRepost = await api(`/api/posts/${original.json.post.publicCode}/reposts`, {
    method: "POST",
    asUser: actor,
  });
  assertStatus(lateRepost, 404);
});

e2eTest("a user cannot repost or quote their own post", async () => {
  const author = await claimUser("clerk_e2e_self_resharer", "selfshare");
  const own = await api<CreatePostResponse>("/api/posts", {
    asUser: author,
    body: {
      postKind: "text",
      title: "E2E: a post I would love to amplify myself",
      bodyText: "But the anti-spam rule says no self-reposting.",
      tags: [],
    },
  });
  assertStatus(own, 201);
  const code = own.json.post.publicCode;

  const selfRepost = await api<ErrorBody>(`/api/posts/${code}/reposts`, {
    method: "POST",
    asUser: author,
  });
  assertStatus(selfRepost, 400);

  const selfQuote = await api<ErrorBody>(`/api/posts/${code}/quotes`, {
    asUser: author,
    body: { bodyText: "Quoting my own post should be blocked." },
  });
  assertStatus(selfQuote, 400);
});

async function claimUser(clerkId: string, username: string): Promise<string> {
  const claimed = await api<AccountState>("/api/account/username", {
    asUser: clerkId,
    body: { username },
  });
  assertStatus(claimed, 201);
  assertEquals(claimed.json.user?.username, username, "claimed username");
  return clerkId;
}
