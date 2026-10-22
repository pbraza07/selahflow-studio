# v1.3.126 — Team privacy and booking defaults

## Owner instructions

- Settings → Team members: create or edit a member and check Hide from client booking, then save. The member is removed entirely from the public team dropdown; the owner still sees the member and can assign sessions and private tracking. Existing members remain visible unless the owner changes this setting. The older business-wide Hide team names option retains its separate name-masking behavior.
- Settings → Service catalog: select a qualified Default team member for a service, then save. A default can be a hidden member. With a single service (or multiple services sharing the same default), the client does not choose a team member. Different defaults in a combined booking require a visible qualified selection or separate bookings.
- Settings → Bookable sessions: choose Default session host. Enable Use the assigned host automatically. New sessions start with this enabled; existing sessions retain their setting. Hidden hosts always use automatic assignment. Choose additional Default tracking team members for owner-only accountability. The primary host still controls capacity and scheduling; extra tracking members do not reserve extra staff slots.
- Selecting a dated session uses that session's host, ahead of any service default. The booking page skips the team dropdown for automatic assignments. Hidden names do not appear in session cards, confirmations or newly generated client receipts; generic Session team wording can identify the assigned team without exposing a private member.
- Owner dashboard → Team accountability: select a date/time to see scheduled default hosts, saved booking host records, and private dated/series overrides. A dated tracking assignment can record the actual team separately. New bookings snapshot the assigned host/team IDs so later default edits do not rewrite their tracking history; old bookings retain their original primary staff ID. This is accountability tracking, not payroll or proof of attendance.

## Boundaries and verification

Staff qualification, exact session date/service/start and business ownership are checked server-side. A forged hidden team ID cannot be used for arbitrary public appointments; it must be the configured service default or the exact session host. Missing/default service selection and recurring session assignment are tested through the actual public booking handler with a synthetic database. No database migration or environment/provider changes. Existing bookings, pricing, capacity, approval/payment, IDs, questions and waivers are preserved.

Automated tests, builds and staging/production verification pending. No real customer bookings/messages/payments or private owner preference changes are created for QA. Authenticated owner browser acceptance remains pending.
