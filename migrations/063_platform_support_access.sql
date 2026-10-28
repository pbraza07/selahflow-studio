-- Support is bound to an administrator's existing login, never the owner's password.
CREATE TABLE IF NOT EXISTS platform_support_sessions (
 session_hash TEXT PRIMARY KEY REFERENCES sessions(token_hash) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES users(id),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '1 hour'
);
CREATE TABLE IF NOT EXISTS platform_support_audit (
 id TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES users(id),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 action TEXT NOT NULL CHECK(action IN ('start','end','request')),
 method TEXT NOT NULL DEFAULT '',
 path TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_support_audit_business_idx ON platform_support_audit(business_id,created_at DESC);
