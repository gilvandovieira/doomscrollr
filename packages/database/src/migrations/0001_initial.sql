-- Doomscrollr v1 schema (spec §8 + §10.2).
-- SFW-only validation product: text / external image / YouTube posts, recent feed,
-- comments, reactions, reports, blocking, curated tags, and funnel events.

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'limited', 'suspended', 'banned');
CREATE TYPE post_kind AS ENUM ('text', 'external_image', 'youtube');
CREATE TYPE post_status AS ENUM ('published', 'removed');
CREATE TYPE comment_status AS ENUM ('published', 'removed');
CREATE TYPE report_target_type AS ENUM ('post', 'comment', 'user');
CREATE TYPE report_status AS ENUM ('open', 'dismissed', 'actioned');

CREATE TABLE users (
  id uuid PRIMARY KEY,
  clerk_user_id text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'user',
  status user_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (username ~ '^[a-z0-9_]{3,24}$')
);

CREATE TABLE posts (
  id uuid PRIMARY KEY,
  public_code text NOT NULL UNIQUE,
  author_id uuid NOT NULL REFERENCES users (id),
  post_kind post_kind NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  body_text text,
  image_url text,
  youtube_url text,
  youtube_video_id text,
  youtube_is_short boolean NOT NULL DEFAULT false,
  status post_status NOT NULL DEFAULT 'published',
  removal_reason text,
  removed_by_user_id uuid REFERENCES users (id),
  removed_at timestamptz,
  score integer NOT NULL DEFAULT 0,
  reaction_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  report_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(title)) BETWEEN 3 AND 180),
  CHECK (
    (
      post_kind = 'text'
      AND body_text IS NOT NULL
      AND length(trim(body_text)) > 0
      AND image_url IS NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
    )
    OR (
      post_kind = 'external_image'
      AND body_text IS NULL
      AND image_url IS NOT NULL
      AND youtube_url IS NULL
      AND youtube_video_id IS NULL
    )
    OR (
      post_kind = 'youtube'
      AND body_text IS NULL
      AND youtube_url IS NOT NULL
      AND youtube_video_id IS NOT NULL
      AND image_url IS NULL
    )
  )
);

CREATE INDEX posts_recent_idx
  ON posts (created_at DESC, id DESC)
  WHERE status = 'published';

CREATE INDEX posts_author_recent_idx
  ON posts (author_id, created_at DESC, id DESC)
  WHERE status = 'published';

CREATE TABLE comments (
  id uuid PRIMARY KEY,
  public_code text NOT NULL UNIQUE,
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users (id),
  parent_comment_id uuid REFERENCES comments (id),
  body_text text NOT NULL,
  status comment_status NOT NULL DEFAULT 'published',
  score integer NOT NULL DEFAULT 0,
  reaction_count integer NOT NULL DEFAULT 0,
  reply_count integer NOT NULL DEFAULT 0,
  removal_reason text,
  removed_by_user_id uuid REFERENCES users (id),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(body_text)) BETWEEN 1 AND 2000)
);

CREATE INDEX comments_post_recent_idx
  ON comments (post_id, created_at ASC, id ASC)
  WHERE status = 'published';

CREATE INDEX comments_parent_idx
  ON comments (parent_comment_id, created_at ASC, id ASC)
  WHERE status = 'published';

CREATE TABLE post_reactions (
  user_id uuid NOT NULL REFERENCES users (id),
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  value smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id),
  CHECK (value IN (-1, 1))
);

CREATE TABLE comment_reactions (
  user_id uuid NOT NULL REFERENCES users (id),
  comment_id uuid NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  value smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id),
  CHECK (value IN (-1, 1))
);

CREATE TABLE reports (
  id uuid PRIMARY KEY,
  reporter_user_id uuid NOT NULL REFERENCES users (id),
  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_idx ON reports (status);

CREATE TABLE user_blocks (
  blocker_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE TABLE tags (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  post_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (slug ~ '^[a-z0-9-]{2,32}$')
);

CREATE TABLE post_tags (
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE post_events (
  id uuid PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users (id),
  anon_session_id text,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX post_events_post_idx ON post_events (post_id, created_at DESC);
CREATE INDEX post_events_anon_idx
  ON post_events (anon_session_id, created_at DESC)
  WHERE anon_session_id IS NOT NULL;
