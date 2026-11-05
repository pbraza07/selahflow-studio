ALTER TABLE membership_plans ADD COLUMN hidden_from_clients boolean NOT NULL DEFAULT false;
ALTER TABLE membership_plans ADD COLUMN package_valid_days integer CHECK (package_valid_days BETWEEN 1 AND 3650);
ALTER TABLE membership_plans ADD CONSTRAINT package_validity_only CHECK (billing_type='package' OR package_valid_days IS NULL);
ALTER TABLE customer_memberships ADD COLUMN package_valid_days integer CHECK (package_valid_days BETWEEN 1 AND 3650);
CREATE FUNCTION snapshot_package_validity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR (NEW.plan_id IS DISTINCT FROM OLD.plan_id AND OLD.initial_paid_at IS NULL) THEN
  SELECT package_valid_days INTO NEW.package_valid_days FROM membership_plans WHERE id=NEW.plan_id AND business_id=NEW.business_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_package_validity BEFORE INSERT OR UPDATE OF plan_id ON customer_memberships FOR EACH ROW EXECUTE FUNCTION snapshot_package_validity();
