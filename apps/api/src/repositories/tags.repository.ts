import { postTags, tagAliases, tags } from "@doomscrollr/database/schema.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import type { AdminTag, CreateAdminTagInput, Tag } from "@doomscrollr/shared/types.ts";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.ts";

function requireDb() {
  if (!db) throw new Error("Database is not configured.");
  return db;
}

const publicTagColumns = {
  slug: tags.slug,
  displayName: tags.displayName,
  description: tags.description,
  postCount: tags.postCount,
};

type TagWithId = Tag & { id: string };
type TagIdentity = { id: string; slug: string; status: string };

export async function listActiveTags(): Promise<Tag[]> {
  const rows = await requireDb()
    .select(publicTagColumns)
    .from(tags)
    .where(eq(tags.status, "active"))
    .orderBy(desc(tags.postCount), tags.displayName);

  return rows.map((row) => ({
    slug: row.slug,
    displayName: row.displayName,
    description: row.description,
    postCount: row.postCount,
  }));
}

export async function listAdminTags(): Promise<AdminTag[]> {
  const tagRows = await requireDb()
    .select({ ...publicTagColumns, status: tags.status })
    .from(tags)
    .orderBy(desc(tags.postCount), tags.displayName);
  const aliasRows = await requireDb()
    .select({ aliasSlug: tagAliases.aliasSlug, targetSlug: tags.slug })
    .from(tagAliases)
    .innerJoin(tags, eq(tagAliases.targetTagId, tags.id))
    .orderBy(tagAliases.aliasSlug);

  const aliasesByTarget = new Map<string, string[]>();
  for (const row of aliasRows) {
    aliasesByTarget.set(row.targetSlug, [
      ...(aliasesByTarget.get(row.targetSlug) ?? []),
      row.aliasSlug,
    ]);
  }

  return tagRows.map((row) => ({
    slug: row.slug,
    displayName: row.displayName,
    description: row.description,
    status: row.status as AdminTag["status"],
    postCount: row.postCount,
    aliases: aliasesByTarget.get(row.slug) ?? [],
  }));
}

export async function getActiveTagBySlugOrAlias(slug: string): Promise<TagWithId | null> {
  const direct = await requireDb()
    .select({ id: tags.id, ...publicTagColumns })
    .from(tags)
    .where(and(eq(tags.slug, slug), eq(tags.status, "active")))
    .limit(1);
  if (direct[0]) return direct[0];

  const aliases = await requireDb()
    .select({ id: tags.id, ...publicTagColumns })
    .from(tagAliases)
    .innerJoin(tags, eq(tagAliases.targetTagId, tags.id))
    .where(and(eq(tagAliases.aliasSlug, slug), eq(tags.status, "active")))
    .limit(1);

  return aliases[0] ?? null;
}

export async function resolveActiveTagsBySlugsOrAliases(
  slugs: string[],
): Promise<{ tags: { id: string; slug: string }[]; invalidSlugs: string[] }> {
  const requested = [...new Set(slugs)];
  if (requested.length === 0) return { tags: [], invalidSlugs: [] };

  const matches = new Map<string, { id: string; slug: string }>();
  const direct = await requireDb()
    .select({ id: tags.id, slug: tags.slug })
    .from(tags)
    .where(and(inArray(tags.slug, requested), eq(tags.status, "active")));

  for (const row of direct) {
    matches.set(row.slug, row);
  }

  const unresolved = requested.filter((slug) => !matches.has(slug));
  if (unresolved.length > 0) {
    const aliases = await requireDb()
      .select({ requestedSlug: tagAliases.aliasSlug, id: tags.id, slug: tags.slug })
      .from(tagAliases)
      .innerJoin(tags, eq(tagAliases.targetTagId, tags.id))
      .where(and(inArray(tagAliases.aliasSlug, unresolved), eq(tags.status, "active")));

    for (const row of aliases) {
      matches.set(row.requestedSlug, { id: row.id, slug: row.slug });
    }
  }

  const uniqueTags = new Map<string, { id: string; slug: string }>();
  const invalidSlugs: string[] = [];
  for (const slug of requested) {
    const match = matches.get(slug);
    if (!match) {
      invalidSlugs.push(slug);
      continue;
    }
    uniqueTags.set(match.id, match);
  }

  return { tags: [...uniqueTags.values()], invalidSlugs };
}

export async function createAdminTag(input: CreateAdminTagInput): Promise<boolean> {
  if (!await isSlugAvailable(input.slug)) return false;

  await requireDb().insert(tags).values({
    id: generateId(),
    slug: input.slug,
    displayName: input.displayName,
    description: input.description,
    status: "active",
  });
  return true;
}

export async function setTagStatus(slug: string, status: AdminTag["status"]): Promise<boolean> {
  const rows = await requireDb()
    .update(tags)
    .set({ status, updatedAt: new Date() })
    .where(eq(tags.slug, slug))
    .returning({ id: tags.id });

  return rows.length > 0;
}

export async function addTagAlias(targetSlug: string, aliasSlug: string): Promise<boolean> {
  if (targetSlug === aliasSlug) return false;
  if (!await isSlugAvailable(aliasSlug)) return false;

  const target = await getTagIdentity(targetSlug);
  if (!target || target.status !== "active") return false;

  await requireDb().insert(tagAliases).values({
    aliasSlug,
    targetTagId: target.id,
  });
  return true;
}

export async function mergeTagInto(sourceSlug: string, targetSlug: string): Promise<boolean> {
  if (sourceSlug === targetSlug) return false;

  const database = requireDb();
  const source = await getTagIdentity(sourceSlug);
  const target = await getTagIdentity(targetSlug);
  if (!source || !target || target.status !== "active") return false;

  await database.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO post_tags (post_id, tag_id, created_at)
      SELECT post_id, ${target.id}, now()
      FROM post_tags
      WHERE tag_id = ${source.id}
      ON CONFLICT DO NOTHING
    `);
    await tx.delete(postTags).where(eq(postTags.tagId, source.id));
    await tx
      .update(tagAliases)
      .set({ targetTagId: target.id })
      .where(eq(tagAliases.targetTagId, source.id));
    await tx.execute(sql`
      INSERT INTO tag_aliases (alias_slug, target_tag_id, created_at)
      VALUES (${source.slug}, ${target.id}, now())
      ON CONFLICT (alias_slug) DO UPDATE SET target_tag_id = EXCLUDED.target_tag_id
    `);
    await tx
      .update(tags)
      .set({ status: "disabled", postCount: 0, updatedAt: new Date() })
      .where(eq(tags.id, source.id));
    await tx.execute(sql`
      UPDATE tags
      SET post_count = (
        SELECT COUNT(*)::int FROM post_tags WHERE tag_id = ${target.id}
      ),
      updated_at = now()
      WHERE id = ${target.id}
    `);
  });

  return true;
}

async function getTagIdentity(slug: string): Promise<TagIdentity | null> {
  const rows = await requireDb()
    .select({ id: tags.id, slug: tags.slug, status: tags.status })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);

  return rows[0] ?? null;
}

async function isSlugAvailable(slug: string): Promise<boolean> {
  const existingTags = await requireDb()
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);
  if (existingTags.length > 0) return false;

  const existingAliases = await requireDb()
    .select({ aliasSlug: tagAliases.aliasSlug })
    .from(tagAliases)
    .where(eq(tagAliases.aliasSlug, slug))
    .limit(1);

  return existingAliases.length === 0;
}
