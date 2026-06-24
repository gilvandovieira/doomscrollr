-- v2 in-app notifications. Notifications are private to the recipient and expose
-- public target codes only through API transformers.

CREATE TYPE notification_type AS ENUM (
  'post_reply',
  'comment_reply',
  'mention',
  'moderation_outcome'
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  recipient_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  type notification_type NOT NULL,
  post_id uuid REFERENCES posts (id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments (id) ON DELETE CASCADE,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (actor_user_id IS NULL OR actor_user_id <> recipient_user_id)
);

CREATE INDEX notifications_recipient_created_idx
  ON notifications (recipient_user_id, created_at DESC, id DESC);

CREATE INDEX notifications_unread_idx
  ON notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;
