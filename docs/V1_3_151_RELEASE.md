# v1.3.151 release handoff — Consolidated booking history and bulk expansion (validation in progress)

Shared Client History and business History consolidate explicitly linked requests, canonical appointments, booking payments, attendance, ledger use and booking messages into one booking in All activity and Bookings. Independent visits never merge by client/date. The summary separates booking acceptance from recorded payment, pending payment, membership coverage and zero-cost visits. Expand the booking timeline for retained lifecycle records; saved submission/review timestamps and rescheduled canonical visit details remain available. Payment and other category tabs retain their individual source entries.

Grouping happens before search, date filtering, counts, sorting and pagination. A matching lifecycle event keeps the complete booking visible. Group selection maps to existing source-entry hashes; hiding history preserves operational records, financial evidence and stale/foreign selection checks. Paid state remains accurate when a payment history entry is hidden. No migration or billing mutation.

A shared arrow control expands/collapses all native disclosures in the current history page, Booking Status and individual client Sessions view. Each disclosure can still toggle independently with keyboard support. Business palettes and mobile horizontal scrolling remain.

Feature branch `feature/consolidated-booking-history`. Tests, builds and staged/production verification pending. Source v1.3.151; last verified LIVE runtime v1.3.150. No real customer records are changed for QA.

