-- v2 reposts and quote posts. Reposts/quotes are posts with a one-hop target
-- post; target visibility stays controlled by the existing post status and
-- blocking checks in read queries.

ALTER TYPE post_kind ADD VALUE IF NOT EXISTS 'repost';
ALTER TYPE post_kind ADD VALUE IF NOT EXISTS 'quote';

ALTER TABLE posts
  ADD COLUMN repost_of_post_id uuid REFERENCES posts (id) ON DELETE CASCADE,
  ADD COLUMN repost_count integer NOT NULL DEFAULT 0,
  ADD COLUMN quote_count integer NOT NULL DEFAULT 0;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'posts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%post_kind%'
      AND pg_get_constraintdef(oid) LIKE '%youtube_video_id%'
  LOOP
    EXECUTE format('ALTER TABLE posts DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE posts
  ADD CONSTRAINT posts_kind_fields CHECK (
    (
      post_kind::text = 'text'
      AND body_text IS NOT NULL
      AND length(trim(body_text)) > 0
      AND image_url IS NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
      AND repost_of_post_id IS NULL
    )
    OR (
      post_kind::text = 'external_image'
      AND body_text IS NULL
      AND image_url IS NOT NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
      AND repost_of_post_id IS NULL
    )
    OR (
      post_kind::text = 'youtube'
      AND body_text IS NULL
      AND youtube_url IS NOT NULL
      AND youtube_video_id IS NOT NULL
      AND image_url IS NULL
      AND repost_of_post_id IS NULL
    )
    OR (
      post_kind::text = 'repost'
      AND body_text IS NULL
      AND image_url IS NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
      AND repost_of_post_id IS NOT NULL
    )
    OR (
      post_kind::text = 'quote'
      AND body_text IS NOT NULL
      AND length(trim(body_text)) > 0
      AND image_url IS NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
      AND repost_of_post_id IS NOT NULL
    )
  );

CREATE INDEX posts_repost_target_idx ON posts (repost_of_post_id)
  WHERE repost_of_post_id IS NOT NULL;
