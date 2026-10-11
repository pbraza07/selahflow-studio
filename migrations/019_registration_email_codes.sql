-- Verification codes are short-lived, single-use, and scoped to a business and email.
CREATE TABLE IF NOT EXISTS registration_email_codes (
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 email_hash TEXT NOT NULL,
 code_hash TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_id,email_hash)
);
CREATE INDEX IF NOT EXISTS registration_email_codes_expiry ON registration_email_codes(expires_at);
