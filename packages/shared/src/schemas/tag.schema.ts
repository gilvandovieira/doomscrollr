import { z } from "zod";
import { TAG_SLUG_REGEX } from "../constants.ts";

export const TagSlugSchema = z.string().regex(TAG_SLUG_REGEX);

export const TagStatusSchema = z.enum(["active", "disabled", "blocked"]);

const TagDisplayNameSchema = z.string().trim().min(1).max(48);
const TagDescriptionSchema = z.string().trim().max(160).nullable().default(null);

export const TagSchema = z
  .object({
    slug: TagSlugSchema,
    displayName: z.string().min(1),
    description: z.string().nullable(),
    postCount: z.number().int().nonnegative(),
  })
  .strict();

export const TagListResponseSchema = z
  .object({
    items: z.array(TagSchema),
  })
  .strict();

export const TagDetailResponseSchema = z
  .object({
    tag: TagSchema,
    requestedSlug: TagSlugSchema,
    canonicalSlug: TagSlugSchema,
  })
  .strict();

export const AdminTagSchema = TagSchema.extend({
  status: TagStatusSchema,
  aliases: z.array(TagSlugSchema),
}).strict();

export const AdminTagListResponseSchema = z
  .object({
    items: z.array(AdminTagSchema),
  })
  .strict();

export const CreateAdminTagSchema = z
  .object({
    slug: TagSlugSchema,
    displayName: TagDisplayNameSchema,
    description: TagDescriptionSchema,
  })
  .strict();

export const CreateTagAliasSchema = z
  .object({
    aliasSlug: TagSlugSchema,
  })
  .strict();

export const MergeTagSchema = z
  .object({
    targetSlug: TagSlugSchema,
  })
  .strict();
