CREATE TABLE session_team_occurrences(
 business_id TEXT NOT NULL REFERENCES businesses(id),
 session_id TEXT NOT NULL,
 session_date TEXT NOT NULL,
 start_minute INTEGER NOT NULL CHECK(start_minute BETWEEN 0 AND 1439),
 staff_ids JSONB NOT NULL DEFAULT '[]',
 note TEXT NOT NULL DEFAULT '',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,session_id,session_date,start_minute)
);
