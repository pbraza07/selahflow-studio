-- Explicit owner request: remove the verified legacy business in production and staging.
-- Keep login identities, platform administrators, other tenants and provider configuration.
DO $$
DECLARE
 target_id CONSTANT text := '2230020a-f028-4249-9c6f-e7ef60126a30';
 target_owner text;
 target_status text;
BEGIN
 SELECT owner_id,status INTO target_owner,target_status FROM businesses
 WHERE id=target_id AND slug='crawford' FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF target_status<>'archived' THEN
  RAISE EXCEPTION 'Crawford cleanup requires the verified archived business';
 END IF;
 IF EXISTS(SELECT 1 FROM merchant_accounts WHERE business_id=target_id AND external_account_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM business_subscriptions WHERE business_id=target_id AND stripe_subscription_id IS NOT NULL)
 OR EXISTS(SELECT 1 FROM customer_memberships WHERE business_id=target_id AND
    (stripe_subscription_id IS NOT NULL OR status IN ('active','past_due','pending_payment'))) THEN
  RAISE EXCEPTION 'Crawford has payment obligations; reconcile externally before removal';
 END IF;
 -- Child records first. Cascades remove request tokens, notification attempts,
 -- client messages, credit/ID reservations and business-owned memberships.
 DELETE FROM membership_payment_emails WHERE business_id=target_id;
 DELETE FROM stripe_payment_receipts WHERE business_id=target_id;
 DELETE FROM booking_receipt_emails WHERE business_id=target_id;
 DELETE FROM booking_payments WHERE business_id=target_id;
 DELETE FROM booking_client_flows WHERE business_id=target_id;
 DELETE FROM membership_requests WHERE business_id=target_id;
 DELETE FROM membership_session_ledger WHERE business_id=target_id;
 DELETE FROM customer_memberships WHERE business_id=target_id;
 DELETE FROM membership_plans WHERE business_id=target_id;
 DELETE FROM marketplace_referrals WHERE business_id=target_id;
 DELETE FROM platform_business_audit WHERE business_id=target_id;
 DELETE FROM business_plan_entitlement_audit WHERE business_id=target_id;
 DELETE FROM business_notification_reads WHERE business_id=target_id;
 DELETE FROM booking_request_edits WHERE business_id=target_id;
 DELETE FROM booking_review_links WHERE business_id=target_id;
 DELETE FROM booking_requests WHERE business_id=target_id;
 DELETE FROM staging_email_verifications WHERE business_id=target_id;
 DELETE FROM staging_registration_resets WHERE business_id=target_id;
 DELETE FROM customer_booking_access WHERE owner_id=target_owner;
 DELETE FROM customer_booking_push WHERE owner_id=target_owner;
 DELETE FROM owner_history_hidden WHERE owner=target_owner;
 DELETE FROM owner_report_hidden_payments WHERE owner=target_owner;
 DELETE FROM business_client_profiles WHERE owner=target_owner;
 DELETE FROM slots WHERE owner=target_owner;
 DELETE FROM appointments WHERE owner=target_owner;
 DELETE FROM events WHERE owner=target_owner;
 DELETE FROM settings WHERE owner=target_owner;
 -- Remove this tenant from any in-database import recovery records, retaining
 -- all unrelated snapshot records and the import marker (which prevents replay).
 UPDATE staging_snapshot_backups s SET records=(
  SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM jsonb_array_elements(s.records) r
  WHERE NOT (coalesce(r->>'business_id','')=target_id
   OR coalesce(r->>'owner','')=target_owner OR coalesce(r->>'owner_id','')=target_owner
   OR (s.table_name='businesses' AND r->>'id'=target_id))
 ) WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(s.records) r
  WHERE coalesce(r->>'business_id','')=target_id
   OR coalesce(r->>'owner','')=target_owner OR coalesce(r->>'owner_id','')=target_owner
   OR (s.table_name='businesses' AND r->>'id'=target_id));
 UPDATE staging_snapshot_runs SET summary=jsonb_set(summary,'{businesses}',(
  SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM jsonb_array_elements(summary->'businesses') r
  WHERE r->>'id'<>target_id
 )) WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(summary->'businesses') r WHERE r->>'id'=target_id);
 DELETE FROM businesses WHERE id=target_id AND owner_id=target_owner AND slug='crawford';
 RAISE NOTICE 'Verified legacy Crawford business removed; administrator identities preserved';
END $$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM businesses WHERE id='2230020a-f028-4249-9c6f-e7ef60126a30' OR slug='crawford') THEN
  RAISE EXCEPTION 'Crawford cleanup verification failed; transaction must roll back';
 END IF;
END $$;
