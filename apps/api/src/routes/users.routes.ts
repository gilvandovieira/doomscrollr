import { getMockUserByUsername, getMockUserPosts } from "@doomscrollr/shared/mock-data.ts";
import { Hono } from "hono";
import { hasDatabase } from "../db/client.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { enforceRateLimit, RATE_LIMITS } from "../lib/rate-limit.ts";
import { listPostsByUsername } from "../repositories/posts.repository.ts";
import { getUserIdByUsername, getUserProfile } from "../repositories/users.repository.ts";
import { blockUser, unblockUser } from "../repositories/blocks.repository.ts";
import { getAuthUser, getOptionalViewerId, requireUser } from "../middleware/auth.ts";

export const usersRoutes = new Hono();

// POST /api/users/:username/block (spec §15, §20.3).
usersRoutes.post("/:username/block", requireUser, async (c) => {
  const user = getAuthUser(c);
  enforceRateLimit(`block:${user.id}`, RATE_LIMITS.block);

  const targetId = await getUserIdByUsername(c.req.param("username"));
  if (!targetId) throw notFound("User not found.");
  if (targetId === user.id) throw badRequest("You cannot block yourself.");

  await blockUser(user.id, targetId);
  return c.body(null, 204);
});

// DELETE /api/users/:username/block
usersRoutes.delete("/:username/block", requireUser, async (c) => {
  const user = getAuthUser(c);
  const targetId = await getUserIdByUsername(c.req.param("username"));
  if (!targetId) throw notFound("User not found.");

  await unblockUser(user.id, targetId);
  return c.body(null, 204);
});

// GET /api/users/:username/posts — recent posts for a profile.
usersRoutes.get("/:username/posts", async (c) => {
  const username = c.req.param("username");

  if (!hasDatabase()) {
    if (!getMockUserByUsername(username)) throw notFound("User not found.");
    return c.json(getMockUserPosts(username));
  }

  const viewerId = await getOptionalViewerId(c);
  const response = await listPostsByUsername(username, viewerId);
  if (!response) throw notFound("User not found.");
  return c.json(response);
});

// GET /api/users/:username — public profile (spec §20.2).
usersRoutes.get("/:username", async (c) => {
  const username = c.req.param("username");

  if (!hasDatabase()) {
    const user = getMockUserByUsername(username);
    if (!user) throw notFound("User not found.");
    return c.json(user);
  }

  const user = await getUserProfile(username);
  if (!user) throw notFound("User not found.");
  return c.json(user);
});
