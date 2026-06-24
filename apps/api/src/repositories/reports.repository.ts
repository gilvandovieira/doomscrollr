import { reports, users } from "@doomscrollr/database/schema.ts";
import type { Report } from "@doomscrollr/shared/types.ts";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { type ReportRow, toReport } from "./transformers.ts";

export async function listOpenReports(): Promise<Report[]> {
  if (!db) {
    throw new Error("Database is not configured.");
  }

  const rows = await db
    .select({
      id: reports.id,
      reporter: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      details: reports.details,
      status: reports.status,
      createdAt: reports.createdAt,
      reviewedAt: reports.reviewedAt,
      reviewedBy: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(reports)
    .innerJoin(users, eq(reports.reporterId, users.id))
    .where(eq(reports.status, "open"))
    .orderBy(desc(reports.createdAt));

  return (rows as ReportRow[]).map((row) => toReport({ ...row, reviewedBy: null }));
}
