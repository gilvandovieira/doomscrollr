-- v2 internal trust levels for moderation and account capability decisions.

CREATE TYPE user_trust_level AS ENUM (
  'new',
  'normal',
  'trusted',
  'limited',
  'moderator',
  'admin'
);

ALTER TABLE users
  ADD COLUMN trust_level user_trust_level NOT NULL DEFAULT 'new';

UPDATE users
SET trust_level = CASE
  WHEN role = 'admin' THEN 'admin'::user_trust_level
  WHEN status = 'limited' THEN 'limited'::user_trust_level
  ELSE 'normal'::user_trust_level
END;

DO $$
DECLARE
  existing_constraint text;
BEGIN
  FOR existing_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'moderation_audit_events'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%user_status_changed%'
      AND pg_get_constraintdef(oid) NOT LIKE '%user_trust_level_changed%'
  LOOP
    EXECUTE format(
      'ALTER TABLE moderation_audit_events DROP CONSTRAINT %I',
      existing_constraint
    );
  END LOOP;
END $$;

ALTER TABLE moderation_audit_events
  ADD CONSTRAINT moderation_audit_action
  CHECK (
    action IN (
      'post_removed',
      'post_restored',
      'comment_removed',
      'comment_restored',
      'report_dismissed',
      'report_actioned',
      'note_created',
      'user_status_changed',
      'user_trust_level_changed'
    )
  );
