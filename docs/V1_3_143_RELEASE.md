# v1.3.143 — ID-only assistant status

Verified LIVE in staging and production October 23, 2026.

Open the assistant, choose Membership status or Booking status, and enter the unique client ID. A standalone ID checks both; a question containing a status intent and ID checks immediately. No email or date of birth is requested for this limited status check. Invalid input can be corrected. Cancel status lookup or a regular knowledge button leaves the status flow.

Membership results show status, plan/type and sessions remaining. Booking results show the latest booking status/date and payment state when available. Names, contacts, DOB, custom answers, payment amounts, booking access identifiers, tokens and links are excluded from the chat answer. Valid IDs are masked in the transcript, not saved to device storage; context resets on business changes. Existing business questions remain available.

The shared owner/public home/booking/membership widget uses existing /api/booking?slug=BUSINESS action registration_latest_status. Existing active-business/owner scope, validation, rate limits, no-store, membership/booking reconciliation and profile/payment verification gates remain intact. This is a limited status check, not identity verification for detailed personal records or payment access. Current eight-character IDs and legacy six-character IDs are accepted. No new database query, migration, credential/environment change or customer mutation.

## Release evidence

| Item | Verified result |
| --- | --- |
| Runtime application commit | `8d53aa5fe28be5389cee00ce05dc169f4627e8de` |
| Feature branch | `feature/assistant-id-status` |
| Review | [PR #70](https://github.com/pbraza07/selahflow-studio/pull/70), merged |
| Staging deployment | `dep-dbdr25ks728c7387qpj0`, LIVE 2026-10-23 19:17:00 UTC / 3:17:00 p.m. EDT |
| Production deployment | `dep-dbdr6fajnfac73boece0`, LIVE 2026-10-23 19:21:17 UTC / 3:21:17 p.m. EDT |
| Local validation | All 375 tests passed, zero failed/skipped/cancelled; typecheck and production build passed |
| GitHub CI | [Run 40009262345](https://github.com/pbraza07/selahflow-studio/actions/runs/40009262345), job 120605095205; all 375 tests, typecheck and build passed |
| Render staging | All 375 tests, typecheck and build passed |
| Production | Build/startup passed; live health reports 1.3.143 |

Four new tests cover status intent/state, normalized current/legacy IDs, invalid input, selected output mode/private-field exclusion and mandatory business scope. Existing actual-handler/PGlite tests verify same-ID tenant isolation, current plan/type/credits/status changes, malformed IDs, rate limits, and no deductions or membership mutations. Full matched cases use fixtures; no real client ID was queried for QA.

Desktop browser staging verified the membership-only flow, booking-only flow, direct-ID lookup for both, invalid input staying in the ID prompt, no DOB/email fields for status, masking the submitted ID, cancellation and normal pricing questions afterward. Production browser verified direct-ID results and the booking-only ID prompt; a screenshot was captured. Live checks used only a synthetic unmatched identifier; no real customer records were inspected or created. Actual phone-device acceptance was not performed.

Read-only live commands passed in both environments: verify-live-deployment.mjs checked version/health, booking/payment shells, protected owner APIs (401), and invalid invitation (400/no-store). verify-business-assistant.mjs checked published knowledge. verify-assistant-status.mjs checked ID-only unknown results, explicit limited response keys and no-store for every active marketplace business: five staging, four production. Lookup rate-limit counters update normally; no client, membership, booking, payment, waiver or communication records were changed.

Actual startup preflights: selahflow_staging / selahflow_staging_user and selahflow_production / selahflow_production_user; both schema CREATE true and zero unowned tables. No error-level startup entries observed in final post-startup windows. No migrations, account/credential changes, email sends, signatures, bookings, charges, customer deletions or settings mutations for verification.

The read-only verification workflow targets both live v1.3.143 environments and includes the new status script. Documentation and verification-only commits use [skip render]; they do not change or redeploy the runtime application.
