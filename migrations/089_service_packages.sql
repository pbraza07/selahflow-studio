-- Existing offers and enrollments retain recurring membership behavior.
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'membership' CHECK (billing_type IN ('membership','package'));
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'membership' CHECK (billing_type IN ('membership','package'));
ALTER TABLE membership_plans ADD CONSTRAINT package_fixed_allowance CHECK (billing_type <> 'package' OR (weekly_sessions IS NULL AND sessions_included > 0));
CREATE OR REPLACE FUNCTION protect_offer_billing_type() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.billing_type <> OLD.billing_type AND EXISTS(SELECT 1 FROM customer_memberships WHERE business_id=OLD.business_id AND plan_id=OLD.id) THEN
  RAISE EXCEPTION 'Create a new offer to change payment type; existing enrollments must keep their payment terms.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_offer_billing_type BEFORE UPDATE OF billing_type ON membership_plans FOR EACH ROW EXECUTE FUNCTION protect_offer_billing_type();
CREATE OR REPLACE FUNCTION snapshot_enrollment_billing_type() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text;
BEGIN
 SELECT billing_type INTO STRICT kind FROM membership_plans WHERE id=NEW.plan_id AND business_id=NEW.business_id FOR SHARE;
 IF TG_OP='UPDATE' AND kind<>OLD.billing_type THEN RAISE EXCEPTION 'Create a new enrollment to change payment type.'; END IF;
 NEW.billing_type=kind;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_enrollment_billing_type BEFORE INSERT OR UPDATE OF plan_id,billing_type ON customer_memberships FOR EACH ROW EXECUTE FUNCTION snapshot_enrollment_billing_type();
