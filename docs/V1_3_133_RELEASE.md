# v1.3.133 — client profile synchronization and email recovery

Implementation pending deployment verification.

## Owner workflow

Clients → select client → Edit client. Current first/last name, birth date, email, phone, profile answers across booking/membership/service/session scopes, saved removed questions, imported values and notes are editable. Unique IDs follow initials + MMDDYY and cannot collide within a business. Contact-only corrections preserve waiver reuse; identity corrections retain the original signed evidence and require fresh consent. Original completed bookings, enrollment answers and financial records remain evidence.

Linked membership contact/identity rows update in the same transaction. Membership attendance history shows current profile answer overrides, and the view refreshes every 15 seconds/on focus. Membership plan/credit updates continue through membership controls and refresh Clients. Contact sync reads current Clients data; stale unsent communication snapshots are skipped instead of sent to the old identity.

Settings → Client communications → Delivery details shows recorded failure reasons and retry timing. Retry rejected emails only retries confirmed failed/not-configured outcomes after provider, branding, current-contact and staging-recipient checks. Submitted and unknown outcomes are never replayed. Preview must be less than 24 hours old; changed contacts/branding require a fresh preview.

Production uses the existing platform email connection; no separate mass-email account is required. Staging communications remain restricted to approved test addresses. Background worker must be enabled. No secrets are returned to owners.

## Verification

Full checks, deployed SHA, migration and live verification pending. Failed campaign investigation pending live diagnostic UI. No real customer writes/messages used for QA.
