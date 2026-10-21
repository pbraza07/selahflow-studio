-- Run as the existing database administrator, connected ONLY to selahflow_production.
-- Metadata-only repair; no customer rows, databases, grants or unrelated sequences are removed.
-- The legacy kairos_portal_backups_backup_id_seq is deliberately excluded.
BEGIN;
GRANT selahflow_production_user TO amanda_realtor_db_user
  WITH INHERIT FALSE GRANTED BY amanda_realtor_db_user;
GRANT selahflow_production_user TO amanda_realtor_db_user
  WITH SET TRUE GRANTED BY amanda_realtor_db_user;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $repair$
DECLARE target text; actual_owner text;
BEGIN
  IF current_database() <> 'selahflow_production' OR current_user <> 'amanda_realtor_db_user' THEN
    RAISE EXCEPTION 'Connect as the existing administrator to selahflow_production only';
  END IF;
  IF NOT has_schema_privilege('selahflow_production_user','public','CREATE') THEN
    RAISE EXCEPTION 'Production role requires existing public schema CREATE privilege';
  END IF;
  FOREACH target IN ARRAY ARRAY[
    'ai_usage',
    'appointments',
    'booking_action_tokens',
    'booking_client_flows',
    'booking_client_messages',
    'booking_notification_attempts',
    'booking_payments',
    'booking_receipt_emails',
    'booking_request_edits',
    'booking_requests',
    'booking_review_links',
    'business_client_profiles',
    'business_entitlement_overrides',
    'business_logos',
    'business_member_ids',
    'business_memberships',
    'business_notification_reads',
    'business_plan_entitlement_audit',
    'business_push_subscriptions',
    'business_subscriptions',
    'business_team_seat_requests',
    'businesses',
    'customer_booking_access',
    'customer_booking_ids',
    'customer_booking_push',
    'customer_memberships',
    'events',
    'legacy_business_member_numbers',
    'login_attempts',
    'marketplace_referrals',
    'membership_groups',
    'membership_payment_emails',
    'membership_plans',
    'membership_requests',
    'membership_session_ledger',
    'membership_webhook_events',
    'merchant_accounts',
    'owner_history_hidden',
    'owner_report_hidden_payments',
    'platform_admins',
    'platform_business_audit',
    'platform_gmail_connection',
    'platform_gmail_oauth_states',
    'public_limits',
    'registration_email_codes',
    'schema_migrations',
    'service_enrollments',
    'sessions',
    'settings',
    'slots',
    'staging_email_verifications',
    'staging_registration_resets',
    'staging_snapshot_backups',
    'staging_snapshot_runs',
    'stripe_payment_receipts',
    'users'
  ] LOOP
    SELECT pg_get_userbyid(c.relowner) INTO actual_owner
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=target AND c.relkind IN ('r','p');
    IF actual_owner IS NULL OR actual_owner NOT IN ('amanda_realtor_db_user','selahflow_production_user') THEN
      RAISE EXCEPTION 'Unexpected/missing ownership for %; no changes committed',target;
    END IF;
    IF actual_owner='amanda_realtor_db_user' THEN
      EXECUTE format('ALTER TABLE public.%I OWNER TO selahflow_production_user',target);
    END IF;
  END LOOP;
  FOREACH target IN ARRAY ARRAY['public.member_identity_key(text,date)','public.persisted_member_number_allowed(text,text,boolean)','public.protect_business_member_id()'] LOOP
    SELECT pg_get_userbyid(proowner) INTO actual_owner FROM pg_proc WHERE oid=to_regprocedure(target);
    IF actual_owner IS NULL OR actual_owner NOT IN ('amanda_realtor_db_user','selahflow_production_user') THEN
      RAISE EXCEPTION 'Unexpected/missing function ownership for %; no changes committed',target;
    END IF;
    IF actual_owner='amanda_realtor_db_user' THEN
      EXECUTE 'ALTER FUNCTION ' || target || ' OWNER TO selahflow_production_user';
    END IF;
  END LOOP;
END
$repair$;
SELECT current_database() AS database,
 count(*) FILTER (WHERE pg_get_userbyid(c.relowner)='selahflow_production_user') AS production_owned_tables,
 count(*) FILTER (WHERE pg_get_userbyid(c.relowner)<>'selahflow_production_user') AS other_owned_tables
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p');
REVOKE selahflow_production_user FROM amanda_realtor_db_user
  GRANTED BY amanda_realtor_db_user;
COMMIT;
