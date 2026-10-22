# v1.3.124 — Device push notifications

## Investigation

Screenshot showed missing server keys, default device permission and zero reviewer devices. Live v1.3.123 production advertised an existing public push key; retain its key pair. Staging advertised no key. STAGING_PUSH_ENABLED must explicitly be true; staging snapshot imports exclude device subscriptions, so devices opt in separately. Do not weaken email/SMS staging allowlists.

## Permanent configuration

Render service environment is the source of truth for VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto or public HTTPS contact URL). Never generate keys on boot, commit them, or rotate a working pair during releases. Staging and production use separate origins and registrations. Merge environment updates; never replace unrelated variables. Startup reports only configured/reason. /api/push/customer-key exposes readiness and the public key, never private credentials. Existing subscriptions persist across releases. Invalid/expired subscriptions require a fresh device opt-in.

## Owner setup on iPhone

Use iOS 16.4 or later. Open the correct business page in Safari, Share → Add to Home Screen, then launch the icon. Sign in, open Settings → Device push notifications, tap Enable notifications on this device and Allow. Tap Send test notification and inspect Notification Center. Enable booking approval notifications and save business settings for booking-request push delivery. Each business/reviewer and device opts in independently. If permission is denied, change it in iOS notification settings; Focus can silence delivery. Server acceptance of a test does not prove device display.

Production: https://salonflow-hf3w.onrender.com. Staging: https://selahflow-staging.onrender.com. Do not remove/reinstall an existing working icon unless needed to update its name; reinstalling requires permission/registration again.

## Validation

Pending final automated checks and deployment verification. No real customer notifications sent for QA. Device permission and actual iPhone display require user action.
