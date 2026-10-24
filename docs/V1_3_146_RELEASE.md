# v1.3.146 release handoff — verified LIVE in staging and production

Primary Platform Admin → First-time customer commissions now has separate immediate-save green-accent checkboxes for each business’s 10% first paid booking and first paid membership, plus Disable both commissions when either is enabled. The primary-only API changes only the chosen condition under the existing transaction/advisory lock and records the administrator actor. Owners can save terms acceptance while both commissions remain off, allowing initial activation by platform admin once Stripe is ready. The admin API cannot accept terms for a business. Disabling works during Stripe outages and after business archival. Original activation dates, consent, identity salts, fee claims, refunds and retained accounting history are preserved. Existing open checkouts retain their quoted fee; the panel explains how to expire unpaid checkouts before replacing them.

Application commit `6dd1146a9a22ff5daaba45cb668297ff56874e15`; saved feature `feature/platform-commission-controls`; PR #73 merged. Staging `dep-dbe9qq2vcj2c73c82us0` LIVE October 24, 2026 at 8:05:18 a.m. EDT; production `dep-dbe9ujm7bikc73b0o390` LIVE at 8:08:22 a.m. EDT. Local full suite before the final terms-only UI change passed 395 tests; final affected 14 tests, typecheck and build passed afterward. Final GitHub CI run 40091867155/job 120866030044 and Render staging passed all 396 tests, typecheck and builds; production build/startup passed. Both live health/version, booking/payment shells, protected routes, invalid invitation, commission disclosure and unauthorized/origin checks passed, including unauthorized enable/disable POST requests. Startup preflights confirmed dedicated staging/production databases/users, schema CREATE true and zero unowned tables; no error-level entries observed in the checked startup windows.

Authenticated production browser verified v1.3.146, all eight per-business controls, green accent styling, Stripe webhook Ready and specific setup/terms blockers. All four businesses remain Off with zero recorded commissions; owner acceptance and business Stripe verification are pending. No live commission toggle or terms acceptance was submitted for QA. Enable/disable persistence, independent conditions, first-purchase history, tenant scope, audit actor and readiness failures were exercised in synthetic API/database/UI fixtures. Staging authenticated admin UI was not manually exercised because that origin requires sign-in; no credentials or roles were changed. No actual card charge, bank payout, fee refund or phone-device acceptance was performed. No migration, environment, credentials, customer records or unrelated data changed. Documentation/verification-only [skip render] commits may follow the application SHA.

## Release evidence

- [Merged PR #73](https://github.com/pbraza07/selahflow-studio/pull/73)
- [GitHub CI](https://github.com/pbraza07/selahflow-studio/actions/runs/40091867155)
- [Production admin controls](https://salonflow-hf3w.onrender.com/admin/platform#platform-commissions)
- Local production screenshot: selahflow-platform-commission-controls-146-1792843793473.jpg

## Using the controls

1. Sign in as the primary platform administrator and open Platform Admin.
2. Find First-time customer commissions · 10%.
3. For the desired business, check or uncheck the first-booking or first-membership commission. Each change saves immediately; the other condition is preserved.
4. Disable both commissions turns both off in one transaction.
5. Enabling requires accepted business terms in the owner's Settings → Stripe payments, an active business, verified business Stripe account and ready platform webhook events. The panel identifies missing setup. Platform admins cannot accept owner terms with this API.

Changes affect new checkouts. Existing open checkouts keep the quoted fee; expire an unpaid checkout before issuing a replacement. Repeat purchases and membership renewals do not gain additional fees. No live fees are activated for QA; no card charge, bank payout or refund is performed.
