-- v2 tags: aliases let admins merge/redirect duplicate tag spellings without
-- exposing free-form public tag creation.

CREATE TABLE tag_aliases (
  alias_slug text PRIMARY KEY,
  target_tag_id uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (alias_slug ~ '^[a-z0-9-]{2,32}$')
);
