# v1.3.125 — Central question manager

## Owner instructions

Open Settings → Questions. Choose Booking registration or Membership registration. Booking defaults to all questions; choose a service or session in Question scope to manage its existing required overrides and create a question with that target. Create/edit labels, types, choices, visibility, scopes and ordering here. Required and Show in push notifications and business alert emails are independent. Save questions publishes via the existing authenticated business settings form. Page changes retain existing draft/discard protection.

Each standard/custom question has its own requirement and notification checkbox. First name, last name and date of birth remain required and are explicitly marked as needed for unique client ID creation/verification. Their notification display remains optional. Existing service requirements add to global requirements; session overrides retain their existing rules. No existing question choices are automatically reset. Legacy notification preferences remain the fallback until an explicit choice is made.

Appointment facts in push notifications and approval-review card display choices are also managed here, in separately labeled details panels. Notifications Settings now contains delivery/channel/reviewer/device setup only. Service Catalog and individual sessions no longer embed question editors. Memberships has no redundant question editing entry point. Existing customer answers remain read-only where displayed in client/history views; operational collection of answers remains available.

## Data and validation

No migration, environment variable, database connection or provider changes. Saved question IDs and historical answer labels remain intact. Existing quota limits and server-side tenant/registration validation remain. Moving a question off a form cleans obsolete notification/order/required references so it can be saved. No real customer records, bookings, emails, payments or push notifications created for QA.

Application commit: `051317c79f1a95e954795b3c11072d0feb4a2bae`; tested source tree `2144dcac5022ea9b69d924aec26c60644b74b71c`. Saved feature branch: `feature/centralized-registration-questions`; PR #51.

| Environment | Deployment | Verified LIVE (America/New_York) |
| --- | --- | --- |
| Staging | dep-dbctl7uq1p3s73d9b710 | October 22, 2026, 5:48:21 a.m. EDT |
| Production | dep-dbctog5g1s2s738etr1g | October 22, 2026, 5:51:37 a.m. EDT |

- Local: 314 tests passed, 0 failed; typecheck and production build passed. Final focused manager/review checks passed (8 tests).
- GitHub Actions run 39757525483 / job 119753206903: 314 tests passed, 0 failed; typecheck/build/static asset checks passed for the exact remote commit.
- Render staging: 314 tests passed, 0 failed; typecheck/build passed. Production build passed.
- Live health endpoints: ok / 1.3.125 in both environments. Public booking configurations passed for Arcila Training, Shekinah, Capstone and Car Shine; staging synthetic business also passed.
- Owner settings GET rejects anonymous requests with 401; originless settings POST rejects with 403, authenticated-origin anonymous POST with 401. The test never enters the settings-write branch.
- Live public page CSS serves the question-center and disclosure styles. Push readiness remains configured=true in both environments. Production Gmail readiness remains true.
- Database preflight: selahflow_staging / selahflow_staging_user and selahflow_production / selahflow_production_user, schema CREATE true, zero unowned tables; no error-level startup logs observed.
- New interaction tests assert the single editor, requirement/notification independence, service/session targeting, preservation of overrides, creation defaults and cleanup when a question changes form. Existing tests cover actual registration rendering, server validation, tenant isolation and saved-answer compatibility.

Private owner browser acceptance has not been performed. No live question definitions were changed for testing. Required identity fields remain locked to preserve the mandated ID policy; all question notification choices remain editable. Final documentation handoff uses [skip render] and does not deploy another build.
