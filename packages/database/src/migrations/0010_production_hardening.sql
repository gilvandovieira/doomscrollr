-- Production hardening: make duplicate published reposts race-safe at the
-- database layer. Removed reposts no longer count as the user's active repost.

CREATE UNIQUE INDEX IF NOT EXISTS posts_author_published_repost_unique
  ON posts (author_id, repost_of_post_id)
  WHERE post_kind = 'repost'
    AND status = 'published'
    AND repost_of_post_id IS NOT NULL;
