# v1.3.124 — Device push notifications

## Investigation

Screenshot showed missing server keys, default device permission and zero reviewer devices. Live v1.3.123 production advertised an existing public push key; retain its key pair. Staging advertised no key even after explicit enablement was deployed; a dedicated persistent key pair was provisioned in its Render service environment. Production’s existing public key was verified unchanged after release. STAGING_PUSH_ENABLED must explicitly be true; staging snapshot imports exclude device subscriptions, so devices opt in separately. Do not weaken email/SMS staging allowlists.

## Permanent configuration

Render service environment is the source of truth for VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto or public HTTPS contact URL). Never generate keys on boot, commit them, or rotate a working pair during releases. Staging and production use separate origins and registrations. Merge environment updates; never replace unrelated variables. Startup reports only configured/reason. /api/push/customer-key exposes readiness and the public key, never private credentials. Existing subscriptions persist across releases. Invalid/expired subscriptions require a fresh device opt-in.

## Owner setup on iPhone

Use iOS 16.4 or later. Open the correct business page in Safari, Share → Add to Home Screen, then launch the icon. Sign in, open Settings → Device push notifications, tap Enable notifications on this device and Allow. Tap Send test notification and inspect Notification Center. Enable booking approval notifications and save business settings for booking-request push delivery. Each business/reviewer and device opts in independently. If permission is denied, change it in iOS notification settings; Focus can silence delivery. Server acceptance of a test does not prove device display.

Production: https://salonflow-hf3w.onrender.com. Staging: https://selahflow-staging.onrender.com. Do not remove/reinstall an existing working icon unless needed to update its name; reinstalling requires permission/registration again.

## Validation

Application commit: `dc96085edddca03195017752301088c7951cf1dd` (tree `7c457a92f33f7e0abdf92d080ffb54abcb4b6e18`). Feature branch: `fix/persistent-web-push`; PR #50.

| Environment | Deployment | Verified LIVE (UTC) |
| --- | --- | --- |
| Staging | dep-dbcn148473hc739jin8g | 2026-10-22 02:15:59 |
| Production | dep-dbcn3ve1egvs73etuhq0 | 2026-10-22 02:18:09 |

- Local: all 310 tests passed, 0 failed; typecheck and production build passed. An initial documentation-heading test failed and was corrected before the final full run.
- GitHub Actions: run 39709680076, job 119597762969, all 310 tests / typecheck / build passed.
- Render staging: all 310 tests passed, 0 failed, typecheck/build passed. Production build passed.
- Both live environments: health ok/1.3.124; push configured=true/reason=ready, public key length valid, private key never exposed; service worker and Arcila business standalone manifest served; private push GET and originless/unauthenticated test POST rejected. Production public key matches pre-release key.
- Startup: Web Push readiness ready in both; dedicated selahflow_staging/selahflow_production database roles, schema CREATE and zero unowned tables; no error-level startup logs observed. Production Gmail readiness remains configured=true.
- Tests exercise encryption/signing and delivery statuses through mocks, subscription preservation/replacement, and actual API logic with business/reviewer-scoped mocks, including foreign/missing devices, expired pruning and provider failure.

No real customer notifications sent for QA. Device permission and actual iPhone display require user action; provider acceptance does not prove display or bypass Focus. No authenticated owner browser test was performed. No database migration, customer deletion, financial changes, database connection changes or unrelated environment/data changes. Keys remain in Render, not this repository. Documentation handoff commits after the LIVE SHA use [skip render].
