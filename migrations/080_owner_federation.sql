-- Separate basic Google identity sign-in from Gmail delivery authorization.
CREATE TABLE owner_federation_states (
 state_hash TEXT PRIMARY KEY, binding_hash TEXT NOT NULL, verifier TEXT NOT NULL,
 nonce_hash TEXT NOT NULL, redirect_uri TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('signup','login')),
 plan_code TEXT NOT NULL CHECK(plan_code IN ('free','professional','business')),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE INDEX owner_federation_states_expiry ON owner_federation_states(expires_at);
CREATE TABLE owner_signup_identities (
 token_hash TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider='google'), subject TEXT NOT NULL,
 email TEXT NOT NULL, display_name TEXT NOT NULL DEFAULT '', plan_code TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL DEFAULT now()+interval '30 minutes'
);
CREATE INDEX owner_signup_identities_expiry ON owner_signup_identities(expires_at);
CREATE TABLE owner_federated_identities (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 provider TEXT NOT NULL CHECK(provider='google'), subject TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(provider,subject), UNIQUE(user_id,provider)
);
