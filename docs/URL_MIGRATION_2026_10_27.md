# v1.3.155 release handoff — legacy URL reference cleanup

User authorized retirement on October 27, 2026 after confirming the new Google callback and working integrations. Canonical production is https://selahflow.onrender.com (srv-dbgbiu0n74is73cglveg); staging is unchanged. Legacy service retirement is pending explicit approval after automatic approval review blocked the retirement controls. The old service remains running with its existing deployment setting. No database, customer record or credentials are deleted. Previously sent links remain available while the legacy service is retained. Historical URL examples in documentation now use the canonical address; historical deployment IDs remain evidence, not current deployment instructions.

Database preflight permissions are unchanged so the retained legacy service can continue starting safely. Staging rejects every non-staging Render hostname rather than naming the retired host. Sharing fixtures use the canonical origin. Stripe webhook already targets canonical production. Google callback configuration is user-confirmed, not directly inspected.

This release removes literal legacy URL references from current tracked source/documentation. Historical deployment identities remain for audit and existing startup compatibility; they are not URL dependencies. Final verification is recorded after deployment. No real booking, charge, or outgoing test email is created.

# v1.3.154 release handoff — canonical URL deployment verified LIVE

Primary production is https://selahflow.onrender.com, Render service selahflow (srv-dbgbiu0n74is73cglveg), workspace tea-da643qgu01pc73951gdg. It reuses the existing selahflow_production database and selahflow_production_user. No customer-data copy, reset or credential rotation. Original selahflow-studio (srv-db3tokqd0e5s73f31hfg) remains available at the old hostname for existing links/callbacks. No automatic redirect is installed.

PR #82 added canonical PDF/current-documentation links, a configurable message worker and staging-host protection. PR #83 added the exact new immutable Render service ID to database preflight without weakening database, role, schema or ownership checks. Application merge bca27a11a9a05e60dc020b3d981345256756528a; source tree 1acbab4fb9c019da67a17d04eb751daf52a87437. Staging commit 1ca857482b9f86c2130f7587a0e97070ce4ca055 has the identical tree.

Staging dep-dbgc4hg473hc73b2di70 LIVE 2026-10-27T15:33:36.645549Z. Old production dep-dbgc90ks728c73f7jpdg LIVE 15:36:15.075160Z. New production dep-dbgc9tnavr4c73dkc15g LIVE 15:38:03.475253Z. Normal npm run start is restored on the new service; APP_URL is the new origin, SELAHFLOW_MESSAGE_WORKER=true, and main auto-deploy is On Commit. Old worker flag is false, verified in Render. Do not set the old service APP_URL to the new origin: that would reject old-origin mutations.

Local, GitHub CI 40530704751/job 122282381795 and Render staging passed 424 tests, typecheck and builds. Both production services passed live version/booking/payment-shell/protected-API/no-store checks. New production preflight confirms intended database/role, schema CREATE true and zero unowned tables. Gmail readiness is configured/setupComplete true, needsReconnect false, missingConfiguration empty; authorization remains stored_connection_not_live_verified. No error-level entries in the checked successful cutover window.

New-host PDF exact-byte and business-scoped assistant checks passed; staging and new production passed public assistant and ID-only unknown-status checks. The older GitHub live-smoke run exposed a stale hardcoded four-session assertion after successful deployment checks. The verification script now compares the mixed answer against published weekly/monthly plan data and current price; its corrected live checks passed in both environments. This verification-only correction does not alter the deployed app.

Stripe live SelahFlow LLC endpoint we_1UTjvl3btxSEZmvTRMc6CG0l was updated and read back at https://selahflow.onrender.com/api/stripe/webhook. Its endpoint ID, API version and eight event subscriptions were retained; no secret rotation or charge. The unsigned endpoint rejects invalid signatures. Existing Gmail connection and credentials are retained. Still pending: Google OAuth allowlisting of https://selahflow.onrender.com/api/platform/gmail/callback for future reconnection, and authorized real payment/email-delivery verification. No real client booking, signature, payment, test email or customer-data retrieval was used for QA.

The 20-page Arcila guide revision 1.1 has eight new-host links, SHA-256 d3132806a98f0c1610e965323181bda22bde0a85ab67e172ceb3b94f4b731035, 1,388,112 bytes. Rendered pages were visually checked. Public Arcila navigation and Request help were verified in the browser at the new host. New-origin sign-in/notification permission is separate from the old origin. See docs/URL_MIGRATION_2026_10_27.md for operational details.


## Operational safeguards and follow-up

- Preserve the original service; do not delete/suspend it while clients, saved emails, OAuth callbacks or in-flight Checkout sessions may reference it. Pages are not automatically redirected.
- Both production instances use the same database; staging retains its dedicated database and role. There is no second production data copy to reconcile.
- New service: Virginia, Free, main, build `npm ci --include=dev --no-audit --no-fund && npm run build`, start `npm run start`, auto-deploy On Commit. No paid plan upgrade.
- Stripe configuration was copied with the original signing secret. Only the existing provider endpoint URL was changed; API version and event set were preserved. Do not create a duplicate webhook endpoint or rotate keys as part of this migration.
- Gmail needs the new callback URI allowed in the existing Google OAuth client for future reconnection. Existing stored refresh connection is shared and was not revoked/reconnected. Provider authorization and inbox delivery have not been tested live.
- The v1.3.153 new-service attempt dep-dbgc1rqfngtc7399l870 failed safely at the immutable-service allowlist. Old worker was restored through dep-dbgc37uc6qcc73evlkmg before the v1.3.154 correction. Final sequential worker transfer can delay queued delivery briefly; no queue clearing or manual message replay occurred.
- Render's environment-update connector triggers a deployment. Use the browser Save only action when staging configuration for the next release. Masked field edits must be verified after save; only reveal non-secret worker flags for that check.
- Google Cloud browser/account access is the remaining provider-configuration step. Stripe connector is now connected to live SelahFlow LLC; no further permission to use Stripe/Render is needed within this authorized migration scope.
