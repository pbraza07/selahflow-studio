# v1.3.138 — Remove remembered-name welcome banner

Removed the circled Welcome back / We remembered your name / Not you? Clear name box from the shared booking review form, including its display-only state, unused clear handler and styling. The shared form serves /book and /book/[slug], so all businesses receive this removal. Name fields remain directly editable and existing business-scoped name-only device autofill and its disclosure remain. Verified client lookup, waiver consent/reuse, booking policy, approval/payment flows and records are unchanged. No database migration, settings or environment changes.

Local validation passed: all 361 tests, typecheck and production build. Staging/production deployment verification pending. Feature branch: fix/remove-returning-name-banner. No real booking, signature, email, payment or deletion should be generated for QA.
