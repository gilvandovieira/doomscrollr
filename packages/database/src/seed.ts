import { mockComments, mockPosts, mockReports, mockUsers } from "@doomscrollr/shared/mock-data.ts";
import type { MediaAsset } from "@doomscrollr/shared/types.ts";
import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const sql = postgres(databaseUrl, { max: 1 });

function uniqueMediaAssets() {
  const mediaAssets = new Map<string, MediaAsset>();
  for (const post of mockPosts) {
    mediaAssets.set(post.media.id, post.media);
  }
  return [...mediaAssets.values()];
}

function uniqueTags() {
  return [...new Set(mockPosts.flatMap((post) => post.tags))].sort();
}

try {
  await sql.begin(async (transaction) => {
    for (const user of mockUsers) {
      await transaction`
        INSERT INTO users (
          id,
          clerk_user_id,
          username,
          display_name,
          avatar_url,
          role,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ${user.id},
          ${`clerk_mock_${user.username}`},
          ${user.username},
          ${user.displayName},
          ${user.avatarUrl},
          ${user.role},
          ${user.status},
          ${user.createdAt},
          ${user.createdAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          updated_at = now()
      `;
    }

    for (const media of uniqueMediaAssets()) {
      await transaction`
        INSERT INTO media_assets (
          id,
          provider,
          media_type,
          provider_media_id,
          original_url,
          embed_url,
          thumbnail_url,
          preview_url,
          width,
          height,
          duration_seconds,
          aspect_ratio,
          attribution_label,
          attribution_url,
          metadata_json,
          status,
          created_at
        )
        VALUES (
          ${media.id},
          ${media.provider},
          ${media.mediaType},
          ${media.providerMediaId},
          ${media.originalUrl},
          ${media.embedUrl},
          ${media.thumbnailUrl},
          ${media.previewUrl},
          ${media.width},
          ${media.height},
          ${media.durationSeconds},
          ${media.aspectRatio},
          ${media.attributionLabel},
          ${media.attributionUrl},
          ${JSON.stringify({ seeded: true })},
          ${media.status},
          now()
        )
        ON CONFLICT (id) DO UPDATE SET
          provider = EXCLUDED.provider,
          media_type = EXCLUDED.media_type,
          provider_media_id = EXCLUDED.provider_media_id,
          original_url = EXCLUDED.original_url,
          embed_url = EXCLUDED.embed_url,
          thumbnail_url = EXCLUDED.thumbnail_url,
          preview_url = EXCLUDED.preview_url,
          width = EXCLUDED.width,
          height = EXCLUDED.height,
          duration_seconds = EXCLUDED.duration_seconds,
          aspect_ratio = EXCLUDED.aspect_ratio,
          attribution_label = EXCLUDED.attribution_label,
          attribution_url = EXCLUDED.attribution_url,
          metadata_json = EXCLUDED.metadata_json,
          status = EXCLUDED.status
      `;
    }

    for (const tag of uniqueTags()) {
      await transaction`
        INSERT INTO tags (id, name)
        VALUES (${`tag_${tag}`}, ${tag})
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      `;
    }

    for (const post of mockPosts) {
      await transaction`
        INSERT INTO posts (
          id,
          author_id,
          media_asset_id,
          title,
          slug,
          score,
          upvote_count,
          downvote_count,
          comment_count,
          status,
          monetization_status,
          ad_safety_score,
          created_at,
          updated_at
        )
        VALUES (
          ${post.id},
          ${post.author.id},
          ${post.media.id},
          ${post.title},
          ${post.slug},
          ${post.score},
          ${post.upvoteCount},
          ${post.downvoteCount},
          ${post.commentCount},
          ${post.status},
          ${post.monetizationStatus},
          ${post.adSafetyScore},
          ${post.createdAt},
          ${post.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          slug = EXCLUDED.slug,
          score = EXCLUDED.score,
          upvote_count = EXCLUDED.upvote_count,
          downvote_count = EXCLUDED.downvote_count,
          comment_count = EXCLUDED.comment_count,
          status = EXCLUDED.status,
          monetization_status = EXCLUDED.monetization_status,
          ad_safety_score = EXCLUDED.ad_safety_score,
          updated_at = EXCLUDED.updated_at
      `;

      for (const tag of post.tags) {
        await transaction`
          INSERT INTO post_tags (id, post_id, tag_id)
          VALUES (${`${post.id}_${tag}`}, ${post.id}, ${`tag_${tag}`})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    }

    for (const comment of mockComments.flatMap((comment) => [comment, ...comment.replies])) {
      await transaction`
        INSERT INTO comments (
          id,
          post_id,
          author_id,
          parent_id,
          body,
          score,
          status,
          moderation_status,
          created_at,
          updated_at
        )
        VALUES (
          ${comment.id},
          ${comment.postId},
          ${comment.author.id},
          ${comment.parentId},
          ${comment.body},
          ${comment.score},
          ${comment.status},
          ${comment.moderationStatus},
          ${comment.createdAt},
          ${comment.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          body = EXCLUDED.body,
          score = EXCLUDED.score,
          status = EXCLUDED.status,
          moderation_status = EXCLUDED.moderation_status,
          updated_at = EXCLUDED.updated_at
      `;
    }

    for (const report of mockReports) {
      await transaction`
        INSERT INTO reports (
          id,
          reporter_id,
          target_type,
          target_id,
          reason,
          details,
          status,
          created_at,
          reviewed_at,
          reviewed_by
        )
        VALUES (
          ${report.id},
          ${report.reporter.id},
          ${report.targetType},
          ${report.targetId},
          ${report.reason},
          ${report.details},
          ${report.status},
          ${report.createdAt},
          ${report.reviewedAt},
          ${report.reviewedBy?.id ?? null}
        )
        ON CONFLICT (id) DO UPDATE SET
          reason = EXCLUDED.reason,
          details = EXCLUDED.details,
          status = EXCLUDED.status,
          reviewed_at = EXCLUDED.reviewed_at,
          reviewed_by = EXCLUDED.reviewed_by
      `;
    }
  });

  console.log(
    `Seeded ${mockUsers.length} users, ${mockPosts.length} posts, and ${mockReports.length} reports.`,
  );
} finally {
  await sql.end();
}
