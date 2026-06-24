import { z } from "zod";

export const AppEnvSchema = z.enum(["development", "test", "production"]).default("development");

export const ServerEnvSchema = z.object({
  APP_ENV: AppEnvSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z.string().url().optional(),
  // Canonical origin used to build absolute Open Graph URLs for share previews (spec §11.2).
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:8000"),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_AUTHORIZED_PARTIES: z.string().optional(),
  // Optional: v1 only needs the YouTube video id parsed from the URL (spec §12.3).
  YOUTUBE_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).default("debug"),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function readServerEnv(source: Record<string, string | undefined> = Deno.env.toObject()) {
  return ServerEnvSchema.parse(source);
}
