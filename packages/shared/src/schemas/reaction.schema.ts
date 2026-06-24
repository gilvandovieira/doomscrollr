import { z } from "zod";

// Reactions are stored as value IN (-1, 1) (spec §8.4). The API also accepts 0
// to clear an existing reaction (update/delete behavior).
export const SetReactionSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

export const ReactionResultSchema = z
  .object({
    value: z.union([z.literal(1), z.literal(-1)]).nullable(),
    score: z.number().int(),
    reactionCount: z.number().int().nonnegative(),
  })
  .strict();
