-- V3 proportional moderation: internal domain blocklist for external/provider links.

CREATE TABLE IF NOT EXISTS domain_blocks (
  id uuid PRIMARY KEY,
  domain text NOT NULL,
  reason text,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_blocks_domain_format CHECK (
    domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS domain_blocks_domain_unique
  ON domain_blocks(domain);
