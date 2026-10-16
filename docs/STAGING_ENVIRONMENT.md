# Production business copy — v1.3.89

The owner explicitly authorized a read-only production snapshot into staging on 2026-10-16. This supersedes the initial synthetic-only restriction below for this one import. Source is production v1.3.81, commit 806a87f23e211b1259af6415f7e54c1d27b4822d. Render's read-only SQL connector produced a single-statement consistent snapshot. No production secrets or customer data belong in Git.

The startup importer reads four compressed server configuration chunks and their SHA-256 checksum. It runs only against selahflow_staging as selahflow_staging_user, with outbound SMS/email/push disabled. Migration 039 stores a run ledger and a transactional undo copy of affected staging tables. Repeated startups skip the same completed snapshot; a different snapshot fails closed pending a separately reviewed refresh. The existing synthetic studio moves from crawford to staging-test-studio and retains its sandbox account/history. Source Crawford remains archived, matching production. Other business slugs remain identical to production.

Source passwords/hashes, sessions, verification/review/access tokens, push devices, merchant connections and webhook events are not copied. Membership/subscription Stripe execution references are cleared. Existing primary-admin access is retained; imported owner logins get independent unknown credentials and require a staging-only admin reset before login. Owner email collisions use a staging.invalid alias. Customer contact data is copied under the owner's authorization, but outbound delivery remains disabled. This is a point-in-time snapshot, not continuous synchronization, and does not promote staging code or data into production. Verify LIVE/import logs and public business pages before calling the copy complete.

# Shared Gmail setup — v1.3.88

Verified LIVE staging on 2026-10-16 UTC: code `44fb0a17301faa05eefee32491a3d7f5a3652a2b`, Render `dep-db8nlmks728c73ad29k0`, health 1.3.88. TypeScript, 220 tests and build passed locally and on Render; migration 038/startup succeeded. EMAIL_PROVIDER=gmail and the private encryption key are set in staging only. The authenticated primary platform administrator can see Shared Gmail sender, selected Gmail / Not connected, and exactly two missing variables: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET. The disabled Connect button prevents an unusable OAuth request. Anonymous access returns 401 and originless mutation returns 403. Actual Google authorization and email delivery remain pending because Google Cloud Console could not be accessed in the task browser. No Gmail account was selected or authorized, no external notification restrictions were relaxed, and no production setting was changed. Follow [Gmail setup](GMAIL_EMAIL_SETUP.md); retain the provisioned encryption key. Production remains v1.3.81.

# Staging client payment notifications — v1.3.87

Verified LIVE on 2026-10-15: commit `5bf2ceea7531e4718d67cec1337088c0050d331e`, deployment `dep-db8l5467bikc73feaij0`, health 1.3.87. All 217 tests, TypeScript and build passed locally and on Render; migration startup succeeded. In the authenticated UI, an approved synthetic $25 booking opened the existing connected sandbox and paid successfully. Payment was blocked before approval. The owner inbox showed two payment-link records followed by two confirmation records; repeat verification retained four records. Startup processing marked the confirmation channels not configured; unpaid link jobs were superseded after receipt. No real funds or new paid resources were used. Production remains LIVE v1.3.81 on its existing deployment.

Remaining delivery setup: configure staging-only `RESEND_API_KEY` and `RESEND_FROM_EMAIL` (verified sender), plus `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. Enable `STAGING_NOTIFICATIONS_ENABLED=true` and explicitly list approved test destinations in `STAGING_NOTIFICATION_EMAILS` / `STAGING_NOTIFICATION_PHONES` (phone with +country code). Keep credentials out of chat/source. Actual external delivery and independent live webhook-only fulfillment remain unverified; automated tests cover the shared verified-receipt path, atomic queueing and provider behavior. Do not permit real customer destinations as staging test recipients.

- Additive migration 037 commits one email and SMS message with each payable booking approval; a private 30-day fragment-token link opens existing connected Stripe Checkout. Free/covered bookings skip payment. Registration identity/payment snapshots are retained on acceptance.
- Verified connected-account receipt commits confirmation messages with the financial writes. Duplicate callbacks do not duplicate messages or revenue. A startup worker uses the existing process/pool, durable claims and bounded retries; ambiguous outcomes require a provider check. No paid worker or resources.
- Owner approval inbox shows masked destinations, channel/provider status and retries for unsent failed/unconfigured messages. Submitted means provider-accepted, not delivered. Phone requires an explicit country code. Email security scanners cannot start checkout.
- Staging UI on 2026-10-15 reports Resend and Twilio not configured. Keep external delivery disabled until test provider credentials and explicit recipient allowlists are supplied. Never claim actual SMS/email delivery or independent live webhook delivery without evidence.
- Run typecheck, all tests and build, then verify exact staging LIVE release/health before claiming deployment. Production remains v1.3.81; do not merge to main without authorization.

# SelahFlow staging environment

The staging branch prepares v1.4 development; the v1.4 feature milestone is not complete. Production is the separate `selahflow-studio` service on `main`, with its existing URL, database, credentials and release v1.3.81. Never merge or deploy to production without explicit owner authorization.

## Verified checkout release — 2026-10-15

v1.3.86 is LIVE, code commit `d4a42e93609eed3412a14502fcb11a37b84bc12d`, Render `dep-db8j358473hc73f49c90`. Health reports 1.3.86; TypeScript, all 215 tests and production build passed locally and on Render. Migration 036 is additive. Current Stripe account readiness was verified through the authenticated owner button.

- Both public flows show Make Payment and open the business's existing connected Stripe sandbox Checkout. A $25 booking test succeeded. Cancelling/retrying reused the same Checkout; revisiting its return page kept the single paid record.
- The $20/month synthetic Sandbox Checkout membership activated with ID SC0203, 0/3 sessions used, and paid-through November 15, 2026. Refreshing verification retained three credits and one provider-linked payment ledger entry.
- Reports show the new $25 service payment and $20 membership payment once each. The $85 selected-period total includes $40 of earlier synthetic manual membership payments; it is not $85 of provider charges.
- Actual sandbox checkout and server-to-Stripe return verification are tested. Signed webhook validation/idempotence and renewal credits are automated-test-covered; independent live webhook delivery and a future recurring cycle were not separately observed. Do not imply those are independently provider-tested.
- Tests use published Stripe test cards and synthetic contacts; no real funds. No new resources, plan changes, or additional build-minute blocks were purchased. Billing remained in the existing $5/1,000-minute block.
- Production remains v1.3.81, commit `806a87f23e211b1259af6415f7e54c1d27b4822d`, LIVE `dep-db8ao7rrjlhs73cvrf3g`; health 200. Documentation commits following the LIVE code are not new application deployments. Auto-deploy remains off for staging.

Provider testing uncovered two current API changes: Checkout now uses allowed_payment_method_types; invoice verification must accept paid status/amount without the removed paid boolean. Off-Stripe invoice amounts are retrieved and excluded. Existing paid checkout returns reconcile without charging again.

## Previous staging fix — 2026-10-15

v1.3.83 is LIVE at commit `cafcfe1540c9c99fd71fedb105140943ed2409be`, deploy `dep-db8fhvs9v7es73bmd8s0`. 211 automated tests, TypeScript and build passed. Sandbox credentials were configured by the owner. The authenticated Connect button created the business account through Accounts v2 with Stripe fees/losses responsibility and opened Stripe-hosted onboarding (test account banner confirmed). The owner must finish onboarding; readiness and checkout remain unverified. No real payment, new paid resources, or production change. Production deployment remains `dep-db8ao7rrjlhs73cvrf3g` on v1.3.81. Billing before this fix: 684 total pipeline minutes, 184 used in the existing $5/1,000-minute block.

## Initial verified deployment — 2026-10-15

- URL: https://selahflow-staging.onrender.com/
- Render service: `srv-db8e9dajnfac73fa0vo0`; code release v1.3.82.
- LIVE code commit: `304e8ed4decbbfffc453f1d643adc2a9528ba85e`; deployment `dep-db8egau89jmc73d74i80`.
- TypeScript, 208 automated tests, and the staging production build passed. All 47 live API/security/functional checks passed, including successful business-profile saves, two attendees in one session, full-capacity rejection, membership activation, zero-price member booking, once-only attendance debit, renewal with unchanged ID, logo upload/storage, logout, and post-deployment persistence.
- Synthetic fixture only: SelahFlow Staging Test Studio at `/book/crawford`, two synthetic clients, a three-session package with synthetic manual payment/renewal entries. These are not actual provider charges.
- Staging administrator: `pbraza@gmail.com`. The independently generated password is the staging service's `ADMIN_PASSWORD` in Render Environment; never copy the production password.
- Staging login was directly denied access to `amanda_realtor_db` (no CONNECT privilege). Existing login-role access was preserved. Amanda's plan, 5 GB allocation, original database name/user/credentials and application settings were not changed; only the authorized database access grants were hardened.
- Production service/settings/main remained unchanged at v1.3.81, commit `806a87f23e211b1259af6415f7e54c1d27b4822d`, deployment `dep-db8ao7rrjlhs73cvrf3g`. Both production and Amanda health endpoints returned HTTP 200 after setup.
- No paid resources or plan/storage upgrades were created. Existing pipeline-minute charges remained $5.00; usage advanced within the already purchased block. Free compute still shares workspace limits.
- Pending: owner-supplied Stripe sandbox secret key and a separate staging webhook secret. Real sandbox checkout/provider webhook delivery has NOT been tested. External email/SMS/push remain disabled.
- Automatic staging deploys remain disabled; production deployment still requires explicit authorization. Documentation commits after the LIVE commit do not imply another application deployment.

## Hosting and data

- Staging service: `selahflow-staging`, Node, Virginia, Free compute, GitHub branch `staging`. Auto-deploy is disabled to control build spending; deployments are deliberate staging actions.
- Shared paid PostgreSQL instance: `amanda-realtor-db`, existing plan and 5 GB storage unchanged; storage autoscaling remains disabled.
- New logical database: `selahflow_staging`; dedicated login: `selahflow_staging_user`, no superuser, database/role creation, replication, bypass-RLS or inherited memberships. Login connection limit: 5; application pool: 3.
- Amanda's data, schemas, existing credentials and connection strings are preserved. Its pre-existing login roles retain their former public CONNECT/TEMPORARY privileges through explicit grants; PUBLIC CONNECT/TEMPORARY is removed on Amanda so the staging user cannot connect there. Administrative and PostgreSQL system metadata remain shared on the same instance; this is application-data isolation, not a separate server.
- Initial setup used an empty staging database and independent Crawford fixture. The explicit 2026-10-16 authorization above permits the reviewed production business snapshot; do not copy production credentials or provider tokens.
- Logo/image uploads are stored in PostgreSQL (`business_logos`) and therefore use staging storage. No production object-store keys, buckets, disks or environment groups are linked.

## Environment and authentication

Use the settings in `render.staging.yaml`. Set a fresh staging-only `ADMIN_PASSWORD` in Render; keep it out of Git, docs and chat. `ADMIN_EMAIL=pbraza@gmail.com` provisions the independent staging primary administrator. Existing production credentials are never copied. Sessions are in the staging database, and secure cookies remain host-scoped.

Omit `APP_URL` so the origin follows Render's staging URL. If explicitly set, it must match that HTTPS staging origin. The startup/database guard rejects another database, role, host, production origin, wrong branch or service name before migrations can run.

## Payments and notifications

No production payment or notification credentials are copied. Stripe remains unconfigured until the owner supplies independent sandbox/test credentials through Render: `STRIPE_SECRET_KEY` and `STRIPE_CONNECT_WEBHOOK_SECRET` (webhook destination: staging `/api/stripe/webhook`). Staging rejects live keys and payment events with `livemode` other than `false`. Do not claim payment testing passed until a real sandbox checkout and signed webhook have been verified.

External email/SMS and Web Push default off. In-app request/approval notifications continue to work. For external test delivery, configure staging-only provider credentials, set `STAGING_NOTIFICATIONS_ENABLED=true`, and list explicit comma-separated test recipients in `STAGING_NOTIFICATION_EMAILS` and/or `STAGING_NOTIFICATION_PHONES`. Web Push requires a fresh VAPID pair and `STAGING_PUSH_ENABLED=true`. Never reuse production devices/subscriptions or real customer recipients.

## Cost limits

Free compute adds no service plan charge, but shares workspace free hours, bandwidth and build minutes. Free-service hour exhaustion can suspend production's Free service. Review Billing before each deploy. Do not increase spend caps, buy more minutes, upgrade plans or expand storage without explicit priced approval. On 2026-10-15 the workspace already had a purchased build-minute block; do not attribute that pre-existing charge to this setup.

## Validation and promotion

1. Run TypeScript, automated tests and production build. Deploy only `staging` and verify the exact Render LIVE commit.
2. Verify `/api/health`, the visible staging banner and noindex headers. Sign in to the staging-only account; verify anonymous private routes are denied and cross-origin writes are blocked.
3. Create only synthetic staging businesses/clients; test bookings, session capacity, membership assignment, check-in, renewal and logo persistence across a staging restart. Verify the staging login is denied access to Amanda's database and the existing Amanda connection still succeeds.
4. Recheck both production health endpoints and confirm production's service settings and LIVE commit are unchanged.
5. For future promotion, prepare a reviewed PR from staging to main with tests and an additive migration plan. Exclude staging infrastructure changes if inappropriate for main. Obtain the owner's explicit production deployment authorization before merging: production auto-deploys main. Promote source and migrations; never replace production data with staging data or copy staging secrets.

This file describes intended configuration. Actual URL, deployment ID, credentials readiness and completed acceptance checks must be recorded from live verification, without exposing secrets.
