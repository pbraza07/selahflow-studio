# v1.3.125 — Central question manager

## Owner instructions

Open Settings → Questions. Choose Booking registration or Membership registration. Booking defaults to all questions; choose a service or session in Question scope to manage its existing required overrides and create a question with that target. Create/edit labels, types, choices, visibility, scopes and ordering here. Required and Show in push notifications and business alert emails are independent. Save questions publishes via the existing authenticated business settings form. Page changes retain existing draft/discard protection.

Each standard/custom question has its own requirement and notification checkbox. First name, last name and date of birth remain required and are explicitly marked as needed for unique client ID creation/verification. Their notification display remains optional. Existing service requirements add to global requirements; session overrides retain their existing rules. No existing question choices are automatically reset. Legacy notification preferences remain the fallback until an explicit choice is made.

Appointment facts in push notifications and approval-review card display choices are also managed here, in separately labeled details panels. Notifications Settings now contains delivery/channel/reviewer/device setup only. Service Catalog and individual sessions no longer embed question editors. Memberships has no redundant question editing entry point. Existing customer answers remain read-only where displayed in client/history views; operational collection of answers remains available.

## Data and validation

No migration, environment variable, database connection or provider changes. Saved question IDs and historical answer labels remain intact. Existing quota limits and server-side tenant/registration validation remain. Moving a question off a form cleans obsolete notification/order/required references so it can be saved. No real customer records, bookings, emails, payments or push notifications created for QA.

Automated checks and staging/production deployment verification pending. Private owner browser acceptance has not been performed.
