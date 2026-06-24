CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'restricted', 'banned');
CREATE TYPE media_provider AS ENUM ('upload', 'youtube', 'giphy', 'tenor');
CREATE TYPE media_type AS ENUM ('image', 'gif', 'video', 'short');
CREATE TYPE media_status AS ENUM ('ready', 'pending_review', 'blocked');
CREATE TYPE aspect_ratio AS ENUM ('square', 'landscape', 'portrait', 'unknown');
CREATE TYPE content_status AS ENUM ('published', 'hidden', 'removed', 'pending_review');
CREATE TYPE monetization_status AS ENUM ('enabled', 'disabled', 'pending_review', 'unsafe');
CREATE TYPE report_status AS ENUM ('open', 'dismissed', 'actioned');
CREATE TYPE report_target_type AS ENUM ('post', 'comment', 'user');

CREATE TABLE users (
  id text PRIMARY KEY,
  clerk_user_id text NOT NULL,
  username text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'user',
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_clerk_user_id_unique ON users (clerk_user_id);
CREATE UNIQUE INDEX users_username_unique ON users (username);

CREATE TABLE media_assets (
  id text PRIMARY KEY,
  provider media_provider NOT NULL,
  media_type media_type NOT NULL,
  provider_media_id text,
  original_url text,
  embed_url text,
  thumbnail_url text NOT NULL,
  preview_url text,
  width integer,
  height integer,
  duration_seconds integer,
  aspect_ratio aspect_ratio NOT NULL DEFAULT 'unknown',
  attribution_label text,
  attribution_url text,
  metadata_json jsonb,
  status media_status NOT NULL DEFAULT 'pending_review',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE posts (
  id text PRIMARY KEY,
  author_id text NOT NULL REFERENCES users (id),
  media_asset_id text NOT NULL REFERENCES media_assets (id),
  title text NOT NULL,
  slug text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  upvote_count integer NOT NULL DEFAULT 0,
  downvote_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  status content_status NOT NULL DEFAULT 'published',
  monetization_status monetization_status NOT NULL DEFAULT 'pending_review',
  ad_safety_score real NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX posts_created_at_idx ON posts (created_at);
CREATE INDEX posts_score_idx ON posts (score);
CREATE INDEX posts_status_idx ON posts (status);
CREATE INDEX posts_monetization_status_idx ON posts (monetization_status);

CREATE TABLE comments (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES posts (id),
  author_id text NOT NULL REFERENCES users (id),
  parent_id text REFERENCES comments (id),
  body text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  status content_status NOT NULL DEFAULT 'published',
  moderation_status text NOT NULL DEFAULT 'clean',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comments_post_id_idx ON comments (post_id);
CREATE INDEX comments_parent_id_idx ON comments (parent_id);

CREATE TABLE post_votes (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  post_id text NOT NULL REFERENCES posts (id),
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX post_votes_user_post_unique ON post_votes (user_id, post_id);

CREATE TABLE comment_votes (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  comment_id text NOT NULL REFERENCES comments (id),
  value integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX comment_votes_user_comment_unique ON comment_votes (user_id, comment_id);

CREATE TABLE reports (
  id text PRIMARY KEY,
  reporter_id text NOT NULL REFERENCES users (id),
  target_type report_target_type NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text REFERENCES users (id)
);

CREATE INDEX reports_status_idx ON reports (status);

CREATE TABLE moderation_actions (
  id text PRIMARY KEY,
  moderator_id text NOT NULL REFERENCES users (id),
  target_type report_target_type NOT NULL,
  target_id text NOT NULL,
  action text NOT NULL,
  reason text,
  metadata_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE UNIQUE INDEX tags_name_unique ON tags (name);

CREATE TABLE post_tags (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES posts (id),
  tag_id text NOT NULL REFERENCES tags (id)
);

CREATE UNIQUE INDEX post_tags_post_tag_unique ON post_tags (post_id, tag_id);

CREATE TABLE saved_posts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  post_id text NOT NULL REFERENCES posts (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX saved_posts_user_post_unique ON saved_posts (user_id, post_id);
