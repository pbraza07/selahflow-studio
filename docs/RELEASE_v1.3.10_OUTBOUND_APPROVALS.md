# SelahFlow 1.3.10 — Email/SMS review deployment guide

## Business owner setup

1. Sign in at `https://selahflow.onrender.com/studio/{slug}`, then open **Settings**.
2. Enable **Booking approval notifications** and choose the reviewer (**Business owner** or a specific team member).
3. Tick **Email** and/or **SMS**. For owner delivery, account email is the default unless replaced in the notification email field. Enter owner mobile in international E.164 format (US example `+18135550123`).
4. For staff delivery, enter the selected staff member's notification email/phone in **Your team**.
5. Save Settings. The provider readiness panel shows Email (Resend) and SMS (Twilio) configuration statuses.
6. On a new request, owner/staff receives a link for that *single* request and can choose Accept or Decline. Link expires after 72 hours. Simply opening the URL performs no action. Confirm on the page to POST a decision.
7. The owner dashboard shows provider status for each pending request. **Retry unsent notifications** attempts unsubmitted channels (maximum three attempts/channel/hour). Previous accepted provider submissions are not resent.
8. Approved requests update the calendar transactionally. Declined requests never create a calendar event.

## Render environment configuration

Configure the following **secret** environment variables in the **SelahFlow Render web service**, never in client-side code, the owner Settings form, or GitHub source.

| Feature | Render environment keys | Purpose |
| --- | --- | --- |
| Email (Resend) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | HTTPS POST to `https://api.resend.com/emails`; sender must be verified |
| SMS (Twilio) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | HTTPS POST to Twilio Messages API; sender must support SMS |
| Application URL | `APP_URL=https://selahflow.onrender.com` or Render-provided `RENDER_EXTERNAL_URL` | Produces trusted HTTPS review links |

The backend **never stores raw provider credentials**, and API responses show configuration readiness only. If keys are missing, the message is **not sent** and the UI says `not_configured`. No fabricated delivery success, and no blocking of in-app approvals. Email/SMS provider responses of 2xx are recorded as **submitted**, which is not verified device delivery. Delivery receipts/webhooks are not included in this release. SMS consent and U.S. A2P 10DLC registration may be required.

## Privacy, consent and security
- The registered owner manages reviewer address/phone. Restrict messages to recipients authorized by the business owner; do not send marketing.
- Review links are backed by cryptographically random 256-bit tokens. Only a SHA-256 hash is stored, and the link is valid for 72 hours.
- The GET review endpoint is read-only. Accept or Decline requires a second explicit POST request from the review page and is serialized with booking calendar transactions.
- Link authorizes review of one request, not all bookings. Do not forward to others. Owner/staff inboxes remain authenticated separately.
- Reviewer changes can invalidate link access; a reviewed request can no longer be processed again.
- Browser preview and short messages avoid leaking other business/customer data. Avoid logging SMS/Email secret tokens.

## Limitations
Without configured and verified Resend/Twilio credentials, external delivery is unavailable. This release does not provide background retries or direct push notifications. Customer confirmation emails are not yet connected. Existing in-app review notifications remain working.
