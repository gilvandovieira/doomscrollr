-- v2 shared fixed-window rate-limit state. This lets multiple API processes
-- enforce the same buckets instead of each keeping a local in-memory counter.

CREATE TABLE rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (count >= 0)
);

CREATE INDEX rate_limit_buckets_reset_idx
  ON rate_limit_buckets (reset_at);
