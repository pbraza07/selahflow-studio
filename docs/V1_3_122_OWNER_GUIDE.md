# v1.3.122 owner guide

- Memberships → Members: create or select the member and choose **Send for payment**. The member receives a private, expiring link with their ID, plan, monthly session allowance, price and recurring terms. Sending the email does not activate or charge the membership. The parent must authorize recurring payment in Stripe.
- Membership plan editor: set the billing interval and frequency. For an enrolled Stripe member, **Customize recurring billing** schedules the change for the next renewal. The current paid period is retained; the action creates no immediate invoice. An already scheduled subscription requires Stripe review before another schedule is created.
- Member → **Override initial date**: choose a past or current initial date for monthly billing. Future billing follows that anniversary, with short months using their final day and later months returning to the original day. Existing sessions used are preserved. Changing an unpaid member's date does not activate it.
- Monthly session allowance resets from the initial paid/overridden anniversary and does not roll over. Billing frequency and monthly credit allowance are separate: a yearly or multi-month payment still has monthly session periods. Unpaid/expired periods do not grant new credits.
- Memberships → Coupons: create a business coupon with description, percentage or fixed discount, first-invoice or ongoing duration, and optional expiry. Members enter and apply it on membership checkout; the server and Stripe validate it again.
- Clients: open **+ Booking timeline** to see the booking's events. The payment column updates from payment evidence and shows Pending in red or Completed in green. A covered eligible membership requires no extra session charge.
- Every public service booking starts pending owner approval. After approval, clients can pay using their private email link or verified lookup. Confirmation text explains that participation depends on approval and any payment due.
- Membership history: select a month to review attended service names and session activity under the member ID.
- Owner Overview → team tracking: assign staff to a configured session and save private accountability notes. Enable the checkbox to hide team names in the public booking view.
- The participation waiver includes a separate optional media statement and consent checkbox. The signed record stores the choice and exact statement. Prior signatures never imply media permission; existing participation consent reuse remains intact.

Older manual memberships are initialized from their last recorded payment date. Owners can use Override initial date to correct a historical start date when needed.

Payment and email readiness depend on that business's connected Stripe account and configured sender. No live customer transactions or emails were created during release validation.
