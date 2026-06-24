import { CreateReportSchema } from "@doomscrollr/shared/schemas/report.schema.ts";
import { Hono } from "hono";
import { notImplemented } from "../lib/errors.ts";
import { parseOrThrow, readJsonBody } from "../lib/validation.ts";
import { requireAuth } from "../middleware/auth.ts";

export const reportsRoutes = new Hono();

reportsRoutes.post("/", requireAuth, async (c) => {
  parseOrThrow(CreateReportSchema, await readJsonBody(c));
  throw notImplemented("Report creation will persist reporter, target, reason, and review status.");
});
