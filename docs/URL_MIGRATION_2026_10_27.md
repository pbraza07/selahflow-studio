# URL migration — October 27, 2026 — new service live, full cutover pending

User authorized creating a new Render web service for https://selahflow.onrender.com while preserving all v1.3.152 functionality/data. Exact requested hostname successfully allocated.

## Verified new service

- Workspace tea-da643qgu01pc73951gdg; service selahflow, srv-dbgbiu0n74is73cglveg, Virginia, Free, repository pbraza07/selahflow-studio, main.
- Auto-deploy OFF during migration. Build npm ci --include=dev --no-audit --no-fund && npm run build.
- Current temporary start command: node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 10000. This intentionally bypasses scripts/start.mjs, which unconditionally sets SELAHFLOW_MESSAGE_WORKER=true. New service SELAHFLOW_MESSAGE_WORKER=false; existing service continues processing messages. Do not enable another worker casually during cutover.
- Existing production environment configuration copied using Render UI; APP_URL=https://selahflow.onrender.com added. Same selahflow_production database and selahflow_production_user; no data copy, deletion, reset, migration or credential rotation. Never document credential values.
- Initial deployment dep-dbgbiugn74is73cgm0s0 was a temporary preparation HTTP server, not the app.
- Actual app deployment dep-dbgbllcs728c73duhit0 LIVE 2026-10-27T14:54:43.723469Z (10:54:43 a.m. EDT), commit 8a21834d42f4a534569af8460a1bb0046721bf61, v1.3.152. No application source changes.

## Validation

New and old URLs passed scripts/verify-live-deployment.mjs: health/version, booking/payment page shells, protected API 401, invalid invitation 400 and no-store. New URL also passed PDF exact-byte SHA/content type, business-scoped assistant instructions for all four public businesses, and foreign-origin rejection. Browser displayed Arcila Training public page with navigation and Request help targeting the new host. Original 20-page PDF bytes retained, including old absolute links inside the document. No real customer record retrieval, booking, signature, charge or test email was performed. Existing 423-test release evidence remains for the unchanged code; not rerun for this hosting-only step.

## Retained production compatibility

Original selahflow-studio srv-db3tokqd0e5s73f31hfg at https://salonflow-hf3w.onrender.com remains unchanged, LIVE v1.3.152, with original email worker and existing Stripe callbacks. Staging unchanged. Do not disable/delete the original service: old emailed links, in-flight checkouts and provider callbacks may still use it.

## Remaining before declaring full migration complete

1. Verify Stripe account/Connect webhook destination and signing-secret continuity. The app commission configuration readiness checks match the exact request origin; a new-host endpoint must be coordinated before claiming full parity. Stripe plugin offered, not yet confirmed connected. No Stripe provider mutation performed.
2. Update/verify Google OAuth allowed reconnect redirect URI for the new host; preserve current database-backed Gmail connection and encryption key. No provider reconnect/revoke performed. Actual email delivery not tested.
3. Update current PDF absolute links, README/deployment references and verification targets after cutover readiness. Retain historical release evidence rather than rewriting history.
4. Coordinate final background-worker/migration startup role and auto-deploy policy. Confirm database preflight with normal release process; temporary direct Next startup reused existing schema.
5. Test authorized email and Stripe flows, including success/cancel returns, webhook receipt/idempotency and existing-link compatibility; do not claim these from page-shell checks.
6. Decide compatibility redirect behavior preserving routes/query/fragment and non-browser webhook POST handling. No redirects installed yet. New users need a fresh sign-in and notification permission on a different origin.

Browser Render authentication now uses the correct existing workspace; no further account permission is needed unless session expires. The previously selected selahflow7 Google login belonged to a different workspace and was signed out. No support messages sent.
