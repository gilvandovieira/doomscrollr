import { comments, posts, users } from "@doomscrollr/database/schema.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import type {
  UserProfile,
  UserRole,
  UserStatus,
  UserTrustLevel,
} from "@doomscrollr/shared/types.ts";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { toUserProfile, type UserRow } from "./transformers.ts";

// The authenticated local user attached to write requests.
export type LocalUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  trustLevel: UserTrustLevel;
  locale: string | null;
  themePreference: string | null;
};

const localUserColumns = {
  id: users.id,
  username: users.username,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  role: users.role,
  status: users.status,
  trustLevel: users.trustLevel,
  locale: users.locale,
  themePreference: users.themePreference,
};

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

export async function getUserIdByClerkId(clerkUserId: string): Promise<string | null> {
  const rows = await requireDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getUserIdByUsername(username: string): Promise<string | null> {
  const rows = await requireDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function getUserModerationTargetByUsername(
  username: string,
): Promise<
  {
    id: string;
    username: string;
    role: UserRole;
    status: UserStatus;
    trustLevel: UserTrustLevel;
  } | null
> {
  const rows = await requireDb()
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      status: users.status,
      trustLevel: users.trustLevel,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUsersByUsernames(
  usernames: string[],
): Promise<Array<{ id: string; username: string }>> {
  const unique = [...new Set(usernames.map((username) => username.toLowerCase()))];
  if (unique.length === 0) return [];

  return await requireDb()
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.username, unique));
}

export async function getLocalUserByClerkId(clerkUserId: string): Promise<LocalUser | null> {
  const rows = await requireDb()
    .select(localUserColumns)
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  return rows[0] ?? null;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  const rows = await requireDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows.length > 0;
}

export async function createLocalUser(input: {
  clerkUserId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}): Promise<LocalUser> {
  const rows = await requireDb()
    .insert(users)
    .values({
      id: generateId(),
      clerkUserId: input.clerkUserId,
      username: input.username,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    })
    .returning(localUserColumns);
  return rows[0];
}

export async function setUsername(userId: string, username: string): Promise<LocalUser> {
  const rows = await requireDb()
    .update(users)
    .set({ username, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning(localUserColumns);
  return rows[0];
}

// Update display preferences. Only the keys present in `prefs` change; an explicit
// null clears that preference (back to following the device).
export async function updateUserPreferences(
  userId: string,
  prefs: { locale?: string | null; themePreference?: string | null },
): Promise<LocalUser> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if ("locale" in prefs) patch.locale = prefs.locale ?? null;
  if ("themePreference" in prefs) patch.themePreference = prefs.themePreference ?? null;

  const rows = await requireDb()
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning(localUserColumns);
  return rows[0];
}

export async function setUserStatusByUsername(
  username: string,
  status: UserStatus,
): Promise<{ id: string; username: string; status: UserStatus } | null> {
  const rows = await requireDb()
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.username, username))
    .returning({ id: users.id, username: users.username, status: users.status });
  return rows[0] ?? null;
}

export async function setUserTrustLevelByUsername(
  username: string,
  trustLevel: UserTrustLevel,
): Promise<
  {
    id: string;
    username: string;
    role: UserRole;
    status: UserStatus;
    trustLevel: UserTrustLevel;
  } | null
> {
  const role: UserRole = trustLevel === "admin" ? "admin" : "user";
  const rows = await requireDb()
    .update(users)
    .set({ role, trustLevel, updatedAt: new Date() })
    .where(eq(users.username, username))
    .returning({
      id: users.id,
      username: users.username,
      role: users.role,
      status: users.status,
      trustLevel: users.trustLevel,
    });
  return rows[0] ?? null;
}

export async function getUserProfile(username: string): Promise<UserProfile | null> {
  const database = requireDb();

  const userRows = await database
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

  const user = userRows[0] as (UserRow & { id: string }) | undefined;
  if (!user) return null;

  const [postCountRows, commentCountRows] = await Promise.all([
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(and(eq(posts.authorId, user.id), eq(posts.status, "published"))),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(and(eq(comments.authorId, user.id), eq(comments.status, "published"))),
  ]);

  return toUserProfile(user, {
    postCount: Number(postCountRows[0]?.count ?? 0),
    commentCount: Number(commentCountRows[0]?.count ?? 0),
  });
}
