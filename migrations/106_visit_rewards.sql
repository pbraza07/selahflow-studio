ALTER TABLE membership_plans ADD COLUMN reward_every integer CHECK (reward_every BETWEEN 1 AND 10000),
 ADD COLUMN reward_started_at timestamptz;
ALTER TABLE membership_session_ledger ADD COLUMN reward_redemption text;

CREATE VIEW available_reward_visits AS
 SELECT l.id,l.business_id,l.membership_id
 FROM membership_session_ledger l
 JOIN businesses b ON b.id=l.business_id
 JOIN customer_memberships m ON m.id=l.membership_id AND m.business_id=b.id
 JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=b.id
 JOIN appointments a ON a.owner=b.owner_id AND a.id=l.appointment_id
 WHERE l.event_type='session_used' AND l.reward_redemption IS NULL
 AND p.reward_every IS NOT NULL AND l.created_at>=p.reward_started_at
 AND a.status IN ('Checked in','Completed');
