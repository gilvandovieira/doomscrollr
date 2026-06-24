-- Per-user display preferences so theme + language follow a signed-in account
-- across devices. Both nullable: NULL means "fall back to this device / browser".

ALTER TABLE users ADD COLUMN IF NOT EXISTS locale text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference text;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_preference_valid;
ALTER TABLE users ADD CONSTRAINT users_theme_preference_valid
  CHECK (theme_preference IS NULL OR theme_preference IN ('auto', 'light', 'dark'));
