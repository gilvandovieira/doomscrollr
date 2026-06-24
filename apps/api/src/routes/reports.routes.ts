import { CreateReportSchema } from "@doomscrollr/shared/schemas/report.schema.ts";
import { Hono } from "hono";
import { badRequest } from "../lib/errors.ts";
import { enforceRateLimit, RATE_LIMITS } from "../lib/rate-limit.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { getAuthUser, requireUser } from "../middleware/auth.ts";
import { createReport } from "../repositories/reports.repository.ts";

export const reportsRoutes = new Hono();

// POST /api/reports — report a post, comment, or user (spec §14, §20.3).
reportsRoutes.post("/", requireUser, async (c) => {
  const user = getAuthUser(c);
  await enforceRateLimit(`report:${user.id}`, RATE_LIMITS.report);

  const data = parseOrThrow(CreateReportSchema, await readJsonBody(c));
  const created = await createReport({
    reporterUserId: user.id,
    targetType: data.targetType,
    targetCode: data.targetCode,
    reason: data.reason,
    details: data.details,
  });
  if (!created) throw badRequest("The reported item could not be found.");

  return c.json({ ok: true }, 201);
});
