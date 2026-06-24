import type { Context } from "hono";
import {
  AdminReportListQuerySchema,
  BulkReportActionSchema,
  CreateDomainBlockSchema,
  CreateModerationNoteSchema,
  SetUserModerationStatusSchema,
  SetUserTrustLevelSchema,
} from "@doomscrollr/shared/schemas/report.schema.ts";
import { normalizeDomain } from "@doomscrollr/shared/lib/domain.ts";
import {
  CreateAdminTagSchema,
  CreateTagAliasSchema,
  MergeTagSchema,
  TagSlugSchema,
} from "@doomscrollr/shared/schemas/tag.schema.ts";
import { Hono } from "hono";
import { badRequest, conflict, notFound } from "../lib/errors.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { getAuthUser, requireAdmin, requireUser } from "../middleware/auth.ts";
import {
  getCommentNotificationRefByCode,
  removeCommentByCode,
  restoreCommentByCode,
} from "../repositories/comments.repository.ts";
import { createNotification } from "../repositories/notifications.repository.ts";
import {
  createDomainBlock,
  deleteDomainBlock,
  listDomainBlocks,
} from "../repositories/domain-blocks.repository.ts";
import {
  createModerationNote,
  listModerationAuditEvents,
  listModerationNotes,
  recordModerationAuditEvent,
} from "../repositories/moderation.repository.ts";
import {
  getPostModerationTargetByCode,
  removePostByCode,
  restorePostByCode,
} from "../repositories/posts.repository.ts";
import {
  getReportsByIds,
  listReports,
  setReportsStatus,
  setReportStatus,
} from "../repositories/reports.repository.ts";
import {
  addTagAlias,
  createAdminTag,
  listAdminTags,
  mergeTagInto,
  setTagStatus,
} from "../repositories/tags.repository.ts";
import {
  getUserModerationTargetByUsername,
  setUserStatusByUsername,
  setUserTrustLevelByUsername,
} from "../repositories/users.repository.ts";

export const adminRoutes = new Hono();

// All admin routes require an authenticated admin (spec §14.1, §20.4).
adminRoutes.use("*", requireUser, requireAdmin);

const DEFAULT_REASON = "Removed by moderator.";

async function readReason(c: Context): Promise<string> {
  try {
    const body = await c.req.json() as { reason?: unknown };
    return typeof body?.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : DEFAULT_REASON;
  } catch {
    return DEFAULT_REASON;
  }
}

adminRoutes.get("/reports", async (c) => {
  const query = parseOrThrow(AdminReportListQuerySchema, {
    status: c.req.query("status") ?? undefined,
    targetType: c.req.query("targetType") ?? undefined,
    reason: c.req.query("reason") ?? undefined,
  });
  return c.json({ items: await listReports(query) });
});

adminRoutes.get("/moderation/audit", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? 30);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 30;
  return c.json({ items: await listModerationAuditEvents(limit) });
});

adminRoutes.get("/moderation/domain-blocks", async (c) => {
  return c.json({ items: await listDomainBlocks() });
});

adminRoutes.post("/moderation/domain-blocks", async (c) => {
  const admin = getAuthUser(c);
  const input = parseOrThrow(CreateDomainBlockSchema, await readJsonBody(c));
  const ok = await createDomainBlock({ ...input, actorUserId: admin.id });
  if (!ok) throw conflict("DOMAIN_BLOCK_EXISTS", "That domain is already blocked.");
  return c.json({ ok: true }, 201);
});

adminRoutes.delete("/moderation/domain-blocks/:domain", async (c) => {
  const domain = normalizeDomain(c.req.param("domain"));
  if (!domain) throw badRequest("Enter a valid blocked domain.");
  const ok = await deleteDomainBlock(domain);
  if (!ok) throw notFound("Domain block not found.");
  return c.body(null, 204);
});

adminRoutes.get("/moderation/notes", async (c) => {
  const query = parseOrThrow(
    CreateModerationNoteSchema.pick({
      targetType: true,
      targetCode: true,
    }),
    {
      targetType: c.req.query("targetType"),
      targetCode: c.req.query("targetCode"),
    },
  );
  const notes = await listModerationNotes(query.targetType, query.targetCode);
  if (!notes) throw notFound("Target not found.");
  return c.json({ items: notes });
});

adminRoutes.post("/moderation/notes", async (c) => {
  const admin = getAuthUser(c);
  const input = parseOrThrow(CreateModerationNoteSchema, await readJsonBody(c));
  const note = await createModerationNote({
    actorUserId: admin.id,
    targetType: input.targetType,
    targetCode: input.targetCode,
    bodyText: input.bodyText,
  });
  if (!note) throw notFound("Target not found.");
  return c.json(note, 201);
});

adminRoutes.get("/tags", async (c) => c.json({ items: await listAdminTags() }));

adminRoutes.post("/tags", async (c) => {
  const input = parseOrThrow(CreateAdminTagSchema, await readJsonBody(c));
  const ok = await createAdminTag(input);
  if (!ok) throw conflict("TAG_SLUG_TAKEN", "That tag or alias already exists.");
  return c.json({ ok: true }, 201);
});

adminRoutes.post("/tags/:tagSlug/enable", async (c) => {
  const tagSlug = parseOrThrow(TagSlugSchema, c.req.param("tagSlug"));
  const ok = await setTagStatus(tagSlug, "active");
  if (!ok) throw notFound("Tag not found.");
  return c.json({ ok: true });
});

adminRoutes.post("/tags/:tagSlug/disable", async (c) => {
  const tagSlug = parseOrThrow(TagSlugSchema, c.req.param("tagSlug"));
  const ok = await setTagStatus(tagSlug, "disabled");
  if (!ok) throw notFound("Tag not found.");
  return c.json({ ok: true });
});

adminRoutes.post("/tags/:tagSlug/aliases", async (c) => {
  const tagSlug = parseOrThrow(TagSlugSchema, c.req.param("tagSlug"));
  const { aliasSlug } = parseOrThrow(CreateTagAliasSchema, await readJsonBody(c));
  const ok = await addTagAlias(tagSlug, aliasSlug);
  if (!ok) throw badRequest("Alias could not be added.");
  return c.json({ ok: true }, 201);
});

adminRoutes.post("/tags/:tagSlug/merge", async (c) => {
  const tagSlug = parseOrThrow(TagSlugSchema, c.req.param("tagSlug"));
  const { targetSlug } = parseOrThrow(MergeTagSchema, await readJsonBody(c));
  const ok = await mergeTagInto(tagSlug, targetSlug);
  if (!ok) throw badRequest("Tags could not be merged.");
  return c.json({ ok: true });
});

adminRoutes.post("/posts/:postCode/remove", async (c) => {
  const admin = getAuthUser(c);
  const postCode = c.req.param("postCode");
  const reason = await readReason(c);
  const target = await getPostModerationTargetByCode(postCode);
  const ok = await removePostByCode(postCode, admin.id, reason);
  if (!ok) throw notFound("Post not found or already removed.");
  if (target) {
    await recordModerationAuditEvent({
      actorUserId: admin.id,
      action: "post_removed",
      targetType: "post",
      targetId: target.id,
      targetCode: target.publicCode,
      reason,
    });
  }
  if (target && target.authorId !== admin.id) {
    await createNotification({
      recipientUserId: target.authorId,
      type: "moderation_outcome",
      postId: target.id,
      metadata: { targetType: "post", action: "removed", reason },
    });
  }
  return c.json({ ok: true });
});

adminRoutes.post("/posts/:postCode/restore", async (c) => {
  const admin = getAuthUser(c);
  const postCode = c.req.param("postCode");
  const target = await getPostModerationTargetByCode(postCode);
  const ok = await restorePostByCode(postCode);
  if (!ok) throw notFound("Post not found or not removed.");
  if (target) {
    await recordModerationAuditEvent({
      actorUserId: admin.id,
      action: "post_restored",
      targetType: "post",
      targetId: target.id,
      targetCode: target.publicCode,
    });
  }
  if (target && target.authorId !== admin.id) {
    await createNotification({
      recipientUserId: target.authorId,
      type: "moderation_outcome",
      postId: target.id,
      metadata: { targetType: "post", action: "restored" },
    });
  }
  return c.json({ ok: true });
});

adminRoutes.post("/comments/:commentCode/remove", async (c) => {
  const admin = getAuthUser(c);
  const commentCode = c.req.param("commentCode");
  const reason = await readReason(c);
  const target = await getCommentNotificationRefByCode(commentCode);
  const ok = await removeCommentByCode(commentCode, admin.id, reason);
  if (!ok) throw notFound("Comment not found or already removed.");
  if (target) {
    await recordModerationAuditEvent({
      actorUserId: admin.id,
      action: "comment_removed",
      targetType: "comment",
      targetId: target.id,
      targetCode: target.publicCode,
      reason,
    });
  }
  if (target && target.authorId !== admin.id) {
    await createNotification({
      recipientUserId: target.authorId,
      type: "moderation_outcome",
      postId: target.postId,
      commentId: target.id,
      metadata: { targetType: "comment", action: "removed", reason },
    });
  }
  return c.json({ ok: true });
});

adminRoutes.post("/comments/:commentCode/restore", async (c) => {
  const admin = getAuthUser(c);
  const commentCode = c.req.param("commentCode");
  const target = await getCommentNotificationRefByCode(commentCode);
  const ok = await restoreCommentByCode(commentCode);
  if (!ok) throw notFound("Comment not found or not removed.");
  if (target) {
    await recordModerationAuditEvent({
      actorUserId: admin.id,
      action: "comment_restored",
      targetType: "comment",
      targetId: target.id,
      targetCode: target.publicCode,
    });
  }
  if (target && target.authorId !== admin.id) {
    await createNotification({
      recipientUserId: target.authorId,
      type: "moderation_outcome",
      postId: target.postId,
      commentId: target.id,
      metadata: { targetType: "comment", action: "restored" },
    });
  }
  return c.json({ ok: true });
});

adminRoutes.post("/reports/bulk", async (c) => {
  const admin = getAuthUser(c);
  const input = parseOrThrow(BulkReportActionSchema, await readJsonBody(c));
  const reports = await getReportsByIds(input.reportIds);
  const reportById = new Map(reports.map((report) => [report.id, report]));
  const changedIds = await setReportsStatus(input.reportIds, input.status);
  if (changedIds.length === 0) throw notFound("No open reports matched that action.");

  const note = input.note?.trim();
  for (const reportId of changedIds) {
    const report = reportById.get(reportId);
    if (!report) continue;
    await recordModerationAuditEvent({
      actorUserId: admin.id,
      action: input.status === "dismissed" ? "report_dismissed" : "report_actioned",
      targetType: report.targetType,
      targetId: report.targetId,
      targetCode: report.targetCode,
      reportId: report.id,
      reason: report.reason,
      metadata: { bulk: true },
    });
    if (note) {
      await createModerationNote({
        actorUserId: admin.id,
        targetType: report.targetType,
        targetCode: report.targetCode,
        bodyText: note,
      });
    }
  }

  return c.json({ ok: true, count: changedIds.length });
});

adminRoutes.post("/reports/:reportId/dismiss", async (c) => {
  const admin = getAuthUser(c);
  const reportId = c.req.param("reportId");
  const report = (await getReportsByIds([reportId]))[0];
  const ok = await setReportStatus(reportId, "dismissed");
  if (!ok) throw notFound("Report not found or already resolved.");
  if (report) {
    await recordModerationAuditEvent({
      actorUserId: admin.id,
      action: "report_dismissed",
      targetType: report.targetType,
      targetId: report.targetId,
      targetCode: report.targetCode,
      reportId: report.id,
      reason: report.reason,
    });
  }
  return c.json({ ok: true });
});

adminRoutes.post("/reports/:reportId/action", async (c) => {
  const admin = getAuthUser(c);
  const reportId = c.req.param("reportId");
  const report = (await getReportsByIds([reportId]))[0];
  const ok = await setReportStatus(reportId, "actioned");
  if (!ok) throw notFound("Report not found or already resolved.");
  if (report) {
    await recordModerationAuditEvent({
      actorUserId: admin.id,
      action: "report_actioned",
      targetType: report.targetType,
      targetId: report.targetId,
      targetCode: report.targetCode,
      reportId: report.id,
      reason: report.reason,
    });
  }
  return c.json({ ok: true });
});

adminRoutes.post("/users/:username/status", async (c) => {
  const admin = getAuthUser(c);
  const username = c.req.param("username").replace(/^@/, "").toLowerCase();
  const input = parseOrThrow(SetUserModerationStatusSchema, await readJsonBody(c));
  const targetBefore = await getUserModerationTargetByUsername(username);
  if (!targetBefore) throw notFound("User not found.");
  if (targetBefore.id === admin.id && (input.status === "suspended" || input.status === "banned")) {
    throw badRequest("Admins cannot suspend or ban their own account.");
  }

  const target = await setUserStatusByUsername(username, input.status);
  if (!target) throw notFound("User not found.");
  await recordModerationAuditEvent({
    actorUserId: admin.id,
    action: "user_status_changed",
    targetType: "user",
    targetId: target.id,
    targetCode: target.username,
    reason: input.reason ?? null,
    metadata: { previousStatus: targetBefore.status, status: target.status },
  });

  return c.json({ ok: true });
});

adminRoutes.post("/users/:username/trust-level", async (c) => {
  const admin = getAuthUser(c);
  const username = c.req.param("username").replace(/^@/, "").toLowerCase();
  const input = parseOrThrow(SetUserTrustLevelSchema, await readJsonBody(c));
  const targetBefore = await getUserModerationTargetByUsername(username);
  if (!targetBefore) throw notFound("User not found.");
  if (
    targetBefore.id === admin.id &&
    targetBefore.role === "admin" &&
    input.trustLevel !== "admin"
  ) {
    throw badRequest("Admins cannot demote their own admin trust level.");
  }

  const target = await setUserTrustLevelByUsername(username, input.trustLevel);
  if (!target) throw notFound("User not found.");
  await recordModerationAuditEvent({
    actorUserId: admin.id,
    action: "user_trust_level_changed",
    targetType: "user",
    targetId: target.id,
    targetCode: target.username,
    reason: input.reason ?? null,
    metadata: {
      previousTrustLevel: targetBefore.trustLevel,
      trustLevel: target.trustLevel,
      previousRole: targetBefore.role,
      role: target.role,
    },
  });

  return c.json({ ok: true });
});
