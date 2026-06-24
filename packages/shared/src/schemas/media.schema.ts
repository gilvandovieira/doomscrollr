import { z } from "zod";

export const MediaProviderSchema = z.enum(["upload", "youtube", "giphy", "tenor"]);

export const MediaTypeSchema = z.enum(["image", "gif", "video", "short"]);

export const AspectRatioSchema = z.enum(["square", "landscape", "portrait", "unknown"]);

export const CreatePostSourceSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("upload"),
    uploadId: z.string().min(1),
    mediaType: z.enum(["image", "gif", "video"]),
  }),
  z.object({
    provider: z.literal("youtube"),
    url: z.string().url(),
  }),
  z.object({
    provider: z.literal("giphy"),
    providerMediaId: z.string().min(1),
  }),
  z.object({
    provider: z.literal("tenor"),
    providerMediaId: z.string().min(1),
  }),
]);

export const MediaAssetSchema = z.object({
  id: z.string().min(1),
  provider: MediaProviderSchema,
  mediaType: MediaTypeSchema,
  providerMediaId: z.string().nullable(),
  originalUrl: z.string().url().nullable(),
  embedUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url(),
  previewUrl: z.string().url().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().positive().nullable(),
  aspectRatio: AspectRatioSchema,
  attributionLabel: z.string().nullable(),
  attributionUrl: z.string().url().nullable(),
  status: z.enum(["ready", "pending_review", "blocked"]).default("ready"),
});
