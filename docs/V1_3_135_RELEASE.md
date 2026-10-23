# v1.3.135 — application-managed staging recipients and delivery evidence

Status: verified LIVE in staging and production on October 23, 2026.

Application commit `b1011a21abb5431a3dd4133bf8dec663a3f145b8`, tree `b6b2e1c8afa72dcd339d080c19954b0a7730b731`. Staging `dep-dbdjs36i0phs73a2aa9g` LIVE 7:05:42 a.m. EDT; production `dep-dbdk125bedkc73d393s0` LIVE 7:11:52 a.m. EDT. Saved branch `fix/app-managed-test-email-delivery`; PR #61 merged. Documentation-only [skip render] commits may follow this application SHA.

## Owner workflow

1. Add or correct the client email in Clients. Open Settings → Client communications and sync contacts.
2. Select current contacts and preview the message. Preview never sends or approves an email.
3. Confirm Send now. The authenticated server automatically authorizes those exact recipient rows for that campaign. No environment allowlist update or restart is required.
4. Expand Recipient results to see each address, provider acceptance or failure and its provider message ID when available. Rejected emails can be retried; submitted or unknown messages cannot replay automatically.

Global staging notification enablement remains required. Approval applies only to business communications for the authenticated business's current, selected, non-unsubscribed client contacts. It does not grant permission for arbitrary email addresses, another business, SMS or other notifications. Legacy environment test lists remain supported. Production has no staging recipient allowlist requirement.

## Implementation

Migration 059 adds exact-recipient authorization time, provider name and provider message ID. Previously owner-confirmed unsent campaigns retain their authorization; draft, submitted, unknown and cancelled messages are not replayed. Existing consent, identity, membership, financial, booking and suppression records are preserved.

Both Gmail and Resend capture the successful API message ID. A successful HTTP response without a valid message ID has an unknown outcome; it is not automatically retried. Campaign results distinguish provider acceptance from inbox delivery. They show all recipient statuses, not just failures. Finished processing is replaced by provider submission or a prompt to review recipient results.

## Investigation and limits

Before this change, live owner campaign history recorded four submitted recipients for each of the sent test campaigns, with zero failures. Earlier delivery implementation did not retain provider message IDs. No evidence supports claiming that only one recipient was sent a request or that the app redirected the other recipients to the sender. Gmail MIME sends each selected address in a separate To header. The connected Gmail app required reauthentication, so sender Sent/bounce inspection was unavailable. Do not claim inbox receipt or a verified spam/bounce root cause from provider acceptance.

## Validation

Local, GitHub Actions run 39942873081 / job 120378335260 and Render staging each passed all 358 tests, zero failures/skips, typecheck and build. Production build passed. A preliminary local full run had two failures: an older mock lacked the newly required provider message ID, and the source-version continuity header had not yet been written. Both were corrected before the final complete successful run. Read-only live health/catalog/protected-owner/communications/style/push checks passed across five staging and four production businesses. Actual runtime database preflights confirmed the dedicated databases/users, schema CREATE true and zero unowned tables; migration 059 applied successfully in both. Final startup error-level query returned no entries.

Signed-in staging owner UI verified automatic recipient guidance, review and explicit send. The latest existing four-recipient test draft was sent once under the user's request to verify all selected recipients. Final history: submitted 4, pending 0, failed 0, unknown 0, skipped 0. Each address has its own distinct Gmail message ID, confirmed persisted after syncing contacts. No previously submitted or unknown message was replayed. Actual inbox receipt, sender bounce review and iPhone hardware acceptance are unverified. No production emails, new QA campaigns, profile/membership edits, payments or deletions were performed. Existing environments, credentials, database connections and unrelated customer records were preserved.

Synthetic end-to-end staging coverage verifies four current contacts without environment allowlists, separate MIME destinations, four unique Gmail message IDs, persisted authorization and receipts, foreign-owner rejection, no approval on preview, disabled staging delivery, SMS separation and no replay. UI coverage checks automatic approval guidance and every recipient result.
