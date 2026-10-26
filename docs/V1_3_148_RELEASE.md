# v1.3.148 release handoff — Weekly membership allowances (validation in progress)

Memberships → Create/Edit membership plan adds a choice between the existing fixed monthly allowance and 1, 2 or 3 sessions per week. A membership month follows the initial business date (or owner override) to its next monthly anniversary, clamping short months without drifting the original day. Seven-day blocks restart at each monthly anniversary; a remaining partial fifth block receives the weekly allowance. No weekly rollover. Billing frequency remains independent; use Monthly / every 1 month for a monthly paid term.

A nullable plan column in additive migration 061 leaves every existing plan in its current fixed-monthly mode. Owners opt in per plan; a plan rule applies to its linked members. Existing payments, history and records are retained. Public plan cards, payment invitations, payment confirmations and business-assistant knowledge explain the chosen usage rule.

Owner-scoped server checks serialize with the existing business schedule lock. Pending membership-covered requests and confirmed bookings reserve the appointment week's allowance. Decline/cancellation releases it; no-shows count. Approval excludes its own pending reservation. Paid-period boundaries and service eligibility remain enforced. Session rescheduling rolls back if it would exceed a weekly allowance. Payment allocations and monthly refreshes account for four/five weekly blocks; late attendance is recorded in the ledger without consuming the new month's total.

Feature branch: `feature/weekly-membership-allowance`. Validation and deployment evidence will be added after completion. No live customer payment, signature, email or member-setting edit is performed for QA.

