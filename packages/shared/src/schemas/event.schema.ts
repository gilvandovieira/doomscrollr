import { z } from "zod";
import { CLIENT_EVENT_TYPES } from "../constants.ts";

// Only client-observable events may be submitted to POST /api/events.
// comment_created and reaction_created are server-emitted and must be rejected (spec §10.2).
export const ClientEventTypeSchema = z.enum(CLIENT_EVENT_TYPES);

export const CreateEventSchema = z.object({
  eventType: ClientEventTypeSchema,
  postCode: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
