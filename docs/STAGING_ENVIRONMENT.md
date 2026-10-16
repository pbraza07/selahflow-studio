# All-business Stripe setup — v1.3.90

VERIFIED LIVE 2026-10-16 UTC: code 064bd99a2c9a7d8bcb0c51b656436f1177e930ce, Render dep-db9030vavr4c73cim47g, health 1.3.90. TypeScript, 225 tests and build passed locally/on Render. STAGING_PREPARE_STRIPE=true securely merged into staging only. Startup created separate sandbox accounts for Arcila, Capstone, Shekinah and Car Shine; all four connected=true/ready=false pending Stripe onboarding. Existing staging-test-studio account was preserved and provider-verified ready=true. Archived Crawford skipped. Public canPay confirms the same four false and fixture true. Anonymous payment-admin GET returns 401 and originless POST 403. Production remains health 1.3.81 on dep-db8ao7rrjlhs73cvrf3g; no production/main change or resource upgrade.

The staging primary-admin browser login was not completed (secure prompt returned user_took_over; final page remained sign-in), so private panel visual QA and the four onboarding flows remain pending. Arcila's public membership flow visibly has Make Payment disabled with its setup-pending explanation. A new synthetic Payment Sync membership in the original fixture opened genuine Sandbox Checkout for the existing $20/month package. Automatic approval review rejected final sandbox submission, requiring the user to perform that click. No new payment/subscription completion is claimed, and no real funds were charged. The synthetic enrollment remains pending; preserve its history and reuse the existing Checkout rather than creating another enrollment for the same identity. Existing checkout/approval/idempotency regressions pass in automated tests. Independent webhook delivery for these newly provisioned accounts remains unverified.

The primary administrator's /admin/platform now includes Business Stripe payments: prepare sandbox accounts, complete each business's Stripe onboarding, and synchronize verified status. Existing shared booking and membership Make Payment buttons use the matching business's merchant connection; approval/$0 rules still apply. STAGING_PREPARE_STRIPE=true prepares separate sandbox accounts for active tenants on startup and preserves existing connections. It uses synthetic sandbox contact emails, never copies live accounts or marks payments ready without a Stripe response. Inactive/archived businesses remain disabled. This does not refresh the production data snapshot or deploy to production. Record actual LIVE setup results below before calling payment readiness complete.

# Production business copy — v1.3.89

VERIFIED LIVE 2026-10-16 UTC: code 2cd1043920aa26b732710c093a92410e60458dcf, Render dep-db8qma2vcj2c73asf7ig, health 1.3.89. Startup atomically imported the 04:35:37 UTC production snapshot: five businesses, 25 client profiles, eight membership plans, three appointments, 171 history events and other related rows; all 28 table counts verified. Arcila, Capstone, Car Shine and Shekinah public booking settings match production after normalizing the newer API's membershipCreditAllowed default. Arcila's logo matches byte-for-byte. Source Crawford remains archived; the original synthetic studio still has sandbox canPay=true at /book/staging-test-studio. Imported businesses have canPay=false until independently connected to a sandbox. The five temporary import configuration values were cleared using Render Save only after import, without an additional build. No production setting, record, code or deploy was changed; production health remains 1.3.81 on dep-db8ao7rrjlhs73cvrf3g. TypeScript, 223 automated tests and build passed locally and on Render. Billing before deploy: 705 pipeline minutes, within the existing $5 block; no new resource, upgrade or block purchased. Owner/private-dashboard logins were not manually exercised in this task; use the independent staging admin and staging-only owner resets.

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

## v1.3.92 — Six-character password minimum (staging only)

The mandatory temporary-password replacement now accepts six-character passwords, matching signup, login, owner settings, admin creation and server validation. No password/data migration. Confirmation and different-password checks remain. Checks/deployment pending; production/main unchanged.

## v1.3.91 — Owner reset sign-in recovery (staging only)

- Resetting an owner password now clears only that owner’s sign-in and password-change throttles inside the reset transaction, retaining forced rotation and session revocation.
- One-time credential display offers Copy password only separately from Copy full sign-in message, links to the same environment, and explains that later resets invalidate earlier passwords. No existing passwords or hashes are displayed.
- User screenshot showed a rejected Arcila login; full-message paste is a possible cause, not confirmed. No real owner password was collected or reset during development. Owner login requires user verification after a fresh reset.

VERIFIED LIVE 2026-10-16 12:07 UTC: code 6c00cec73304c9c18ae731b44cf1943007e870a3, Render dep-db9158tg1s2s738vf4k0, health 1.3.91. TypeScript, all 226 tests and build passed locally and on Render. Snapshot startup confirms alreadyImported=true, preserving owner resets. No real owner password was obtained or reset; user must perform a fresh staging reset, copy only its password, sign in with its returned owner email, and complete forced rotation. Actual Arcila sign-in remains unverified. Production remains on dep-db8ao7rrjlhs73cvrf3g. Startup now reports Arcila Stripe ready=true; other three copied active businesses remain pending. Documentation updates after LIVE are not new deployments.
