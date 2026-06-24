import { z } from "zod";

// Recent feed keyset cursor. The feed orders by created_at DESC, id DESC, so the
// cursor carries the last seen (created_at, id) pair (spec §9).
export const RecentCursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().min(1),
});

export type RecentCursor = z.infer<typeof RecentCursorSchema>;
