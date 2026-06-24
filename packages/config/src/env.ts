import { z } from "zod";

export const AppEnvSchema = z.enum(["development", "test", "production"]).default("development");

const LogLevelSchema = z.enum(["debug", "info", "warn", "error", "fatal"]);
const OptionalUrlSchema = z.string().trim().url().optional();

function emptyStringToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.pathname === "/" && url.search === "" && url.hash === "";
  } catch {
    return false;
  }
}

function isOriginList(value: string): boolean {
  if (value.trim() === "") return true;
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 && origins.every(isOrigin);
}

const OptionalOriginSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().url().refine(isOrigin, {
    message: "Must be an origin without a path, query, or fragment.",
  }).optional(),
);

const RawServerEnvSchema = z.object({
  APP_ENV: AppEnvSchema,
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: OptionalUrlSchema,
  // Canonical origin used to build absolute Open Graph URLs for share previews (spec §11.2).
  PUBLIC_BASE_URL: OptionalUrlSchema,
  // Browser origin for the interactive SPA. Required in production so CORS and
  // post-page links are explicit instead of inferred from localhost defaults.
  WEB_ORIGIN: OptionalOriginSchema,
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_AUTHORIZED_PARTIES: z.string().trim().refine(isOriginList, {
    message: "Must be a comma-separated list of origins.",
  }).optional(),
  // Optional: v1 only needs the YouTube video id parsed from the URL (spec §12.3).
  YOUTUBE_API_KEY: z.string().optional(),
  LOG_LEVEL: LogLevelSchema.optional(),
  ENABLE_MOCK_FALLBACK: z.enum(["0", "1"]).default("0"),
});

function isLocalhostUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const normalized = hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname.endsWith(".")
      ? hostname.slice(0, -1)
      : hostname;
    return normalized === "localhost" ||
      normalized.endsWith(".localhost") ||
      normalized === "127.0.0.1" ||
      normalized.startsWith("127.") ||
      normalized === "::1" ||
      normalized === "0.0.0.0";
  } catch {
    return false;
  }
}

function addRequiredIssue(
  ctx: z.RefinementCtx,
  path: keyof z.infer<typeof RawServerEnvSchema>,
  message: string,
) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
}

export const ServerEnvSchema = RawServerEnvSchema
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "production") return;

    if (!env.DATABASE_URL) {
      addRequiredIssue(ctx, "DATABASE_URL", "DATABASE_URL is required in production.");
    }
    if (!env.CLERK_SECRET_KEY?.trim()) {
      addRequiredIssue(ctx, "CLERK_SECRET_KEY", "CLERK_SECRET_KEY is required in production.");
    }
    if (!env.CLERK_AUTHORIZED_PARTIES) {
      addRequiredIssue(
        ctx,
        "CLERK_AUTHORIZED_PARTIES",
        "CLERK_AUTHORIZED_PARTIES is required in production when Clerk auth is enabled.",
      );
    }
    if (!env.PUBLIC_BASE_URL) {
      addRequiredIssue(ctx, "PUBLIC_BASE_URL", "PUBLIC_BASE_URL is required in production.");
    } else if (isLocalhostUrl(env.PUBLIC_BASE_URL)) {
      addRequiredIssue(
        ctx,
        "PUBLIC_BASE_URL",
        "PUBLIC_BASE_URL must not point to localhost in production.",
      );
    }
    if (!env.WEB_ORIGIN) {
      addRequiredIssue(ctx, "WEB_ORIGIN", "WEB_ORIGIN is required in production.");
    } else if (isLocalhostUrl(env.WEB_ORIGIN)) {
      addRequiredIssue(ctx, "WEB_ORIGIN", "WEB_ORIGIN must not point to localhost in production.");
    }
    if (env.LOG_LEVEL === "debug") {
      addRequiredIssue(ctx, "LOG_LEVEL", "LOG_LEVEL must be info or stricter in production.");
    }
    if (env.ENABLE_MOCK_FALLBACK === "1") {
      addRequiredIssue(
        ctx,
        "ENABLE_MOCK_FALLBACK",
        "ENABLE_MOCK_FALLBACK must not be enabled in production.",
      );
    }
  })
  .transform((env) => ({
    ...env,
    PUBLIC_BASE_URL: env.PUBLIC_BASE_URL ?? "http://localhost:8000",
    WEB_ORIGIN: env.WEB_ORIGIN ??
      (env.APP_ENV === "production" ? env.PUBLIC_BASE_URL! : "http://localhost:5173"),
    LOG_LEVEL: env.LOG_LEVEL ?? (env.APP_ENV === "production" ? "info" : "debug"),
  }));

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function readServerEnv(source: Record<string, string | undefined> = Deno.env.toObject()) {
  return ServerEnvSchema.parse(source);
}
