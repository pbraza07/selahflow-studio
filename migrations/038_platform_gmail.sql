CREATE TABLE IF NOT EXISTS platform_gmail_connection (
 id TEXT PRIMARY KEY CHECK(id='shared'),
 email TEXT NOT NULL,
 encrypted_refresh_token TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('connected','needs_reconnect')),
 connected_by TEXT NOT NULL REFERENCES users(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_gmail_oauth_states (
 state_hash TEXT PRIMARY KEY,
 actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL,
 encrypted_verifier TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes'
);
