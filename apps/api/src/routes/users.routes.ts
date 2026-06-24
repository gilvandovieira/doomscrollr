import { getMockUserByUsername, mockPosts } from "@doomscrollr/shared/mock-data.ts";
import { Hono } from "hono";
import { notFound } from "../lib/errors.ts";

export const usersRoutes = new Hono();

usersRoutes.get("/:username/posts", (c) => {
  const username = c.req.param("username");
  const user = getMockUserByUsername(username);

  if (!user) {
    throw notFound("User not found.");
  }

  return c.json({
    items: mockPosts.filter((post) => post.author.username === username),
  });
});

usersRoutes.get("/:username", (c) => {
  const user = getMockUserByUsername(c.req.param("username"));

  if (!user) {
    throw notFound("User not found.");
  }

  return c.json(user);
});
