import { comments, posts, reports, users } from "@doomscrollr/database/schema.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import type {
  AdminReportListQuery,
  Report,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  UserStatus,
} from "@doomscrollr/shared/types.ts";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import {
  listModerationNotesForTargets,
  moderationTargetKey,
  type ModerationTargetRef,
} from "./moderation.repository.ts";
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

type AdminReportRow = {
  id: string;
  reporter: Report["reporter"];
  targetType: ReportTargetType;
  targetId: string;
  targetCode: string | null;
  targetUserStatus: UserStatus | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: Date;
};

function mapReportRows(rows: AdminReportRow[], notesByTarget: Map<string, Report["notes"]>) {
  return rows.map((row) => {
    const target: ModerationTargetRef = {
      targetType: row.targetType,
      targetId: row.targetId,
      targetCode: row.targetCode ?? "(unavailable)",
    };
    return {
      id: row.id,
      reporter: row.reporter,
      targetType: row.targetType,
      targetCode: target.targetCode,
      targetUserStatus: row.targetUserStatus,
      reason: row.reason as ReportReason,
      details: row.details,
      status: row.status,
      notes: notesByTarget.get(moderationTargetKey(target)) ?? [],
      createdAt: row.createdAt.toISOString(),
    };
  });
}

async function reportRowsWithFilters(filters: SQL[]): Promise<AdminReportRow[]> {
  const reporter = alias(users, "reporter");
  const targetUser = alias(users, "target_user");

  return await requireDb()
    .select({
      id: reports.id,
      reporter: {
        username: reporter.username,
        displayName: reporter.displayName,
        avatarUrl: reporter.avatarUrl,
      },
      targetType: reports.targetType,
      targetId: reports.targetId,
      targetCode: sql<
        string | null
      >`coalesce(${posts.publicCode}, ${comments.publicCode}, ${targetUser.username})`,
      targetUserStatus: sql<UserStatus | null>`${targetUser.status}`,
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
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(reports.createdAt));
}

// Admin report queue (spec §14.1, §20.4). targetCode resolves to the public
// identifier for whichever target type the report points at.
export async function listOpenReports(): Promise<Report[]> {
  return await listReports({ status: "open", targetType: "all", reason: "all" });
}

export async function listReports(filters: AdminReportListQuery): Promise<Report[]> {
  const where: SQL[] = [];
  if (filters.status !== "all") where.push(eq(reports.status, filters.status));
  if (filters.targetType !== "all") where.push(eq(reports.targetType, filters.targetType));
  if (filters.reason !== "all") where.push(eq(reports.reason, filters.reason));

  const rows = await reportRowsWithFilters(where);
  const targets = rows.map((row) => ({
    targetType: row.targetType,
    targetId: row.targetId,
    targetCode: row.targetCode ?? "(unavailable)",
  }));
  const notesByTarget = await listModerationNotesForTargets(targets);
  return mapReportRows(rows, notesByTarget);
}

export type AdminReportTarget = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetCode: string;
  reason: string;
  status: ReportStatus;
};

export async function getReportsByIds(reportIds: string[]): Promise<AdminReportTarget[]> {
  const uniqueIds = [...new Set(reportIds)];
  if (uniqueIds.length === 0) return [];

  const rows = await reportRowsWithFilters([inArray(reports.id, uniqueIds)]);
  return rows.map((row) => ({
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    targetCode: row.targetCode ?? "(unavailable)",
    reason: row.reason,
    status: row.status,
  }));
}

export async function setReportsStatus(
  reportIds: string[],
  status: "dismissed" | "actioned",
): Promise<string[]> {
  const uniqueIds = [...new Set(reportIds)];
  if (uniqueIds.length === 0) return [];

  const rows = await requireDb()
    .update(reports)
    .set({ status, updatedAt: new Date() })
    .where(and(inArray(reports.id, uniqueIds), eq(reports.status, "open")))
    .returning({ id: reports.id });
  return rows.map((row) => row.id);
}

export async function setReportStatus(
  reportId: string,
  status: "dismissed" | "actioned",
): Promise<boolean> {
  return (await setReportsStatus([reportId], status)).length > 0;
}
