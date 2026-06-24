import {
  mockComments,
  mockPosts,
  mockReports,
  mockTagAliases,
  mockTags,
  mockUsers,
} from "@doomscrollr/shared/mock-data.ts";
import { generateId } from "@doomscrollr/shared/lib/ids.ts";
import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const MOCK_NOW = Date.parse("2026-06-24T12:00:00.000Z");
const MOCK_EPOCH = Date.parse("2026-01-01T12:00:00.000Z");

function hoursAgoIso(hours: number): string {
  return new Date(MOCK_NOW - hours * 60 * 60 * 1000).toISOString();
}

function minutesAgoIso(minutes: number): string {
  return new Date(MOCK_NOW - minutes * 60 * 1000).toISOString();
}

const sql = postgres(databaseUrl, { max: 1 });

const userIdByUsername = new Map(mockUsers.map((user) => [user.username, generateId()]));
const tagIdBySlug = new Map(mockTags.map((tag) => [tag.slug, generateId()]));
const postIdByKey = new Map(mockPosts.map((post) => [post.key, generateId()]));
const postIdByPublicCode = new Map(
  mockPosts.map((post) => [post.publicCode, postIdByKey.get(post.key)!]),
);
const commentIdByKey = new Map(mockComments.map((comment) => [comment.key, generateId()]));
const commentIdByPublicCode = new Map(
  mockComments.map((comment) => [comment.publicCode, commentIdByKey.get(comment.key)!]),
);

function tagPostCount(slug: string): number {
  return mockPosts.filter((post) => post.status === "published" && post.tags.includes(slug)).length;
}

function resolveTargetId(report: (typeof mockReports)[number]): string {
  if (report.targetType === "post") return postIdByPublicCode.get(report.targetCode)!;
  if (report.targetType === "comment") return commentIdByPublicCode.get(report.targetCode)!;
  return userIdByUsername.get(report.targetCode)!;
}

function trustLevelForUser(user: (typeof mockUsers)[number]): string {
  if (user.role === "admin") return "admin";
  if (user.status === "limited") return "limited";
  return "normal";
}

try {
  await sql.begin(async (tx) => {
    for (const user of mockUsers) {
      await tx`
        INSERT INTO users (
          id, clerk_user_id, username, display_name, avatar_url,
          role, status, trust_level, created_at, updated_at
        )
        VALUES (
          ${userIdByUsername.get(user.username)!},
          ${`clerk_mock_${user.username}`},
          ${user.username},
          ${user.displayName},
          ${user.avatarUrl},
          ${user.role},
          ${user.status},
          ${trustLevelForUser(user)},
          ${new Date(MOCK_EPOCH + user.createdAtHoursOffset * 86400000).toISOString()},
          now()
        )
      `;
    }

    for (const tag of mockTags) {
      await tx`
        INSERT INTO tags (id, slug, display_name, description, status, post_count, created_at, updated_at)
        VALUES (
          ${tagIdBySlug.get(tag.slug)!},
          ${tag.slug},
          ${tag.displayName},
          ${tag.description},
          ${"active"},
          ${tagPostCount(tag.slug)},
          now(),
          now()
        )
      `;
    }

    for (const alias of mockTagAliases) {
      await tx`
        INSERT INTO tag_aliases (alias_slug, target_tag_id, created_at)
        VALUES (${alias.aliasSlug}, ${tagIdBySlug.get(alias.targetSlug)!}, now())
      `;
    }

    for (const post of mockPosts) {
      const createdAt = hoursAgoIso(post.hoursAgo);
      await tx`
        INSERT INTO posts (
          id, public_code, author_id, post_kind, title, slug,
          body_text, image_url, youtube_url, youtube_video_id, youtube_is_short,
          status, score, reaction_count, comment_count, report_count, created_at, updated_at
        )
        VALUES (
          ${postIdByKey.get(post.key)!},
          ${post.publicCode},
          ${userIdByUsername.get(post.authorUsername)!},
          ${post.postKind},
          ${post.title},
          ${post.slug},
          ${post.bodyText},
          ${post.imageUrl},
          ${post.youtubeUrl},
          ${post.youtubeVideoId},
          ${post.youtubeIsShort},
          ${post.status},
          ${post.score},
          ${post.reactionCount},
          ${post.commentCount},
          ${post.reportCount},
          ${createdAt},
          ${createdAt}
        )
      `;

      for (const slug of post.tags) {
        await tx`
          INSERT INTO post_tags (post_id, tag_id, created_at)
          VALUES (${postIdByKey.get(post.key)!}, ${tagIdBySlug.get(slug)!}, ${createdAt})
        `;
      }
    }

    // Insert top-level comments before replies so parent references exist.
    const orderedComments = [...mockComments].sort((a, b) =>
      (a.parentKey === null ? 0 : 1) - (b.parentKey === null ? 0 : 1)
    );
    for (const comment of orderedComments) {
      const createdAt = minutesAgoIso(comment.minutesAgo);
      await tx`
        INSERT INTO comments (
          id, public_code, post_id, author_id, parent_comment_id,
          body_text, status, score, reaction_count, reply_count, created_at, updated_at
        )
        VALUES (
          ${commentIdByKey.get(comment.key)!},
          ${comment.publicCode},
          ${postIdByKey.get(comment.postKey)!},
          ${userIdByUsername.get(comment.authorUsername)!},
          ${comment.parentKey ? commentIdByKey.get(comment.parentKey)! : null},
          ${comment.bodyText},
          ${"published"},
          ${comment.score},
          ${comment.reactionCount},
          ${comment.replyCount},
          ${createdAt},
          ${createdAt}
        )
      `;
    }

    for (const report of mockReports) {
      const createdAt = hoursAgoIso(report.hoursAgo);
      await tx`
        INSERT INTO reports (
          id, reporter_user_id, target_type, target_id, reason, details, status, created_at, updated_at
        )
        VALUES (
          ${generateId()},
          ${userIdByUsername.get(report.reporterUsername)!},
          ${report.targetType},
          ${resolveTargetId(report)},
          ${report.reason},
          ${report.details},
          ${report.status},
          ${createdAt},
          ${createdAt}
        )
      `;
    }
  });

  console.log(
    `Seeded ${mockUsers.length} users, ${mockTags.length} tags, ${mockPosts.length} posts, ` +
      `${mockComments.length} comments, and ${mockReports.length} reports.`,
  );
} finally {
  await sql.end();
}
