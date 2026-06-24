import { createClerkClient } from "@clerk/backend";
import { logger } from "./logger.ts";

export type ClerkUserInfo = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

const EMPTY: ClerkUserInfo = { username: null, displayName: null, avatarUrl: null };

// Best-effort fetch of Clerk profile fields used to seed a local user (spec §17).
// Returns nulls on any failure so onboarding never hard-depends on this call.
export async function fetchClerkUser(clerkUserId: string): Promise<ClerkUserInfo> {
  const secretKey = Deno.env.get("CLERK_SECRET_KEY");
  if (!secretKey) return EMPTY;

  try {
    const client = createClerkClient({ secretKey });
    const user = await client.users.getUser(clerkUserId);
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return {
      username: user.username ?? null,
      displayName: fullName || user.username || null,
      avatarUrl: user.imageUrl ?? null,
    };
  } catch (error) {
    logger.warn({
      event: "clerk_user_fetch_failed",
      message: error instanceof Error ? error.message : "unknown",
    });
    return EMPTY;
  }
}
