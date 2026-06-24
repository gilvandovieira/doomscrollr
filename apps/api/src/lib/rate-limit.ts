import { tooManyRequests } from "./errors.ts";

// Simple in-memory fixed-window rate limiter (spec §16). Hardcoded policies for v1;
// the interface is intentionally narrow so it can be backed by Redis later without
// touching call sites.

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateLimitPolicy = { limit: number; windowMs: number };

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Suggested starting values from the spec; tune against real abuse.
export const RATE_LIMITS = {
  createPost: { limit: 30, windowMs: DAY },
  imageCheck: { limit: 60, windowMs: DAY },
  createComment: { limit: 60, windowMs: HOUR },
  react: { limit: 300, windowMs: HOUR },
  report: { limit: 20, windowMs: DAY },
  block: { limit: 60, windowMs: DAY },
  eventsPerSession: { limit: 120, windowMs: HOUR },
} satisfies Record<string, RateLimitPolicy>;

export function checkRateLimit(key: string, policy: RateLimitPolicy): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + policy.windowMs });
    return true;
  }
  if (bucket.count >= policy.limit) return false;
  bucket.count += 1;
  return true;
}

export function enforceRateLimit(key: string, policy: RateLimitPolicy): void {
  if (!checkRateLimit(key, policy)) {
    throw tooManyRequests();
  }
}
