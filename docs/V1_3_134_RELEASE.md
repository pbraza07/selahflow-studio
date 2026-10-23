# v1.3.134 — saved email draft review and send

Verified LIVE October 22, 2026.

- Application SHA: `910a4beab615abbf7477ca3b27829f7633a99cbe`; tree `e82e0df7330286d947daf856028bd9e2a073ad43`.
- Initial staging app validation: `dep-dbdb49t9fdbs73aglrb0`, LIVE 9:08:48 p.m. EDT.
- Production: `dep-dbdb88tg1s2s73dfokn0`, LIVE 9:12:38 p.m. EDT.
- Final staging configuration validation: `dep-dbdb8bbrjlhs73cm4sfg`, LIVE 9:17:37 p.m. EDT, same application SHA.
- Saved `fix/send-saved-email-drafts`; PR #60 merged. Documentation-only [skip render] commits may follow this application SHA.

## Cause and owner workflow

Preview saved a durable draft but the Send button existed only in temporary page state, below a tall email preview. Refreshing or changing sections removed that state. History had no way to reopen the draft, and its action column was off-screen on narrow devices.

Owners now use Settings → Client communications → Communication history → Review & send beside a draft. Review restores the saved subject, message, optional button, recipients and business-branded preview. Send now appears before the preview and stays in a sticky toolbar. Confirming Send queues background delivery automatically. Opening a review or saving business settings never queues emails.

Preview creation scrolls to the review panel. Mobile history stacks into labeled cards, keeping every action within the screen width. Status explains Draft · awaiting Send. Close review preserves the saved draft, which can be reopened later.

Changed contacts/branding, expired previews and invalidated draft recipient rows require a fresh preview. Their message content is loaded so owners can refresh it. Staging recipient restrictions are shown before sending; production uses the existing configured provider. Final queueing rechecks all existing safeguards and stays idempotent. Submitted/unknown campaigns cannot be reopened as drafts or replayed.

## Validation

Local, GitHub Actions run 39881683033 / job 120180256391 and both Render staging validations passed all 356 tests with zero failures/skips, typecheck and builds. Production build passed. Focused real PostgreSQL/API and React handler tests cover saved-draft restoration after reload, no send on review, exact campaign ID/confirmation, tenant/auth protection, expiry/branding/contact changes, invalidated recipient rows, staging restrictions and prevention of replay. Mobile history cards and toolbar ordering/style rules have automated coverage.

Read-only live checks passed for five staging/four production businesses: health/version, public catalogs, protected owner/draft-review APIs, served styles and push readiness. Runtime preflights confirmed dedicated staging/production databases and users, schema CREATE and zero unowned tables. Error-level log query from production startup through final staging restart returned no entries. No schema changes for this release; existing memberships, client synchronization, signatures, payments and tenant data remain unchanged.

Signed-in staging review restored the reported draft and its three selected recipients. Before the configuration update, review clearly identified two unapproved staging addresses. Retained the previously approved communication test recipient and added only those two selected addresses to `STAGING_COMMUNICATION_EMAILS` through a merged Render environment update. Original general notification allowlist/global restrictions and other environment keys were preserved; production environment values were unchanged. The update triggered a second staging deployment of the same tested code.

After that deployment became LIVE, reopened the same draft: Send now to 3 email addresses was enabled and the staging warning was absent. It stayed Draft · awaiting Send, with no emails queued by review. Production owner UI reports v1.3.134/Gmail connected and shows the updated instructions. No actual emails or new campaigns were sent/created for QA; no customer profiles, memberships, payments, signatures or deletion settings were changed. Actual iPhone/mobile-device and inbox-delivery acceptance were not performed.
