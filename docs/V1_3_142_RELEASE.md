# v1.3.142 — business knowledge assistant

Deployment pending. Previous verified LIVE version: 1.3.141.

The shared assistant reads current saved public content for the selected active business on every question. Its allowlisted knowledge includes profile and booking wording, services, prices/durations, hours/location/contact, policies, active membership plans and credit eligibility, public team names, registration question definitions/options, the next 31 days of configured sessions, and version-reviewed waiver clauses including media release. It provides source links and routes visitors to booking for live availability. Owners should save their page edits before testing.

Clients, private member balances, question answers, signed waivers, hidden team members, notification addresses and internal settings are excluded. Conversations are not persisted. Unknown information directs visitors to the business. This expands factual published-information search; it does not configure a generative provider or third-party scraping service.

Available in owner dashboard and public business home, booking and membership pages. Existing owner handoff remains explicit and truthful about no email/SMS delivery. Public visitors get contact information rather than an unauthenticated inbox write.

No migrations, environment variables, credentials or business/customer record mutations are required. Existing data, Stripe setup and billing are preserved.

## Validation

Local validation passed: all 371 tests, TypeScript checks and production build. CI, staging and production checks remain pending. Four new tests exercise factual retrieval, unknown questions, changes without reindexing, reviewed media clause, script stripping, hidden staff, tenant isolation, active records, actual API validation and no-store. No real booking, email, signature or payment is needed for QA.
