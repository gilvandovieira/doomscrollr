-- v2 moderation workbench upgrades: target notes, report resolution audit,
-- and restore/status history for moderator actions.

CREATE TABLE moderation_notes (
  id uuid PRIMARY KEY,
  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,
  target_code text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES users (id),
  body_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(body_text)) BETWEEN 1 AND 1000)
);

CREATE INDEX moderation_notes_target_created_idx
  ON moderation_notes (target_type, target_id, created_at DESC);

CREATE TABLE moderation_audit_events (
  id uuid PRIMARY KEY,
  actor_user_id uuid NOT NULL REFERENCES users (id),
  action text NOT NULL,
  target_type report_target_type NOT NULL,
  target_id uuid NOT NULL,
  target_code text NOT NULL,
  report_id uuid REFERENCES reports (id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    action IN (
      'post_removed',
      'post_restored',
      'comment_removed',
      'comment_restored',
      'report_dismissed',
      'report_actioned',
      'note_created',
      'user_status_changed'
    )
  )
);

CREATE INDEX moderation_audit_created_idx
  ON moderation_audit_events (created_at DESC, id DESC);

CREATE INDEX moderation_audit_target_idx
  ON moderation_audit_events (target_type, target_id, created_at DESC);
