-- Optional presentation settings; membership balances and history are unchanged.
ALTER TABLE membership_groups ADD COLUMN badge JSONB CHECK (badge IS NULL OR jsonb_typeof(badge)='object');
ALTER TABLE membership_plans ADD COLUMN badge JSONB CHECK (badge IS NULL OR jsonb_typeof(badge)='object');
