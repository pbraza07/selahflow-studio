CREATE TABLE appointment_team_assignments(
 business_id TEXT NOT NULL REFERENCES businesses(id),
 appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
 staff_ids JSONB NOT NULL DEFAULT '[]',
 note TEXT NOT NULL DEFAULT '',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(business_id,appointment_id)
);
