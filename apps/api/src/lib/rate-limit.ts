import { rateLimitBuckets } from "@doomscrollr/database/schema.ts";
import { sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { tooManyRequests } from "./errors.ts";

// Fixed-window rate limiter (spec §16). When a database is configured, buckets are
// stored in Postgres so multiple API processes share the same counters. Local
// in-memory buckets remain the fallback for no-db development/test paths.

type Bucket = { count: number; resetAt: number };
const memoryStore = new Map<string, Bucket>();

export type RateLimitPolicy = { limit: number; windowMs: number };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Suggested starting values from the spec; tune against real abuse.
export const RATE_LIMITS = {
  createPost: { limit: 30, windowMs: DAY },
  createRepost: { limit: 60, windowMs: DAY },
  createQuote: { limit: 30, windowMs: DAY },
  imageCheck: { limit: 60, windowMs: DAY },
  createComment: { limit: 60, windowMs: HOUR },
  mention: { limit: 30, windowMs: HOUR },
  react: { limit: 300, windowMs: HOUR },
  report: { limit: 20, windowMs: DAY },
  block: { limit: 60, windowMs: DAY },
  eventsPerSession: { limit: 120, windowMs: HOUR },
  youtubeLookup: { limit: 60, windowMs: HOUR },
} satisfies Record<string, RateLimitPolicy>;

export async function checkRateLimit(
  key: string,
  policy: RateLimitPolicy,
  cost = 1,
): Promise<boolean> {
  if (cost <= 0) return true;
  if (db) return await checkDatabaseRateLimit(key, policy, cost);
  return checkMemoryRateLimit(key, policy, cost);
}

function checkMemoryRateLimit(key: string, policy: RateLimitPolicy, cost: number): boolean {
  const now = Date.now();
  const bucket = memoryStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    memoryStore.set(key, { count: cost, resetAt: now + policy.windowMs });
    return true;
  }
  if (bucket.count + cost > policy.limit) return false;
  bucket.count += cost;
  return true;
}

async function checkDatabaseRateLimit(
  key: string,
  policy: RateLimitPolicy,
  cost: number,
): Promise<boolean> {
  const resetAt = new Date(Date.now() + policy.windowMs);
  const rows = await db!.insert(rateLimitBuckets)
    .values({
      bucketKey: key,
      count: cost,
      resetAt,
    })
    .onConflictDoUpdate({
      target: rateLimitBuckets.bucketKey,
      set: {
        count: sql<number>`CASE
          WHEN ${rateLimitBuckets.resetAt} <= now() THEN excluded."count"
          ELSE ${rateLimitBuckets.count} + excluded."count"
        END`,
        resetAt: sql<Date>`CASE
          WHEN ${rateLimitBuckets.resetAt} <= now() THEN excluded."reset_at"
          ELSE ${rateLimitBuckets.resetAt}
        END`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: rateLimitBuckets.count });

  return Number(rows[0]?.count ?? policy.limit + 1) <= policy.limit;
}

export async function enforceRateLimit(
  key: string,
  policy: RateLimitPolicy,
  cost = 1,
): Promise<void> {
  if (!(await checkRateLimit(key, policy, cost))) {
    throw tooManyRequests();
  }
}
