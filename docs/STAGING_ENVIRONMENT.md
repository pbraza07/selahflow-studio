# SelahFlow staging environment

The staging branch prepares v1.4 development; the v1.4 feature milestone is not complete. Production is the separate `selahflow-studio` service on `main`, with its existing URL, database, credentials and release v1.3.81. Never merge or deploy to production without explicit owner authorization.

## Latest staging fix — 2026-10-15

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
- Start with a newly migrated, empty staging database. Do not restore a production dump or copy customer records. The initial bootstrap creates an independent Crawford fixture because the existing startup expects that slug. This does not access production Crawford.
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
