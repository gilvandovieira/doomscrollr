import { z } from "zod";
import { REPORT_REASONS } from "../constants.ts";
import { normalizeDomain } from "../lib/domain.ts";
import { AuthorSchema, UserStatusSchema, UserTrustLevelSchema } from "./user.schema.ts";

export const ReportReasonSchema = z.enum(REPORT_REASONS);
export const ReportTargetTypeSchema = z.enum(["post", "comment", "user"]);
export const ReportStatusSchema = z.enum(["open", "dismissed", "actioned"]);
export const AdminReportStatusFilterSchema = z.enum(["open", "dismissed", "actioned", "all"]);
export const AdminReportTargetFilterSchema = z.enum(["post", "comment", "user", "all"]);
export const AdminReportReasonFilterSchema = z.union([ReportReasonSchema, z.literal("all")]);
export const ModerationAuditActionSchema = z.enum([
  "post_removed",
  "post_restored",
  "comment_removed",
  "comment_restored",
  "report_dismissed",
  "report_actioned",
  "note_created",
  "user_status_changed",
  "user_trust_level_changed",
]);

// Targets are addressed by their public code / username, never internal ids (spec §6).
// targetCode is a postCode, commentCode, or username depending on targetType.
export const CreateReportSchema = z.object({
  targetType: ReportTargetTypeSchema,
  targetCode: z.string().min(1),
  reason: ReportReasonSchema,
  details: z.string().max(1000).optional(),
});

export const AdminReportListQuerySchema = z
  .object({
    status: AdminReportStatusFilterSchema.default("open"),
    targetType: AdminReportTargetFilterSchema.default("all"),
    reason: AdminReportReasonFilterSchema.default("all"),
  })
  .strict();

export const CreateModerationNoteSchema = z
  .object({
    targetType: ReportTargetTypeSchema,
    targetCode: z.string().min(1),
    bodyText: z.string().trim().min(1).max(1000),
  })
  .strict();

export const BulkReportActionSchema = z
  .object({
    reportIds: z.array(z.string().min(1)).min(1).max(50),
    status: z.enum(["dismissed", "actioned"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export const SetUserModerationStatusSchema = z
  .object({
    status: UserStatusSchema,
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const SetUserTrustLevelSchema = z
  .object({
    trustLevel: UserTrustLevelSchema,
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

const DomainNameSchema = z.string().transform((value, ctx) => {
  const domain = normalizeDomain(value);
  if (!domain) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid domain, without wildcards or paths.",
    });
    return z.NEVER;
  }
  return domain;
});

const DomainBlockReasonSchema = z.string().trim().max(160).optional().transform((value) =>
  value && value.length > 0 ? value : null
);

export const CreateDomainBlockSchema = z
  .object({
    domain: DomainNameSchema,
    reason: DomainBlockReasonSchema,
  })
  .strict();

export const ModerationNoteSchema = z
  .object({
    id: z.string().min(1),
    targetType: ReportTargetTypeSchema,
    targetCode: z.string().min(1),
    bodyText: z.string().min(1),
    author: AuthorSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

export const ModerationAuditEventSchema = z
  .object({
    id: z.string().min(1),
    actor: AuthorSchema,
    action: ModerationAuditActionSchema,
    targetType: ReportTargetTypeSchema,
    targetCode: z.string().min(1),
    reportId: z.string().min(1).nullable(),
    reason: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
    createdAt: z.string().datetime(),
  })
  .strict();

export const AdminDomainBlockSchema = z
  .object({
    id: z.string().min(1),
    domain: z.string().min(1),
    reason: z.string().nullable(),
    createdBy: AuthorSchema,
    createdAt: z.string().datetime(),
  })
  .strict();

// Admin-facing report view (spec §14, §20.4). Exposed only on admin routes.
export const ReportSchema = z
  .object({
    id: z.string().min(1),
    reporter: AuthorSchema,
    reporterTrustLevel: UserTrustLevelSchema,
    reviewPriority: z.number().int().min(0),
    targetType: ReportTargetTypeSchema,
    targetCode: z.string().min(1),
    targetUserStatus: UserStatusSchema.nullable(),
    targetUserTrustLevel: UserTrustLevelSchema.nullable(),
    reason: ReportReasonSchema,
    details: z.string().nullable(),
    status: ReportStatusSchema,
    notes: z.array(ModerationNoteSchema),
    createdAt: z.string().datetime(),
  })
  .strict();

export const AdminReportListResponseSchema = z
  .object({ items: z.array(ReportSchema) })
  .strict();

export const AdminDomainBlockListResponseSchema = z
  .object({ items: z.array(AdminDomainBlockSchema) })
  .strict();

export const ModerationAuditListResponseSchema = z
  .object({ items: z.array(ModerationAuditEventSchema) })
  .strict();
