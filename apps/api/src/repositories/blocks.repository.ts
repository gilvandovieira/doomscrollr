import { userBlocks } from "@doomscrollr/database/schema.ts";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

export async function blockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  await requireDb()
    .insert(userBlocks)
    .values({ blockerUserId, blockedUserId })
    .onConflictDoNothing();
}

export async function unblockUser(blockerUserId: string, blockedUserId: string): Promise<void> {
  await requireDb()
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerUserId, blockerUserId),
        eq(userBlocks.blockedUserId, blockedUserId),
      ),
    );
}

// True when `blockerUserId` has blocked `blockedUserId`.
export async function isBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean> {
  const rows = await requireDb()
    .select({ blockerUserId: userBlocks.blockerUserId })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerUserId, blockerUserId),
        eq(userBlocks.blockedUserId, blockedUserId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
