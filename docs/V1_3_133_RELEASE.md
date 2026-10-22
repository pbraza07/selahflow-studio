# v1.3.133 — client profile synchronization and email recovery

Verified LIVE October 22, 2026.

- Application SHA: `61e74d5e8fae74ddf588255804a5a842ac47359d`; tree `f28eb0b296070e109a7a23785b0bd1b102adf617`.
- Staging: `dep-dbd8706i0phs73fjt6ig`, LIVE 5:49:39 p.m. EDT.
- Production: `dep-dbd8atek1f9s738s9he0`, LIVE 5:53:27 p.m. EDT.
- Saved branch: `feature/client-profile-sync-email-recovery`; PR #59 merged.
- Documentation-only [skip render] commits may follow this application SHA.

## Owner workflow

Clients → select client → Edit client. Current first/last name, birth date, email, phone, profile answers across booking/membership/service/session scopes, saved removed questions, imported values and notes are editable. Unique IDs follow initials + MMDDYY and cannot collide within a business. Contact-only corrections preserve waiver reuse; identity corrections retain the original signed evidence and require fresh consent. Original completed bookings, enrollment answers and financial records remain evidence.

Linked membership contact/identity rows update in the same transaction. Membership attendance history shows current profile answer overrides, and the view refreshes every 15 seconds/on focus. Membership plan/credit updates continue through membership controls and refresh Clients. Contact sync reads current Clients data; stale unsent communication snapshots are skipped instead of sent to the old identity.

Settings → Client communications → Delivery details shows recorded failure reasons and retry timing. Retry rejected emails only retries confirmed failed/not-configured outcomes after provider, branding, current-contact and staging-recipient checks. Submitted and unknown outcomes are never replayed. Preview must be less than 24 hours old; changed contacts/branding require a fresh preview.

Production uses the existing platform email connection; no separate mass-email account is required. Staging communications remain restricted to approved test addresses. Background worker must be enabled. No secrets are returned to owners.

## Verification

Local, GitHub Actions run 39858989134 / job 120104474457 and Render staging each passed all 354 tests with zero failures/skips, typecheck and build. Production build passed. Live read-only smoke checks passed for five staging/four production businesses: health/version, tenant catalogs, protected routes, privacy/checkbox/communication styles and push readiness. Migration 058 applied to the dedicated staging/production databases; each preflight confirmed schema CREATE and zero unowned tables. Final startup error-level log query returned no entries. A temporary Render log-retrieval 503 was resolved by a later check.

A preliminary staging validation failed because synthetic email-recipient fixtures inherited deployment restrictions. Corrected fixtures passed with explicit synthetic environments and with staging settings; the final staging deployment passed all 354 tests.

Owner UI inspection confirmed editable identity/contact/question/import/note controls without saving real records. Production owner communications confirmed Gmail connected, no disabled-worker warning, no separate mass-email account needed. Profile update, tenant authorization, financial/original evidence retention, stale edits, ID collision/deletion/reuse and returning prefill are tested against synthetic PostgreSQL records. Actual customer profile writes, payment/charge/deletion tests and mobile device acceptance were not performed.

## Failed email diagnosis and recovery

The existing one-recipient staging test campaign exhausted its attempts with `not_configured`: `External staging notifications are disabled for this recipient`. Gmail was connected. Added only a separate `STAGING_COMMUNICATION_EMAILS` approved test address using a merged environment update, preserving the existing notification allowlist and all other environment values. The global staging enablement and other notification restrictions still apply; no production configuration changed.

Retried the original rejected campaign once in owner UI. Its final history is Submitted 1, Pending 0, Failed 0, Unknown 0, Skipped 0. Provider acceptance by Gmail is verified; inbox delivery is not independently confirmed. No new QA campaign or production QA email was sent. Contacts still deduplicate shared family addresses. No customer profile data was edited for QA.

Production use: Settings → Client communications → Sync client contacts → choose recipients → compose → Preview → Send. Owners add/edit contact data in Clients; current membership details and returning prefill follow those corrections. Staging can send only to approved test addresses. Delivery details explain failures; rejected-only Retry is available after correction. Contacts/branding changes or previews older than 24 hours require a fresh preview. Unknown/submitted outcomes cannot be replayed.
