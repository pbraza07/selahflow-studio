# Production client email investigation — October 26, 2026

Production v1.3.147 at a97270c reports `not_configured` for booking payment-link and payment-confirmation messages. Startup previously reported Gmail configured, which checks the stored connection rather than a live OAuth exchange or inbox delivery. The exact provider blocker is not yet verified.

This diagnostic-only patch adds read-only, privacy-safe startup reporting of server setup, Gmail reconnection state, and aggregated active-business email failure reason codes. It does not change message eligibility, retries, approval rules, payment handling, providers, credentials, database schema, customer records, or send any test email. Unknown provider details are replaced with a generic code; recipient identities and token values are never logged. Runtime version remains 1.3.147; identify this operational patch by its deployment commit.

Five targeted tests passed locally. Full validation and staging/production deployment must be checked before claiming rollout. Email restoration is not established by these tests. Google consent, if required, must be completed by the authorized account holder through the existing platform Gmail connection flow. Do not transplant staging credentials or replay already submitted/ambiguous messages.
