// The authentication + onboarding + abuse-control boundaries:
//   - writes require a session (401) and a claimed username (409 USERNAME_REQUIRED);
//   - the username setup flow (claim / taken / reserved / invalid);
//   - the one unauthenticated write (POST /api/events) and its validation;
//   - fixed-window rate limiting returns 429.
//
// Auth uses the gated test seam: `asUser: <clerkId>` becomes a `test:<clerkId>`
// bearer. Clerk ids that are not seeded resolve to "no local user yet".

import type { UserProfile } from "@doomscrollr/shared/types.ts";
import { api, assert, assertEquals, assertStatus, e2eTest, POSTS, USERS } from "./harness.ts";

type ErrorBody = { error: { code: string; message: string } };
type AccountState = { needsUsername: boolean; user: UserProfile | null };

e2eTest("writes without a session are rejected with 401", async () => {
  const res = await api<ErrorBody>("/api/posts", {
    body: { postKind: "text", title: "no session", bodyText: "should fail", tags: [] },
  });
  assertStatus(res, 401);
  assertEquals(res.json.error.code, "UNAUTHORIZED");
});

e2eTest("an authenticated user without a username is gated with 409", async () => {
  // A valid session (the seam accepts the token) but no local user row yet.
  const res = await api<ErrorBody>("/api/posts", {
    asUser: "clerk_e2e_noprofile",
    body: { postKind: "text", title: "no handle", bodyText: "should be gated", tags: [] },
  });
  assertStatus(res, 409);
  assertEquals(res.json.error.code, "USERNAME_REQUIRED");
});

e2eTest("username setup flow: gate -> claim -> onboarded -> can post", async () => {
  const clerkId = "clerk_e2e_newcomer";

  // Before claiming, account state asks for a username.
  const before = await api<AccountState>("/api/account/me", { asUser: clerkId });
  assertStatus(before, 200);
  assertEquals(before.json.needsUsername, true, "newcomer should need a username");

  // Claim one.
  const claim = await api<AccountState>("/api/account/username", {
    asUser: clerkId,
    body: { username: "newbie" },
  });
  assertStatus(claim, 201);
  assertEquals(claim.json.needsUsername, false);
  assertEquals(claim.json.user?.username, "newbie");

  // Account state now reflects the onboarded user.
  const after = await api<AccountState>("/api/account/me", { asUser: clerkId });
  assertEquals(after.json.needsUsername, false, "newcomer is onboarded");

  // And the previously-gated write now succeeds.
  const post = await api("/api/posts", {
    asUser: clerkId,
    body: {
      postKind: "text",
      title: "E2E: my first post",
      bodyText: "made it past the gate",
      tags: [],
    },
  });
  assertStatus(post, 201);
});

e2eTest("usernames that are taken, reserved, or malformed are rejected", async () => {
  const taken = await api<ErrorBody>("/api/account/username", {
    asUser: "clerk_e2e_taken",
    body: { username: USERS.maya.username },
  });
  assertStatus(taken, 409);
  assertEquals(taken.json.error.code, "USERNAME_TAKEN");

  const reserved = await api("/api/account/username", {
    asUser: "clerk_e2e_reserved",
    body: { username: "admin" },
  });
  assertStatus(reserved, 400);

  const malformed = await api("/api/account/username", {
    asUser: "clerk_e2e_malformed",
    body: { username: "no" }, // too short for the 3-24 rule
  });
  assertStatus(malformed, 400);
});

e2eTest("the anonymous events endpoint accepts client events and rejects the rest", async () => {
  const ok = await api(`/api/events`, {
    body: { eventType: "post_opened", postCode: POSTS.fridayText.code },
  });
  assertStatus(ok, 204);

  // Server-only event types are not part of the client schema.
  const serverEvent = await api(`/api/events`, {
    body: { eventType: "comment_created", postCode: POSTS.fridayText.code },
  });
  assertStatus(serverEvent, 400);

  // Unknown post.
  const missing = await api(`/api/events`, {
    body: { eventType: "post_opened", postCode: "doesnotexist" },
  });
  assertStatus(missing, 404);
});

e2eTest("report rate limit returns 429 after the window budget is spent", async () => {
  // A fresh, isolated user so the report bucket (report:<userId>) is clean.
  const onboarded = await api("/api/account/username", {
    asUser: "clerk_e2e_limiter",
    body: { username: "limiter" },
  });
  assertStatus(onboarded, 201);

  const LIMIT = 20; // RATE_LIMITS.report
  const statuses: number[] = [];
  for (let i = 0; i < LIMIT + 1; i++) {
    const res = await api<ErrorBody>("/api/reports", {
      asUser: "clerk_e2e_limiter",
      body: { targetType: "post", targetCode: POSTS.forumsText.code, reason: "spam" },
    });
    statuses.push(res.status);
    if (i === LIMIT) {
      assertEquals(res.status, 429, "request past the budget should be rate limited");
      assertEquals(res.json.error.code, "RATE_LIMITED");
    }
  }

  assertEquals(statuses[0], 201, "the first report should succeed");
  assert(
    statuses.slice(0, LIMIT).every((status) => status === 201),
    `all ${LIMIT} reports within budget should succeed, got ${statuses.join(",")}`,
  );
});
