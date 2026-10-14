-- Presentation groups do not alter plans, member balances or payment history.
CREATE TABLE membership_groups (
 id TEXT PRIMARY KEY,
 business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
 display_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (business_id,id)
);
CREATE UNIQUE INDEX membership_groups_name_idx ON membership_groups(business_id,lower(name));
ALTER TABLE membership_plans ADD COLUMN group_id TEXT;
ALTER TABLE membership_plans ADD CONSTRAINT membership_plans_group_business_fk
 FOREIGN KEY (business_id,group_id) REFERENCES membership_groups(business_id,id);
CREATE INDEX membership_plans_group_idx ON membership_plans(business_id,group_id);
