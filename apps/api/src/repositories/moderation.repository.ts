import { moderationAuditEvents, moderationNotes, users } from "@doomscrollr/database/schema.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import type {
  ModerationAuditAction,
  ModerationAuditEvent,
  ModerationNote,
  ReportTargetType,
} from "@doomscrollr/shared/types.ts";
import { and, desc, eq, or, type SQL } from "drizzle-orm";
import { db } from "../db/client.ts";
import { getCommentNotificationRefByCode } from "./comments.repository.ts";
import { getPostModerationTargetByCode } from "./posts.repository.ts";
import { getUserModerationTargetByUsername } from "./users.repository.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

export type ModerationTargetRef = {
  targetType: ReportTargetType;
  targetId: string;
  targetCode: string;
};

function targetKey(targetType: ReportTargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function resolveModerationTarget(
  targetType: ReportTargetType,
  targetCode: string,
): Promise<ModerationTargetRef | null> {
  const normalizedCode = targetType === "user"
    ? targetCode.trim().replace(/^@/, "").toLowerCase()
    : targetCode.trim();
  if (!normalizedCode) return null;

  if (targetType === "post") {
    const post = await getPostModerationTargetByCode(normalizedCode);
    return post ? { targetType, targetId: post.id, targetCode: post.publicCode } : null;
  }

  if (targetType === "comment") {
    const comment = await getCommentNotificationRefByCode(normalizedCode);
    return comment ? { targetType, targetId: comment.id, targetCode: comment.publicCode } : null;
  }

  const user = await getUserModerationTargetByUsername(normalizedCode);
  return user ? { targetType, targetId: user.id, targetCode: user.username } : null;
}

export async function listModerationNotesForTargets(
  targets: ModerationTargetRef[],
): Promise<Map<string, ModerationNote[]>> {
  const notesByTarget = new Map<string, ModerationNote[]>();
  const uniqueTargets = [...new Map(targets.map((target) => [
    targetKey(target.targetType, target.targetId),
    target,
  ])).values()];
  if (uniqueTargets.length === 0) return notesByTarget;

  const filters = uniqueTargets.map((target) =>
    and(
      eq(moderationNotes.targetType, target.targetType),
      eq(moderationNotes.targetId, target.targetId),
    )
  ).filter(Boolean) as SQL[];

  const rows = await requireDb()
    .select({
      id: moderationNotes.id,
      targetType: moderationNotes.targetType,
      targetId: moderationNotes.targetId,
      targetCode: moderationNotes.targetCode,
      bodyText: moderationNotes.bodyText,
      author: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
      createdAt: moderationNotes.createdAt,
    })
    .from(moderationNotes)
    .innerJoin(users, eq(moderationNotes.authorUserId, users.id))
    .where(or(...filters)!)
    .orderBy(desc(moderationNotes.createdAt), desc(moderationNotes.id));

  for (const row of rows) {
    const key = targetKey(row.targetType, row.targetId);
    notesByTarget.set(key, [
      ...(notesByTarget.get(key) ?? []),
      {
        id: row.id,
        targetType: row.targetType,
        targetCode: row.targetCode,
        bodyText: row.bodyText,
        author: row.author,
        createdAt: row.createdAt.toISOString(),
      },
    ]);
  }

  return notesByTarget;
}

export async function listModerationNotes(
  targetType: ReportTargetType,
  targetCode: string,
): Promise<ModerationNote[] | null> {
  const target = await resolveModerationTarget(targetType, targetCode);
  if (!target) return null;
  const notes = await listModerationNotesForTargets([target]);
  return notes.get(targetKey(target.targetType, target.targetId)) ?? [];
}

export async function createModerationNote(input: {
  actorUserId: string;
  targetType: ReportTargetType;
  targetCode: string;
  bodyText: string;
}): Promise<ModerationNote | null> {
  const target = await resolveModerationTarget(input.targetType, input.targetCode);
  if (!target) return null;
  const id = generateId();

  await requireDb().insert(moderationNotes).values({
    id,
    targetType: target.targetType,
    targetId: target.targetId,
    targetCode: target.targetCode,
    authorUserId: input.actorUserId,
    bodyText: input.bodyText,
  });

  await recordModerationAuditEvent({
    actorUserId: input.actorUserId,
    action: "note_created",
    targetType: target.targetType,
    targetId: target.targetId,
    targetCode: target.targetCode,
    metadata: { noteId: id },
  });

  const notes = await listModerationNotesForTargets([target]);
  return notes.get(targetKey(target.targetType, target.targetId))?.find((note) => note.id === id) ??
    null;
}

export async function recordModerationAuditEvent(input: {
  actorUserId: string;
  action: ModerationAuditAction;
  targetType: ReportTargetType;
  targetId: string;
  targetCode: string;
  reportId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await requireDb().insert(moderationAuditEvents).values({
    id: generateId(),
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    targetCode: input.targetCode,
    reportId: input.reportId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function listModerationAuditEvents(
  limit: number | null = 30,
): Promise<ModerationAuditEvent[]> {
  const query = requireDb()
    .select({
      id: moderationAuditEvents.id,
      actor: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
      action: moderationAuditEvents.action,
      targetType: moderationAuditEvents.targetType,
      targetCode: moderationAuditEvents.targetCode,
      reportId: moderationAuditEvents.reportId,
      reason: moderationAuditEvents.reason,
      metadata: moderationAuditEvents.metadata,
      createdAt: moderationAuditEvents.createdAt,
    })
    .from(moderationAuditEvents)
    .innerJoin(users, eq(moderationAuditEvents.actorUserId, users.id))
    .orderBy(desc(moderationAuditEvents.createdAt), desc(moderationAuditEvents.id));

  const rows = limit === null ? await query : await query.limit(Math.min(Math.max(limit, 1), 100));

  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action as ModerationAuditAction,
    targetType: row.targetType,
    targetCode: row.targetCode,
    reportId: row.reportId,
    reason: row.reason,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  }));
}

export function moderationTargetKey(target: ModerationTargetRef): string {
  return targetKey(target.targetType, target.targetId);
}
