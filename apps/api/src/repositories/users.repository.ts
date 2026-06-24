import { comments, posts, users } from "@doomscrollr/database/schema.ts";
import type { UserProfile } from "@doomscrollr/shared/types.ts";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { toUserProfile, type UserRow } from "./transformers.ts";

export async function getUserProfile(username: string): Promise<UserProfile | null> {
  if (!db) {
    throw new Error("Database is not configured.");
  }

  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const user = userRows[0] as UserRow | undefined;
  if (!user) {
    return null;
  }

  const postCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.authorId, user.id));
  const commentCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(eq(comments.authorId, user.id));

  return toUserProfile(user, {
    postCount: Number(postCountRows[0]?.count ?? 0),
    commentCount: Number(commentCountRows[0]?.count ?? 0),
  });
}
