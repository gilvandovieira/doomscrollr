import { comments, notifications, posts, users } from "@doomscrollr/database/schema.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import type { Notification, NotificationType } from "@doomscrollr/shared/types.ts";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { isBlocked } from "./blocks.repository.ts";
import { canonicalPath } from "./transformers.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

type NotificationMetadata = Record<string, unknown> | null;

export async function createNotification(input: {
  recipientUserId: string;
  actorUserId?: string | null;
  type: NotificationType;
  postId?: string | null;
  commentId?: string | null;
  metadata?: NotificationMetadata;
}): Promise<boolean> {
  const actorUserId = input.actorUserId ?? null;
  if (actorUserId && actorUserId === input.recipientUserId) return false;
  if (actorUserId && await isBlocked(input.recipientUserId, actorUserId)) return false;

  await requireDb().insert(notifications).values({
    id: generateId(),
    recipientUserId: input.recipientUserId,
    actorUserId,
    type: input.type,
    postId: input.postId ?? null,
    commentId: input.commentId ?? null,
    metadata: input.metadata ?? null,
  });
  return true;
}

export async function listNotificationsForUser(
  recipientUserId: string,
  limit = 50,
): Promise<{ items: Notification[]; unreadCount: number }> {
  const actor = alias(users, "notification_actor");
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const database = requireDb();

  const [rows, countRows] = await Promise.all([
    database
      .select({
        id: notifications.id,
        type: notifications.type,
        metadata: notifications.metadata,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actor: {
          username: actor.username,
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl,
        },
        postCode: posts.publicCode,
        postSlug: posts.slug,
        postTitle: sql<string | null>`CASE
          WHEN ${posts.status} = 'published' THEN ${posts.title}
          ELSE NULL
        END`,
        commentCode: comments.publicCode,
        commentBodyText: sql<string | null>`CASE
          WHEN ${comments.status} = 'published'
            AND (${posts.id} IS NULL OR ${posts.status} = 'published')
          THEN ${comments.bodyText}
          ELSE NULL
        END`,
      })
      .from(notifications)
      .leftJoin(actor, eq(notifications.actorUserId, actor.id))
      .leftJoin(posts, eq(notifications.postId, posts.id))
      .leftJoin(comments, eq(notifications.commentId, comments.id))
      .where(eq(notifications.recipientUserId, recipientUserId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(safeLimit),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt))),
  ]);

  return {
    items: rows.map((row) => {
      const actor = row.actor;
      return {
        id: row.id,
        type: row.type,
        actor: actor?.username
          ? {
            username: actor.username,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
          }
          : null,
        postCode: row.postCode,
        postTitle: row.postTitle,
        postPath: row.postCode && row.postSlug ? canonicalPath(row.postCode, row.postSlug) : null,
        commentCode: row.commentCode,
        bodyPreview: previewText(row.commentBodyText),
        metadata: normalizeMetadata(row.metadata),
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    }),
    unreadCount: Number(countRows[0]?.count ?? 0),
  };
}

export async function markNotificationRead(
  notificationId: string,
  recipientUserId: string,
): Promise<boolean> {
  const rows = await requireDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.id, notificationId), eq(notifications.recipientUserId, recipientUserId)),
    )
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function markAllNotificationsRead(recipientUserId: string): Promise<number> {
  const rows = await requireDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}

function previewText(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) return normalized;
  return `${normalized.slice(0, 137)}...`;
}

function normalizeMetadata(value: unknown): NotificationMetadata {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
