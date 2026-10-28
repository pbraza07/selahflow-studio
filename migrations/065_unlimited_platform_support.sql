-- No separate support timer; the administrator's normal authenticated login still applies.
-- Preserve the legacy column for compatibility with the previous running instance.
ALTER TABLE platform_support_sessions ALTER COLUMN expires_at SET DEFAULT 'infinity'::timestamptz;
UPDATE platform_support_sessions SET expires_at='infinity'::timestamptz;
