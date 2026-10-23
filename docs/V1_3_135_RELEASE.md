# v1.3.135 — application-managed staging recipients and delivery evidence

Status: candidate; staging and production verification pending.

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

Pending final verification. Synthetic end-to-end staging coverage verifies four current contacts without environment allowlists, separate MIME destinations, four unique Gmail message IDs, persisted authorization and receipts, foreign-owner rejection, no approval on preview, disabled staging delivery, SMS separation and no replay. UI coverage checks automatic approval guidance and every recipient result.
