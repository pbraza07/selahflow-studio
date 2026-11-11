-- Authorization health only; never persist access tokens or provider error bodies.
ALTER TABLE platform_gmail_connection
 ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'unchecked'
  CHECK (health_status IN ('unchecked','healthy','retrying','needs_reconnect','configuration_error')),
 ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
 ADD COLUMN IF NOT EXISTS incident_id TEXT,
 ADD COLUMN IF NOT EXISTS incident_started_at TIMESTAMPTZ;
