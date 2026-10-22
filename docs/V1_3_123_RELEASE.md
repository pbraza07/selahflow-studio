# v1.3.123 release — verified LIVE

Verified October 21, 2026 (America/New_York). Application commit: `fa0940153b86bae3b68d10f87a909592516bd992`. The locally tested source tree and GitHub tree both equal `19fa4004ae4a8e7ab156bcb1d5ad12b4d6875973`.

| Environment | Deployment | LIVE time (Eastern) |
| --- | --- | --- |
| Staging | `dep-dbcmf1om7kps73c7k4rg` | October 21, 9:37:12 p.m. |
| Production | `dep-dbcmifbncjis73b1e63g` | October 21, 9:40:47 p.m. |

## Changes and owner steps

1. **Memberships → Coupons:** create a percentage or fixed-dollar business coupon. Clients enter it in **Service discount** on the final booking-review form and choose **Apply coupon**. The server computes the amount from the business catalog, validates the code again on submission, and stores the discount and net service lines. Owner approval, Stripe checkout, receipt emails and recorded payment amounts retain that quote, including after later coupon expiry/deactivation. Membership coupon behavior is preserved; the duration setting controls recurring membership invoices. The manual point-of-sale cart remains a separate workflow.
2. **Client booking email:** submitting a request queues a receipt with appointment details and approval/payment conditions. No payment button is offered before approval. After owner approval, the email includes services, date, Eastern start time, duration, public team name unless hidden, location, amount due, coupon details and a private **Make Payment** button when payment is due. Covered/free bookings receive approval without an unnecessary payment link. Duplicate approval/delivery attempts retain idempotency. Owner review links work even when legacy optional approval settings were disabled.
3. **Overview → Team accountability:** choose a session date, select its actual session/time, choose staff, and save the dated assignment. Recurring occurrences are independent. Assignment lists include date and Eastern time. Existing series assignments and privacy controls remain intact. Assignments do not change the public coach, seat capacity or client records.

## Actual validation

- Local: **307 tests passed, 0 failed**, TypeScript and production build passed.
- [GitHub Actions 39706182250](https://github.com/pbraza07/selahflow-studio/actions/runs/39706182250): **307 tests passed, 0 failed**, typecheck/build passed on the deployed source.
- Render staging independently ran **307 tests, 307 passed, 0 failed**, plus typecheck/build.
- Both deployments applied additive migration **055_dated_team_assignments.sql**. Actual startup preflights verified `selahflow_staging / selahflow_staging_user` and `selahflow_production / selahflow_production_user`, schema CREATE permission and zero unowned tables.
- Final live checks: health HTTP 200 / status ok / version 1.3.123; owner team API rejects anonymous access with 401; invalid owner review link returns 403; marketplace, booking pages and public catalogs return 200 for all listed businesses. Invalid service coupons are rejected for businesses with bookable services. No booking is created by these checks. An initial smoke check used the wrong Arcila slug; the final checks discovered canonical slugs from the directory and passed.
- Production startup reports **Gmail configured=true**. Staging recipient/rollout protections remain unchanged. Email integration tests verify both stages, their destination and contents, and payment-button access. This readiness result does not establish inbox delivery.
- No error-level startup logs were returned in the post-production check.

## Scope and limits

No real customer charge, email, booking, attendance update or team assignment was created for QA. Provider sending and Stripe fulfillment were exercised with mocks and synthetic in-memory records; private owner/browser visual acceptance and live customer delivery/charging were not exercised. Existing customer, financial, waiver and series-assignment records were retained. Database connections, environments, Amanda Realtor and Kairos were not changed.

The feature branch `feature/service-discounts-notifications-dated-team` is saved. Documentation-only handoff commits use `[skip render]`; distinguish those branch heads from the deployed application commit above.
