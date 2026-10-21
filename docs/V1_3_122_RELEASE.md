# v1.3.122 — deployed and verified, 2026-10-21

Application commit: `9f1f1604d579dee081ecdf72efc020f5f5ba8b74`. Both `main` and `staging` deploy this exact commit. Feature branch `feature/membership-billing-coupons-and-approval` retains the application changes, verification workflow and this handoff.

| Environment | Deployment | LIVE at (UTC) | Database / role |
| --- | --- | --- | --- |
| Staging | `dep-dbcj8aivcj2c73er1l10` | 2026-10-21T21:58:00.813174Z | selahflow_staging / selahflow_staging_user |
| Production | `dep-dbcjaum1egvs73epor60` | 2026-10-21T22:00:02.579445Z | selahflow_production / selahflow_production_user |

## Validation evidence

- Application [GitHub Actions run 39681710623](https://github.com/pbraza07/selahflow-studio/actions/runs/39681710623): **304 tests passed, 0 failed**; typecheck and production build passed.
- Render staging independently ran **304 tests, 304 passed, 0 failed**, typecheck and build before deployment.
- Final post-deployment [live verification run 39682606664](https://github.com/pbraza07/selahflow-studio/actions/runs/39682606664): both health endpoints report HTTP 200 / status ok / version 1.3.122; booking and membership payment pages return 200; unauthenticated owner membership/team APIs return 401; invalid invitations return 400 with no-store caching.
- Both actual startup preflights report schema CREATE permission and **zero unowned tables**. Dedicated staging/production database names and roles were checked from startup logs, excluding synthetic test output.
- Migration 053 applied in staging at 21:45:52Z and production at 21:59:53Z. Migration 054 applied in final staging at 21:57:44Z and production at 21:59:53Z. Startup completed successfully.
- No error-level logs were returned in the post-release check beginning 21:58:00Z.
- The local filesystem/command runtime stalled. Complete source was recovered and saved with GitHub tools, and validation ran on fresh GitHub Actions/Render checkouts. Do not trust incomplete local worktrees from this session.

## Delivered behavior

- Member-specific owner **Send for payment**, durable delivery status, expiring hashed-token invitation and secure Stripe subscription enrollment. Email includes identity/ID, plan, description, price, frequency, monthly sessions and Make payment action.
- Initial paid date and owner monthly-date override anchor billing and monthly allowances. Clamped short months return to the original anniversary. Monthly credits reset without rollover, separately from configurable weekly/monthly/yearly billing frequency. Early manual prepayment extends coverage without adding another current-month allowance.
- Stripe recurring checkout, verified invoice synchronization and owner-scheduled recurrence changes at the next already-paid renewal boundary. Initial full payment precedes any date alignment; date changes create no immediate invoice. Existing external schedules require Stripe review before another schedule is created.
- Owner Coupons tab: business-scoped descriptions, fixed/percentage discounts, first-invoice or ongoing duration, expiry/enable controls and membership checkout discount preview/revalidation.
- Mandatory owner approval for every public service booking. Pending bookings cannot start checkout or be automatically confirmed by payment/reconciliation workers. Payment is offered after approval by email or verified lookup; participation conditions are stated in confirmations and emails.
- Clients group the booking lifecycle into one expandable row, with payment evidence driving red Pending / green Completed and background updates.
- Monthly member history includes attended service names and session activity under the member ID.
- Owner-only session-series staff assignments and accountability notes; a checkbox hides public team names.
- Optional media statement and consent are stored with the signed waiver. Existing participation signatures remain valid without implying media permission. Guardian signing, retained evidence and once-per-identity reuse remain intact.
- Legacy manual weekly/annual paid periods are preserved while their session periods remain monthly. Financial amounts and provider-owned paid-through dates are preserved.

## Practical limits and owner acceptance

No real customer charge, email, checkout enrollment, billing-date update or recurrence update was performed for testing. Stripe and sender interactions were tested with mocks; live provider delivery/charging and owner browser interaction were not exercised. Migration and normal worker accounting are production behavior, not synthetic test mutations. No customer was deleted and no environment/database/connection was removed or replaced; Amanda Realtor and Kairos were not targeted.

Older manual memberships are initialized from their last recorded payment. Owners can correct historical initial dates with Override initial date. Active coupons apply to membership checkout. Existing subscription schedules require review before replacing their billing arrangement.

See [owner guide](V1_3_122_OWNER_GUIDE.md) for where to find the new controls.
