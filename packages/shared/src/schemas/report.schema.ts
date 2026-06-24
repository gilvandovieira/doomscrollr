import { z } from "zod";
import { REPORT_REASONS } from "../constants.ts";
import { AuthorSchema } from "./user.schema.ts";

export const ReportReasonSchema = z.enum(REPORT_REASONS);
export const ReportTargetTypeSchema = z.enum(["post", "comment", "user"]);
export const ReportStatusSchema = z.enum(["open", "dismissed", "actioned"]);

// Targets are addressed by their public code / username, never internal ids (spec §6).
// targetCode is a postCode, commentCode, or username depending on targetType.
export const CreateReportSchema = z.object({
  targetType: ReportTargetTypeSchema,
  targetCode: z.string().min(1),
  reason: ReportReasonSchema,
  details: z.string().max(1000).optional(),
});

// Admin-facing report view (spec §14, §20.4). Exposed only on admin routes.
export const ReportSchema = z
  .object({
    id: z.string().min(1),
    reporter: AuthorSchema,
    targetType: ReportTargetTypeSchema,
    targetCode: z.string().min(1),
    reason: ReportReasonSchema,
    details: z.string().nullable(),
    status: ReportStatusSchema,
    createdAt: z.string().datetime(),
  })
  .strict();
