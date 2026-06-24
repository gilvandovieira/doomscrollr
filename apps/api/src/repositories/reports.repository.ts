import { comments, posts, reports, users } from "@doomscrollr/database/schema.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import type { Report, ReportTargetType } from "@doomscrollr/shared/types.ts";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { getCommentRefByCode } from "./comments.repository.ts";
import { getPostIdByPublicCode } from "./posts.repository.ts";
import { getUserIdByUsername } from "./users.repository.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

async function resolveTargetId(
  targetType: ReportTargetType,
  targetCode: string,
): Promise<string | null> {
  if (targetType === "post") return await getPostIdByPublicCode(targetCode);
  if (targetType === "comment") return (await getCommentRefByCode(targetCode))?.id ?? null;
  return await getUserIdByUsername(targetCode);
}

// Create a report against a post/comment/user (spec §14). Returns false when the
// target cannot be resolved. Bumps the post report counter for post targets.
export async function createReport(input: {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetCode: string;
  reason: string;
  details?: string | null;
}): Promise<boolean> {
  const targetId = await resolveTargetId(input.targetType, input.targetCode);
  if (!targetId) return false;

  await requireDb().transaction(async (tx) => {
    await tx.insert(reports).values({
      id: generateId(),
      reporterUserId: input.reporterUserId,
      targetType: input.targetType,
      targetId,
      reason: input.reason,
      details: input.details ?? null,
    });
    if (input.targetType === "post") {
      await tx
        .update(posts)
        .set({ reportCount: sql`${posts.reportCount} + 1`, updatedAt: new Date() })
        .where(eq(posts.id, targetId));
    }
  });

  return true;
}

// Admin report queue (spec §14.1, §20.4). targetCode resolves to the public
// identifier for whichever target type the report points at.
export async function listOpenReports(): Promise<Report[]> {
  const reporter = alias(users, "reporter");
  const targetUser = alias(users, "target_user");

  const rows = await requireDb()
    .select({
      id: reports.id,
      reporter: {
        username: reporter.username,
        displayName: reporter.displayName,
        avatarUrl: reporter.avatarUrl,
      },
      targetType: reports.targetType,
      targetCode: sql<
        string | null
      >`coalesce(${posts.publicCode}, ${comments.publicCode}, ${targetUser.username})`,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(reporter, eq(reports.reporterUserId, reporter.id))
    .leftJoin(posts, and(eq(reports.targetType, "post"), eq(posts.id, reports.targetId)))
    .leftJoin(comments, and(eq(reports.targetType, "comment"), eq(comments.id, reports.targetId)))
    .leftJoin(targetUser, and(eq(reports.targetType, "user"), eq(targetUser.id, reports.targetId)))
    .where(eq(reports.status, "open"))
    .orderBy(desc(reports.createdAt));

  return rows.map((row) => ({
    id: row.id,
    reporter: {
      username: row.reporter.username,
      displayName: row.reporter.displayName,
      avatarUrl: row.reporter.avatarUrl,
    },
    targetType: row.targetType,
    targetCode: row.targetCode ?? "(unavailable)",
    reason: row.reason as Report["reason"],
    details: row.details,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function setReportStatus(
  reportId: string,
  status: "dismissed" | "actioned",
): Promise<boolean> {
  const rows = await requireDb()
    .update(reports)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(reports.id, reportId), eq(reports.status, "open")))
    .returning({ id: reports.id });
  return rows.length > 0;
}
