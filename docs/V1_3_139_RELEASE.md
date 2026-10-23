# v1.3.139 release handoff — local validation passed; deployment pending

Move owner Stripe connection status, hosted onboarding and Verify Stripe into a dedicated Settings → Stripe payments category. Memberships links to this category and retains membership plans, invitations, credit settings and recurring billing controls. Stripe onboarding return/retry URLs reopen payment settings. Shared across all businesses; existing owner authorization, active-business scope, merchant account IDs, financial records and server configuration remain unchanged. No migration or environment changes. Local typecheck, all 363 tests and production build passed. Live staging/production validation is pending.

