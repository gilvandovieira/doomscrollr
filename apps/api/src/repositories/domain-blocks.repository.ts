import { domainBlocks, users } from "@doomscrollr/database/schema.ts";
import {
  domainMatchesBlock,
  hostnameFromUrl,
  normalizeDomain,
} from "@doomscrollr/shared/lib/domain.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import type { AdminDomainBlock, CreateDomainBlockInput } from "@doomscrollr/shared/types.ts";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

export async function listDomainBlocks(): Promise<AdminDomainBlock[]> {
  const rows = await requireDb()
    .select({
      id: domainBlocks.id,
      domain: domainBlocks.domain,
      reason: domainBlocks.reason,
      createdBy: {
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
      createdAt: domainBlocks.createdAt,
    })
    .from(domainBlocks)
    .innerJoin(users, eq(domainBlocks.createdByUserId, users.id))
    .orderBy(desc(domainBlocks.createdAt), domainBlocks.domain);

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function createDomainBlock(
  input: CreateDomainBlockInput & { actorUserId: string },
): Promise<boolean> {
  const domain = normalizeDomain(input.domain);
  if (!domain) return false;

  const existing = await requireDb()
    .select({ id: domainBlocks.id })
    .from(domainBlocks)
    .where(eq(domainBlocks.domain, domain))
    .limit(1);
  if (existing.length > 0) return false;

  await requireDb().insert(domainBlocks).values({
    id: generateId(),
    domain,
    reason: input.reason ?? null,
    createdByUserId: input.actorUserId,
  });
  return true;
}

export async function deleteDomainBlock(domainInput: string): Promise<boolean> {
  const domain = normalizeDomain(domainInput);
  if (!domain) return false;

  const deleted = await requireDb()
    .delete(domainBlocks)
    .where(eq(domainBlocks.domain, domain))
    .returning({ id: domainBlocks.id });

  return deleted.length > 0;
}

export async function findBlockedDomainForUrl(rawUrl: string): Promise<AdminDomainBlock | null> {
  const hostname = hostnameFromUrl(rawUrl);
  if (!hostname) return null;

  const blocks = await listDomainBlocks();
  return blocks.find((block) => domainMatchesBlock(hostname, block.domain)) ?? null;
}
