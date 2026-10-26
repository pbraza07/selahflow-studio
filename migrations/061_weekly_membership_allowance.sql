-- Existing plans retain their fixed monthly allowance until explicitly edited.
ALTER TABLE membership_plans ADD COLUMN weekly_sessions INTEGER CHECK (weekly_sessions BETWEEN 1 AND 3);
