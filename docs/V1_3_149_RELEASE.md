# v1.3.149 release handoff — Membership classification badges and safe checkout expiry (validation in progress)

Assigned memberships keep their plan/type classification badge across payment-pending, exhausted, expired and canceled states, with explicit status text. Clients without a membership retain the neutral ID badge. Plan custom badge overrides and membership-type inheritance remain intact. Display changes do not activate credits or change payment/booking eligibility.

Confirmed owner deletion now verifies the exact business/source/account with Stripe and expires only unpaid open Checkout sessions; already expired sessions are accepted. Includes booking checkouts, initial membership checkouts without commissions and commission reservations. Paid/processing payments, provider/identity failures and active subscriptions stop deletion before local records are removed. Actual canceled/expired-subscription references are checked at Stripe. Retry after provider expiry/local rollback remains safe. Operator maintenance retains its strict preconditions. No provider refund or subscription cancellation is performed.

Membership-only deletion now retains settled financial facts, detaches provider receipt/commission references and membership request links, and preserves unrelated bookings. Full client deletion retains its existing explicit confirmation, business scope, email-processing lock, accounting retention, signed-waiver separation, tombstones and ID release. No actual client is deleted for QA.

Feature branch `fix/membership-classification-delete`. Tests/builds and staging/production promotion pending. Source v1.3.149; prior verified runtime v1.3.148.

