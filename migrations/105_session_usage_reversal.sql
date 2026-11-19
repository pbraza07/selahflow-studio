-- Keep the allocation that paid for a visit, even after the membership renews.
ALTER TABLE membership_session_ledger ADD COLUMN usage_period_start timestamptz;

CREATE FUNCTION capture_session_usage_period() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT credit_period_start INTO NEW.usage_period_start FROM customer_memberships
 WHERE business_id=NEW.business_id AND id=NEW.membership_id;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_session_usage_period BEFORE INSERT ON membership_session_ledger
 FOR EACH ROW WHEN (NEW.event_type='session_used') EXECUTE FUNCTION capture_session_usage_period();

CREATE FUNCTION reverse_removed_session_usage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE debit record; charged_period timestamptz; details jsonb := OLD.data::jsonb;
BEGIN
 FOR debit IN SELECT l.*,m.credit_period_start,m.billing_type,p.weekly_sessions
  FROM membership_session_ledger l JOIN businesses b ON b.id=l.business_id
  JOIN customer_memberships m ON m.id=l.membership_id AND m.business_id=b.id
  JOIN membership_plans p ON p.id=m.plan_id
  WHERE b.owner_id=OLD.owner AND l.appointment_id=OLD.id AND l.event_type='session_used'
  FOR UPDATE OF m,l
 LOOP
  charged_period := debit.usage_period_start;
  IF charged_period IS NULL THEN
   charged_period := NULLIF(details->'pastMembershipOverride'->>'creditPeriodStart','')::timestamptz;
  END IF;
  IF charged_period IS NULL AND debit.billing_type<>'package' THEN
   SELECT period_start INTO charged_period FROM membership_credit_periods
    WHERE business_id=debit.business_id AND membership_id=debit.membership_id
    AND CASE WHEN debit.weekly_sessions IS NOT NULL AND NOT(details ? 'pastMembershipOverride')
     THEN OLD.date::date >= (period_start AT TIME ZONE 'UTC')::date AND OLD.date::date < (period_end AT TIME ZONE 'UTC')::date
     ELSE debit.created_at>=period_start AND debit.created_at<period_end END LIMIT 1;
  END IF;
  IF debit.billing_type='package' OR charged_period=debit.credit_period_start OR
    (charged_period IS NULL AND (debit.credit_period_start IS NULL OR debit.created_at>=debit.credit_period_start)) THEN
   UPDATE customer_memberships SET sessions_used=greatest(0,sessions_used-1),updated_at=now()
    WHERE id=debit.membership_id AND business_id=debit.business_id;
  ELSE
   UPDATE membership_credit_periods SET sessions_used=greatest(0,sessions_used-1)
    WHERE membership_id=debit.membership_id AND business_id=debit.business_id AND period_start=charged_period;
  END IF;
  DELETE FROM membership_session_ledger WHERE id=debit.id;
 END LOOP;
 RETURN OLD;
END $$;
CREATE TRIGGER reverse_cancelled_session_usage AFTER UPDATE OF status ON appointments
 FOR EACH ROW WHEN (NEW.status='Cancelled' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION reverse_removed_session_usage();
CREATE TRIGGER reverse_deleted_session_usage BEFORE DELETE ON appointments
 FOR EACH ROW EXECUTE FUNCTION reverse_removed_session_usage();
