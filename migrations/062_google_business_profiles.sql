CREATE TABLE IF NOT EXISTS business_google_profiles (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
 place_id TEXT NOT NULL DEFAULT '',
 show_reviews BOOLEAN NOT NULL DEFAULT true,
 show_photos BOOLEAN NOT NULL DEFAULT true,
 encrypted_refresh_token TEXT,
 account_email TEXT NOT NULL DEFAULT '',
 location_name TEXT NOT NULL DEFAULT '',
 connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK(connection_status IN ('connected','disconnected','needs_reconnect')),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_google_oauth_states (
 state_hash TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL,
 encrypted_verifier TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE INDEX IF NOT EXISTS business_google_oauth_expiry ON business_google_oauth_states(expires_at);
