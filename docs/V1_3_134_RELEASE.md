# v1.3.134 — saved email draft review and send

Implementation complete; deployment verification pending.

## Cause and owner workflow

Preview saved a durable draft but the Send button existed only in temporary page state, below a tall email preview. Refreshing or changing sections removed that state. History had no way to reopen the draft, and its action column was off-screen on narrow devices.

Owners now use Settings → Client communications → Communication history → Review & send beside a draft. Review restores the saved subject, message, optional button, recipients and business-branded preview. Send now appears before the preview and stays in a sticky toolbar. Confirming Send queues background delivery automatically. Opening a review or saving business settings never queues emails.

Preview creation scrolls to the review panel. Mobile history stacks into labeled cards, keeping every action within the screen width. Status explains Draft · awaiting Send. Close review preserves the saved draft, which can be reopened later.

Changed contacts/branding, expired previews and invalidated draft recipient rows require a fresh preview. Their message content is loaded so owners can refresh it. Staging recipient restrictions are shown before sending; production uses the existing configured provider. Final queueing rechecks all existing safeguards and stays idempotent. Submitted/unknown campaigns cannot be reopened as drafts or replayed.

## Validation

Focused API/PostgreSQL and actual React handler tests passed. Full suite, typecheck/build, CI and staging/production verification pending. No schema/environment changes or real customer email sends are required for validation. Existing memberships, client synchronization, signatures, payments and tenant data remain unchanged.
