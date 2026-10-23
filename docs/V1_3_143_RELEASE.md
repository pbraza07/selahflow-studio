# v1.3.143 — ID-only assistant status

Implementation complete; deployment/validation pending. Prior verified LIVE version: 1.3.142.

Open the assistant, choose Membership status or Booking status, and enter the unique client ID. A standalone ID checks both, and a question containing the status intent and ID checks immediately. Only the ID is requested; no email or date of birth is required for this limited status check. Invalid input can be corrected; Cancel status lookup and regular knowledge buttons leave the lookup flow.

Membership results show status, plan/type and sessions remaining. Booking results show the latest booking status/date and payment state when available. No names, contacts, DOB, custom answers, payment amounts, booking access identifiers, tokens or links are displayed. Valid IDs are masked in chat; conversations/IDs are not saved to device storage. Context resets on business changes. This remains an ID-only status check, not proof of identity for detailed personal records or payment access.

The widget uses existing /api/booking?slug=BUSINESS action registration_latest_status. Existing business/owner scoping, active-business resolution, validation, rate limits, no-store and current membership/booking reconciliation are retained. The full-profile prefill and payment verification gates are unchanged. Legacy six-character IDs and current eight-character IDs work. No migration, environment, credential or business/customer data changes.

## Validation

Four new tests cover conversational intent/state, ID normalization/legacy compatibility/invalid input, explicit limited output/mode/privacy, and mandatory business scope. Existing actual-handler/PGlite tests cover business isolation, current credits/status, invalid IDs/rate limits and no credit mutation. Local full suite passed: 375 tests, zero failures/skips/cancellations; typecheck and production build passed. CI, staging browser/live checks and production verification pending.

Feature branch: feature/assistant-id-status.
