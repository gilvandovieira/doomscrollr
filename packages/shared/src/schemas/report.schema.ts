import { z } from "zod";
import { REPORT_REASONS } from "../constants.ts";
import { AuthorSchema } from "./user.schema.ts";

export const ReportReasonSchema = z.enum(REPORT_REASONS);
export const ReportTargetTypeSchema = z.enum(["post", "comment", "user"]);
export const ReportStatusSchema = z.enum(["open", "dismissed", "actioned"]);

export const CreateReportSchema = z.object({
  targetType: ReportTargetTypeSchema,
  targetId: z.string().min(1),
  reason: ReportReasonSchema,
  details: z.string().max(1000).optional(),
});

export const ReportSchema = z.object({
  id: z.string().min(1),
  reporter: AuthorSchema,
  targetType: ReportTargetTypeSchema,
  targetId: z.string().min(1),
  reason: ReportReasonSchema,
  details: z.string().nullable(),
  status: ReportStatusSchema,
  createdAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
  reviewedBy: AuthorSchema.nullable(),
});
