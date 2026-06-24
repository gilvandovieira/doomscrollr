import { z } from "zod";
import { FeedSortSchema } from "./post.schema.ts";

export const FeedCursorSchema = z.object({
  sort: FeedSortSchema,
  offset: z.number().int().nonnegative(),
  id: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  score: z.number().optional(),
  hotScore: z.number().optional(),
});
