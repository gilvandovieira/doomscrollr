import postgres from "postgres";

// Remove the demo seed rows from a database without touching real content.
// Seeded users are identified by their `clerk_mock_<username>` clerk id (set by
// seed.ts). This deletes those users and everything they authored, plus reports
// filed by or targeting them, then recomputes denormalized counters on the rows
// that remain. Tags are curated config and are kept (their post_count is
// recomputed). Idempotent: safe to run repeatedly.

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to remove seeded data.");
}

// Subquery fragments. The prefix is a hardcoded constant (no user input).
const SEEDED = "(SELECT id FROM users WHERE clerk_user_id LIKE 'clerk_mock_%')";
const SEEDED_POSTS = `(SELECT id FROM posts WHERE author_id IN ${SEEDED})`;
const SEEDED_COMMENTS =
  `(SELECT id FROM comments WHERE author_id IN ${SEEDED} OR post_id IN ${SEEDED_POSTS})`;

const sql = postgres(databaseUrl, { max: 1 });

try {
  const result = await sql.begin(async (tx) => {
    // 1. Drop moderator back-references so the seeded users can be deleted even if
    //    they moderated content we're keeping.
    await tx.unsafe(
      `UPDATE posts SET removed_by_user_id = NULL WHERE removed_by_user_id IN ${SEEDED}`,
    );
    await tx.unsafe(
      `UPDATE comments SET removed_by_user_id = NULL WHERE removed_by_user_id IN ${SEEDED}`,
    );

    // 2. Reports (target_id has no FK, so these never cascade): drop reports filed
    //    by seeded users or pointing at seeded users/posts/comments.
    await tx.unsafe(
      `DELETE FROM reports
         WHERE reporter_user_id IN ${SEEDED}
            OR (target_type = 'user' AND target_id IN ${SEEDED})
            OR (target_type = 'post' AND target_id IN ${SEEDED_POSTS})
            OR (target_type = 'comment' AND target_id IN ${SEEDED_COMMENTS})`,
    );

    // 3. Non-cascading user references on content we keep.
    await tx.unsafe(`DELETE FROM post_events WHERE actor_user_id IN ${SEEDED}`);
    await tx.unsafe(`DELETE FROM post_reactions WHERE user_id IN ${SEEDED}`);
    await tx.unsafe(`DELETE FROM comment_reactions WHERE user_id IN ${SEEDED}`);

    // 4. Comments, in FK-safe order: replies to seeded comments first (parent FK
    //    is RESTRICT), then seeded-authored comments, then anything left on seeded
    //    posts (e.g. real users' comments on a demo post).
    await tx.unsafe(
      `DELETE FROM comments WHERE parent_comment_id IN (SELECT id FROM comments WHERE author_id IN ${SEEDED})`,
    );
    await tx.unsafe(`DELETE FROM comments WHERE author_id IN ${SEEDED}`);
    await tx.unsafe(`DELETE FROM comments WHERE post_id IN ${SEEDED_POSTS}`);

    // 5. Seeded posts (cascades post_tags + any remaining reactions/events), then
    //    the users themselves (cascades user_blocks).
    const posts = await tx.unsafe(`DELETE FROM posts WHERE author_id IN ${SEEDED}`);
    const users = await tx.unsafe(`DELETE FROM users WHERE clerk_user_id LIKE 'clerk_mock_%'`);

    // 6. Recompute denormalized counters on the rows we kept.
    await tx.unsafe(
      `UPDATE posts p SET
         comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'published'),
         reaction_count = (SELECT count(*) FROM post_reactions r WHERE r.post_id = p.id),
         score = (SELECT coalesce(sum(r.value), 0) FROM post_reactions r WHERE r.post_id = p.id),
         report_count = (SELECT count(*) FROM reports rp WHERE rp.target_type = 'post' AND rp.target_id = p.id),
         updated_at = now()`,
    );
    await tx.unsafe(
      `UPDATE comments c SET
         reply_count = (SELECT count(*) FROM comments r WHERE r.parent_comment_id = c.id AND r.status = 'published'),
         reaction_count = (SELECT count(*) FROM comment_reactions cr WHERE cr.comment_id = c.id),
         score = (SELECT coalesce(sum(cr.value), 0) FROM comment_reactions cr WHERE cr.comment_id = c.id),
         updated_at = now()`,
    );
    await tx.unsafe(
      `UPDATE tags t SET
         post_count = (
           SELECT count(*) FROM post_tags pt
           JOIN posts p ON p.id = pt.post_id
           WHERE pt.tag_id = t.id AND p.status = 'published'
         ),
         updated_at = now()`,
    );

    return { posts: posts.count, users: users.count };
  });

  console.log(
    `Removed seeded data: ${result.users} users and ${result.posts} posts ` +
      `(plus their comments, reactions, reports, and events). Tags kept.`,
  );
} finally {
  await sql.end();
}
