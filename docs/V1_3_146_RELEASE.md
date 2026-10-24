# v1.3.146 release handoff — platform-admin commission controls (validation in progress)

Primary Platform Admin → First-time customer commissions now has separate immediate-save green checkboxes for each business’s 10% first paid booking and first paid membership, plus Disable both commissions. The primary-only API updates only the chosen condition under the existing transaction/advisory lock and records the administrator actor in the audit event. Owners can now save their terms acceptance with both commissions off, allowing subsequent initial activation by the primary admin. The admin API cannot accept business terms; prior owner acceptance, active business and Stripe readiness remain required for activation. Disabling remains possible if the merchant loses readiness, the platform webhook is unavailable or the business is archived. Original activation dates, consent, identity salts, fee claims, refunds and retained accounting history are preserved. Open checkouts retain their quoted fee; the UI explains how to expire unpaid checkouts before replacing them.

No migration, credentials, environment or customer-record changes. Feature branch feature/platform-commission-controls. Runtime/deployment verification pending; v1.3.145 remains the last verified LIVE release. See docs/V1_3_146_RELEASE.md for current evidence.

## Validation

- Focused commission server/API tests: 12 passed, 0 failed.
- Focused admin-control UI test: 1 passed, 0 failed.
- Typecheck passed.
- Full suite, build, CI, staging and production verification in progress.

## Using the controls

1. Sign in as the primary platform administrator and open Platform Admin.
2. Find First-time customer commissions · 10%.
3. For the desired business, check or uncheck the first-booking or first-membership commission. Each change saves immediately; the other condition is preserved.
4. Disable both commissions turns both off in one transaction.
5. Enabling requires accepted business terms in the owner's Settings → Stripe payments, an active business, verified business Stripe account and ready platform webhook events. The panel identifies missing setup. Platform admins cannot accept owner terms with this API.

Changes affect new checkouts. Existing open checkouts keep the quoted fee; expire an unpaid checkout before issuing a replacement. Repeat purchases and membership renewals do not gain additional fees. No live fees are activated for QA; no card charge, bank payout or refund is performed.
