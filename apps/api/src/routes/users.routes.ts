import { getMockUserByUsername, mockPosts } from "@doomscrollr/shared/mock-data.ts";
import { Hono } from "hono";
import { hasDatabase } from "../db/client.ts";
import { notFound } from "../lib/errors.ts";
import { listPostsByUser } from "../repositories/posts.repository.ts";
import { getUserProfile } from "../repositories/users.repository.ts";

export const usersRoutes = new Hono();

usersRoutes.get("/:username/posts", async (c) => {
  const username = c.req.param("username");

  if (hasDatabase()) {
    const response = await listPostsByUser(username);

    if (!response) {
      throw notFound("User not found.");
    }

    return c.json(response);
  }

  const user = getMockUserByUsername(username);

  if (!user) {
    throw notFound("User not found.");
  }

  return c.json({
    items: mockPosts.filter((post) => post.author.username === username),
    nextCursor: null,
  });
});

usersRoutes.get("/:username", async (c) => {
  if (hasDatabase()) {
    const user = await getUserProfile(c.req.param("username"));

    if (!user) {
      throw notFound("User not found.");
    }

    return c.json(user);
  }

  const user = getMockUserByUsername(c.req.param("username"));

  if (!user) {
    throw notFound("User not found.");
  }

  return c.json(user);
});
