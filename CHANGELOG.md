# v1.3.237 release handoff — Clients inside bookable sessions

Release source: v1.3.237

Owner daily, weekly and monthly calendars place linked clients inside the matching bookable session, with independently clickable client details and session roster actions. Daily attendees scroll within the session instead of occupying separate overlap columns. Matching requires session occurrence ID, date, staff and start time; unmatched appointments remain visible. Existing capacity, payment and attendance rules are unchanged. No migration or customer record changes.

Verified LIVE in staging and production on November 12, 2026 via PR #172. Staging commit a1c236a9056144674a760d7ffb234456c909794a, deploy dep-dbqtehgn74is739enmg0 LIVE 15:26:42 UTC. Production merge 2b9300899213d2712ff2f98f81262e54975c2da2, deploy dep-dbqtlfh5efls73fekjj0 LIVE 15:28:48 UTC. Identical application tree a100fae7fa21a8c9d958fb4582529e301a04869a. Staging passed 779/779 tests, TypeScript and build. GitHub workflow 43245194659 passed web and native checks. Both environments passed live health/version, booking/payment shells, protected-owner APIs and invalid-invitation checks; no error-level entries in checked startup windows. No customer records changed. Browser screenshot validation was blocked by local sandbox restrictions; signed-in visual acceptance remains unverified. User approved publication/deployment after the initial approval block. Documentation-only commits follow the live application commits.

# v1.3.236 release handoff — Product catalog and client-linked commerce

Release source: v1.3.236

Service catalog now includes products with prices, descriptions, compressed WebP pictures and archive/restore. Services and active products share the package catalog allowance, enforced under the existing owner schedule lock including individual overrides. Public business pages show a product carousel and link to pickup checkout. A client supplies first/last name plus email, phone or Member / Client ID; matching stays business-scoped and ambiguous identities are rejected. Product purchases do not consume membership sessions.

Owners explicitly accept separate product commission/cash collection authorization and confirm business tax responsibility and pickup address. Stripe Tax settings and active local registrations must be verified before checkout opens. Owners choose product tax categories; no tax registrations or legal consent are fabricated. Checkout uses Stripe Tax performance locations and native tax reporting; cash/Zelle tax transactions are recorded only after owner receipt confirmation. First paid product order per client/business carries exactly 10% of product subtotal, excluding tax and with no minimum; subsequent product orders have no commission. Product fees are independent of booking/membership fees. Cash/Zelle fees join existing monthly statements after verified billing authorization. Prices, tax, identities and fees are server-owned; payment notifications are signed and idempotent. Products/order snapshots and client purchase history are retained.

Migration 100 adds product catalog, checkout settings and product orders, and extends the existing commission category. Feature branch feature/product-catalog. Local full regression passed 778/778 tests; final targeted commerce, deletion/retention and webhook setup checks passed 19/19. TypeScript and production build passed. Staging/production deployment remains pending; v1.3.235 is the last verified LIVE release. No real purchases, cash receipts, tax registrations or business authorizations have been submitted for QA. See docs/v1.3.236-verification.md.

# v1.3.235 release handoff — Gmail connection monitoring and recovery

Release source: v1.3.235

The shared Gmail sender now verifies authorization in the background every five minutes. Temporary token-service failures use persisted exponential backoff (one to 15 minutes), recover automatically and pause outgoing messages without consuming delivery attempts. Refresh-token rotation is encrypted. Invalid grants or missing sending permission require fresh Google consent; client configuration errors remain distinct and recover after repair. Existing legacy reconnect flags receive one verification. Primary administrator settings show live check/retry timestamps and persistent outage alerts, refresh every minute and offer a protected Check connection now action. Explicit disconnect stops recovery. No inbox access, fallback sender, test message or customer-data changes.

Migration 099 adds private connection-health fields and incident IDs. Workers serialize refresh/reconnect/disconnect with the existing transaction advisory lock. Privacy-safe health heartbeats support an independent conditional notification channel; deployment alone does not create ChatGPT automations or grant device notification permission. Authorization health is not proof of message delivery. Existing ambiguous-send protections and staging recipient restrictions remain.

Verified LIVE in staging and production via PR #170 on November 11, 2026 UTC. Both local and staging suites passed 771/771 tests; TypeScript, production builds, GitHub application/native checks, live endpoint checks and protected Gmail API checks passed. Production authorization heartbeats are healthy with automatic refresh verified. Staging separately reports needs_reconnect and requires Google approval. An independent hourly ChatGPT condition watch was enabled for production. See docs/v1.3.235-verification.md.

# v1.3.234 release handoff — Calendar overlaps and waiver policy terms

Release source: v1.3.234

Daily schedules show every non-canceled booking at its actual start time, including published-session attendees, simultaneous bookings and appointments outside normal hours. Overlaps use separate readable columns with horizontal scrolling; rosters and booking details remain independently selectable. Week/month lists also include all attendees, and bookings for removed team members remain visible.

Updated legacy and category waiver previews begin with numbered recurring-membership billing/cancellation and 24-hour notice/no-show deduction clauses. Participation version 3 requires fresh consent after a new completed legal review is recorded. Previously reviewed versions 1/2 and unmodified category documents retain their exact text, hashes and signatures until explicit activation. No legal review was fabricated or carried forward. No automatic cancellation-notice engine, provider billing change, migration or real client modification.

Verified LIVE in staging and production as v1.3.234 via PR #169 on November 10, 2026 UTC. Local and staging regression passed 764/764 tests; TypeScript, production builds, GitHub web/native validation and live read-only endpoint checks passed. Revised waiver terms require a new completed legal review before activation. Browser restrictions prevented visual/signed-in owner acceptance. See docs/v1.3.234-verification.md and docs/v1.3.234-waiver-amendments.md.

# v1.3.233 release handoff — Past booking membership deduction

Release source: v1.3.233

Owner past booking details default to Use 1 membership session when a Membership / Client ID is entered. The owner can uncheck it for a record-only visit. Saving applies the existing audited current-balance override and records Checked in in the same transaction as the appointment and slot locks. Invalid, exhausted, reserved or ineligible credits roll back the booking. Public/team overrides are rejected; existing attendance and ledger guards prevent duplicate debits. The success view shows the deduction and remaining balance with no separate payment due. Existing visits can use Membership/Packages → Apply to past visit. No migration or bulk historical rewrite.

Verified LIVE in staging and production as v1.3.233 via PR #168. Local and staging suites passed 759/759 tests; TypeScript, production build, GitHub application/native checks and live read-only endpoint checks passed. No real client record changed. The owner browser session did not persist, so the reported existing visit still requires Apply to past visit from a signed-in owner session. See docs/v1.3.233-verification.md.

# v1.3.232 release handoff — Owner booking client ID prefill

Release source: v1.3.232

Owner booking details now accept an optional Membership / Client ID, including past bookings. The existing tenant-scoped lookup restores saved contact information, birth date and valid registration answers. Lookup changes clear previous details; cancellation guards prevent stale responses from populating another client. Confirmation waits for a successful lookup when an ID is supplied; Clear ID restores manual entry. Name/email stay tied to the loaded identity. The server validates explicit IDs against the owner's roster and matching client identity, then retains the ID on the booking; matching names alone cannot override an explicit selection. Existing capacity, waiver, attendance and credit rules remain. No migration. Save errors use the dialog's error callback.

Verified live on staging and production as v1.3.232 via PR #167. Local and staging passed 758/758 tests; TypeScript, production build, GitHub validation and live read-only checks passed. No actual customer booking created for QA. See docs/v1.3.232-verification.md.

# v1.3.231 release handoff — Past booking continuation

Release source: v1.3.231

The owner booking wizard no longer silently requires a five-character reason above the time list. Past booking notes are optional on the details step; submission records an automatic owner audit reason with any supplied note. Choosing a time advances to client details. Continue explains when a time still needs selection, valid selections survive availability refresh, past-mode changes refresh availability and late responses cannot clear an advancing selection. Save errors appear inside the dialog, and steps scroll/focus into view. Existing server owner-only, ended-time, capacity, service and waiver checks remain. No migration.

Verified live on staging and production as v1.3.231 via PR #166. Local and staging passed 753/753 tests. TypeScript, production build, GitHub validation and live read-only checks passed. No real booking submitted for QA. See docs/v1.3.231-verification.md.

# v1.3.230 release handoff — Past booking creation and free membership deletion

Release source: v1.3.230

Owners can explicitly create past session templates and record ordinary past appointments with an audit reason. Owner availability includes ended time slots; public/team overrides remain rejected. Existing capacity, conflicts, service and waiver validation remains.

Migration 098 fixes deletion of memberships and clients with retained $0 Stripe receipts. The old constraint required a membership link even after deletion detached that link, rolling back removal. Zero-total detached receipts are now retained without losing provider replay protection; negative receipts and zero-total booking receipts remain rejected. Both deletion APIs explain the legacy constraint failure clearly. Synthetic tests reproduce the failure before migration and successful deletion afterward. No real client was deleted for QA. Verified live on staging and production as v1.3.230 on 2026-11-06 UTC via PR #165. Local and staging suites passed 750/750 tests; TypeScript, production build, GitHub validation/native checks and read-only live checks passed. Migration 098 applied in both dedicated databases. No real client was deleted for QA. See docs/v1.3.230-verification.md.

# v1.3.229 release handoff — Owner past-session overrides

Release source: v1.3.229

Owners can add a client to a published session that already ended using an explicit past-session checkbox and reason in the calendar roster. Public and team booking cannot use this override; capacity, conflicts, service and waiver rules remain enforced. Membership/Packages now offers Apply to past visit, debiting one current unreserved session for a matching past visit, including before activation or outside the weekly schedule. Existing attendance is retained; unrecorded confirmed/scheduled visits become Checked in or No-show as selected. Audit records include the owner, reason, visit date and current credit period. Duplicate deductions, other tenants, mismatched identities, paid/open-checkout bookings, exhausted credits and ineligible services are rejected. No migration or historical data rewrite.

Verified live on staging and production as v1.3.229 on 2026-11-06 UTC via PR #164. Local and staging suites passed 749/749 tests. GitHub application/native checks, TypeScript, production build and live read-only route checks passed. No real booking or credit change was used for QA. See docs/v1.3.229-verification.md.

# v1.3.228 release handoff — In-app member deletion

Release source: v1.3.228

Delete member now opens an in-app confirmation identifying the selected enrollment. Canceled memberships with used credits can use the same flow. Typed confirmation is normalized, repeated submissions are blocked, errors stay inside the dialog through background refresh, and successful deletion removes the row before refresh. Existing provider identity checks, cancellation, booking retention and accounting retention are unchanged. Regression coverage exercises canceled free membership deletion with used sessions without a new provider mutation.

Verified live on staging and production as v1.3.228 on 2026-11-06 UTC via PR #163. Local and staging suites passed 743/743 tests; GitHub application and native checks, TypeScript, build and live route checks passed. No real member was deleted for testing. See docs/v1.3.228-verification.md.

# v1.3.227 release handoff — Readable membership badges

Release source: v1.3.227

Shared membership badges separate the plan name, unbroken client ID and status into compact lines while preserving business colors, icons and shapes. Enrollment identity columns retain a readable width and scroll horizontally instead of squeezing names and IDs into vertical text. Enrollment dates use labeled rows; history is a single disclosure without a duplicate client name or badge. No business rules or member records change.

Verified live on staging and production as v1.3.227 on 2026-11-06 UTC via PR #162. All 742 tests passed; TypeScript, production build, GitHub validation/native checks and read-only live route checks passed. Staging and production database preflights passed. See docs/v1.3.227-verification.md for deployment evidence and visual QA limits.

# v1.3.226 release handoff — Guided client actions

Release source: v1.3.226

Client offer selection advances to details/payment; time selection advances to booking review. Scheduled-session selection waits for verified availability and shows focused recovery feedback on failure. Back restores selections and entered details. Multi-service selection remains available with a sticky next-action bar. Step transitions, results, payment-return feedback and errors receive focus and scroll into view with reduced-motion support. Membership progress reflects its two actual steps, and active offers provide Book a session. No booking, registration or payment is submitted by a selection alone. Existing consent, waiver, availability, approval and payment checks are preserved.

Verified LIVE November 5, 2026 UTC via PR #161. Final source 9e77cf73328bc21df227e7d9e50480d3d817bb1c and production merge 2359f9f93f963b1eabe7eac2bf80e41cb1995fde share tree 06152ffc8cc1c93f1dae98e72bda6e787bb73a7f. Local and staging suites passed 742/742 tests; GitHub workflow 42129574435 passed web/native checks, TypeScript and builds. Staging dep-dbmh2195efls73d6d08g became LIVE at 23:41:52Z; production dep-dbmh97c9v7es738scuqg at 23:45:17Z. Both health endpoints report 1.3.226; live read-only route/access checks passed. Dedicated database preflights passed with schema CREATE true and zero unowned tables. No error-level entries appeared in the checked final startup window. Staging browser checks verified service selection, Continue focus, no-availability guidance, direct offer-to-details navigation and Back with the retained offer. No booking, purchase, consent acceptance or real customer changes were submitted for QA. Physical-device, real-provider checkout and signed-in owner acceptance were not performed. Main and staging branches are synchronized; documentation-only commits may follow the live application commits. See docs/v1.3.226-verification.md.

# v1.3.225 release handoff — Package validity and client visibility

Release source: v1.3.225

Owners can create one-time packages with a fixed total session count, no weekly cap, and optional validity of 1–3650 days from verified payment; no-expiry packages and existing recurring/weekly memberships remain available. Validity is snapshotted at enrollment; existing paid packages retain their terms when an offer changes. Expiry blocks new covered bookings and credit use without resetting the balance. Additive migration 097 preserves current plans and enrollments.

Hide from clients checkboxes are available for membership/package offers and services. Hidden offers are excluded from public discovery and new public enrollment; hidden services and their sessions are excluded from public booking, business and team catalogs. Server checks reject forged selections. Owner management, existing bookings, members, and verified private membership invitations remain available. Existing visibility defaults are unchanged.

Verified LIVE November 5, 2026 UTC via PR #160. Final source 46d3645aedf593fbaab7f29999cbf645044aa35e and production merge 62c14a7c2cd27b286c165e28b7297ceb18dd880b share tree cfc05d73259e1bb5d969e914971080f954cfb83e. Final local and staging suites passed all 736 tests; GitHub workflow 42113940005 passed web and native checks, TypeScript and builds. Staging dep-dbmfcv9dj70s73c03gcg became LIVE at 21:54:46Z; production dep-dbmfmn3bc2fs73b56k70 at 21:57:28Z. Migration 097 applied in both dedicated databases; preflights passed with schema CREATE true and zero unowned tables. Both health endpoints report 1.3.225 and read-only live smoke checks passed. No error-level entries appeared in the checked final startup window. Main and staging are synchronized; documentation-only commits may follow the application commits. Authenticated hosted editing and real provider purchases were not exercised. No real customer purchase, hiding, or enrollment change was used for QA. See docs/v1.3.225-verification.md.

# v1.3.224 release handoff — Owner membership deletion

Release source: v1.3.224

The owner Delete member confirmation explicitly cancels the linked Stripe subscription immediately, expires unpaid checkout links and removes the enrollment. The server requires the typed DELETE confirmation. Verified completed zero-total checkouts can be deleted even when an earlier webhook failed before saving the subscription ID. Provider account, tenant, checkout, customer and subscription identities are checked before cancellation; pending paid or processing checkouts still require payment reconciliation. Cancellation requests do not create refunds, prorations or final invoices. Existing bookings and required accounting records are retained. Failed provider verification preserves the local enrollment; retries after external cancellation and local rollback are supported. No migration or real member deletion was performed for QA.

Verified LIVE November 5, 2026 UTC via PR #159. Release source aab5e74ebe159b8bbee97ee880da8c77bf8b3bf6 and production merge 0e8672fb7e3dfb65c1a4502bf2a1330dc0e3da89 share tree fb014020751de0aed3b8044907b740522768ebcd. Local regression suite passed 731/731 plus all 3 additional cancellation tests; TypeScript and production build passed. GitHub workflow 42102117734 passed web/native checks; Render staging passed all 734 tests. Staging dep-dbme906c6qcc73ej8ad0 became LIVE at 20:31:34Z; production dep-dbmeff8u01pc73e17dgg at 20:33:44Z. Both health endpoints report 1.3.224, live smoke checks passed, dedicated database preflights passed and no error-level entries appeared in the checked startup windows. Anonymous deletion requests returned 401 and foreign-origin requests 403 in both environments, using a synthetic ID. Main and staging branches are synchronized; documentation-only commits may follow the live application commits. Actual hosted owner deletion and real Stripe cancellation were not exercised; no real member was removed for QA. See docs/v1.3.224-verification.md.

# v1.3.223 release handoff — Free lifetime coupons and activation recovery

Release source: v1.3.223

Implemented: numeric 1/2/3 weekly session choices; free lifetime coupon preset; zero-total package fulfillment and membership renewals; owner Check payment / activation verifies the saved Stripe checkout/invoice using GET calls without creating a charge. Free activations queue an explicit $0 client email and an alert for opted-in owner devices, once per verified receipt. Existing session limits, identity checks, tenant isolation, credits and paid transactions are preserved. Migrations 095/096 allow verified zero-total membership/package receipts and activation alerts; no historical alert backfill.

Production diagnosis November 5, 2026: Before this release, Render was LIVE on v1.3.222 / e5d8724e36a37f3738f81136ad66824627e030bc. Logs at 19:23:00Z and 19:23:14Z show membership webhook failure on stripe_payment_receipts_amount_cents_check, explaining the blocked free activation. The affected live enrollment has not been changed.

Final local validation passed: 728/728 tests, TypeScript and production build. Tests cover free package and membership recovery, zero invoices, renewal, used-credit preservation, replay, wrong tenant/account/identity rejection, queued client emails, owner-device alerts and the actual owner verification button. Synthetic provider/database fixtures only; no real customer charge, email or device alert was used for QA. Verified LIVE November 5, 2026 UTC via PR #158. Release source 05c66b1b9aede7c25991be2a94f5e68920508692 and production merge 7b0b8f5c7e86acde3d404a8a23ec6b60a08a2289 share tree 6373f4849b4b93ee139e1f03e1f727bc2ff543c9. GitHub workflow 42097295878 passed web and native checks. Render staging passed all 728 tests and became LIVE at 20:00:49Z (dep-dbmdqotg1s2s73ami4lg); production became LIVE at 20:04:58Z (dep-dbme20tg1s2s73bstv9g). Migrations 095/096 applied successfully in both dedicated databases. Both live health endpoints report 1.3.223; booking/payment shells, protected owner APIs and invalid-invitation checks passed. Main and staging source branches are synchronized; documentation-only commits may follow the live application commits.

The affected individual membership and actual email/device delivery remain unverified. Automatic approval review rejected a private member-status lookup as requiring separate authorization; it was not retried. The owner can refresh Memberships/Packages and select Check payment / activation to reconcile the saved Stripe transaction without a new charge. See docs/v1.3.223-verification.md.

# v1.3.222 release handoff — Per-member weekly session override

Release source: v1.3.222

Owners can use Override weekly session limit for an individual member in Memberships/Packages. The setting defaults to off and applies only to that member. Enabling it bypasses the weekly session count while preserving paid membership dates, remaining membership-month credits, eligible services, booking capacity and approval rules. Turning it off restores the plan's weekly cap without deleting existing bookings or usage.

The owner-only, tenant-scoped change is validated on the server and serialized with booking changes. Additive migration 094 preserves existing members and payment/usage records. The checkbox saves per member and includes English, Spanish and Portuguese copy.

Verified LIVE November 5, 2026 UTC via PR #157. Release source a9e7df5733ae04945c4db2554f74d3c371abf3c4 and production merge e5d8724e36a37f3738f81136ad66824627e030bc share tree ae06b596d5a952d230a17edfccd1eacfa4ceddef. Local, GitHub workflows 42085056097/42085125121 and Render staging passed all 724 tests, TypeScript and production builds; native checks passed. Staging dep-dbmcnb15efls73c6gc9g became LIVE at 18:45:36Z; production dep-dbmcu2psrm7s73etrm4g at 18:48:25Z. Both health endpoints report 1.3.222; public booking/payment shells and protected API checks passed. The override POST rejects anonymous requests with 401 and foreign origins with 403 in both environments. Migration 094 applied in both dedicated databases, preflights reported schema CREATE true and zero unowned tables, and no error-level startup entries were returned. Browser inspection used actual rendered components with synthetic members, including Portuguese phone layout. No real member override, booking, payment or outgoing message was changed for QA; authenticated hosted owner editing was not manually exercised. See docs/v1.3.222-verification.md. Main and staging source branches are synchronized; documentation-only [skip render] commits may follow the LIVE application commits.

# v1.3.221 release handoff — Daily pending-payment email reminders

Release source: v1.3.221

One consolidated email per business/client/Eastern calendar day reminds clients of eligible unpaid sessions, initial memberships/packages and current outstanding Stripe membership invoices. The daily scan runs after 9:00 AM Eastern and waits at least 24 hours after the payment request/known due event. Each business can pause reminders under Settings → Notifications; enabled by default for existing and future businesses. Existing onsite choices, payment eligibility, approval, membership and commission rules remain in force.

Reminder eligibility is refreshed before delivery. Paid, covered, free, cancelled, declined, removed-service and no-show session quotes are excluded; actual recurring invoice balances are verified read-only with Stripe. Private access links refresh without incrementing manual payment-request counters. Daily uniqueness, atomic claims and provider outcome tracking prevent same-day duplicate sends; uncertain outcomes are not retried that day, and expired prior-day queues are not replayed. Additive migrations 092/093 retain existing data. Staging reminders use allowlist-only delivery protection even for copied historical client records.

Verified LIVE November 5, 2026 UTC via PR #156. Release source ef7684fbf48bfe0ff7f1a6f4364640ba0bcadb71 and production merge e32804b5d7cf9f04c68b79ae56aef546eef460a1 share tree 772c5f2fd5f62ede8c20ed4dde154cbf77ae658e. Local, both GitHub workflows (42036621463 and 42036684314) and Render staging passed all 713 tests, TypeScript and production builds; native checks passed. Staging dep-dbm8atmc6qcc7389ecc0 became LIVE at 13:45:41Z; production dep-dbm8hhks728c73fh5bs0 at 13:48:56Z. Both health endpoints report 1.3.221; live booking/payment shells, protected APIs and invalid private invitations passed read-only checks. Both dedicated database preflights passed with schema CREATE true and zero unowned tables, migrations 092/093 applied, and reminder workers logged their after-09:00 Eastern schedule. No error-level entries appeared in the checked startup windows. Production Gmail reports configured and no reconnection required; a normal payment-link email was submitted at 13:00 UTC. Staging's separate Gmail test connection needs reconnection, so real-provider inbox delivery was not tested. No real customer message or charge was used for QA. See docs/v1.3.221-verification.md. Main and staging source branches are synchronized; documentation-only [skip render] commits may follow the LIVE application commits.

# v1.3.220 release handoff — Booking notifications, mobile bell and Google review emails

Release source: v1.3.220

The client booking form now shows Enable session notifications before a booking is submitted, on all booking steps. Explicit opt-in prepares this device, then the successful booking privately registers its subscription before any checkout redirect. Failed or refused notification setup does not undo a booking; the confirmation keeps retry controls. Acceptance alerts retain the existing secure booking/payment destination and server-side eligibility checks. iPhone/iPad guidance explains Home Screen installation. Opt-in is per booking and device, with English, Spanish and Portuguese copy.

Owner notification controls stay together in the toolbar. The mobile bell is below the menu/backdrop, and the inactive content has an isolated stacking context so controls cannot overlap the menu logo. No database migration or booking/payment/business-rule changes.

Automated client emails include a separate Write a review button using the current business’s saved Google Place ID or exact Google review link. Shared Gmail/Resend HTML and plain text delivery cover booking/approval/payment, membership/package, and registration emails without replacing payment actions. Missing or invalid listing identities omit the review link; owner/staff alerts do not request client reviews.

Verified LIVE November 5, 2026 UTC via PR #155. Release source 4a65e31545545e8495831fa83e0830a7cf394a3d and production merge 188ed44ef6a5da72d4b4b523bab5fbe38b23dc4d share tree 9a7bc7fd0835a89eb72aa6982af80e39ae239749. Local, GitHub workflow 41961091189 and Render staging passed all 700 tests, TypeScript and production builds; native checks passed. Staging dep-dblvch1srm7s73eiimt0 became LIVE at 03:34:18Z; production dep-dblvj43bc2fs73aj64u0 at 03:37:36Z. Both health endpoints report 1.3.220. Live booking/payment shells, push configuration, private booking access and foreign-origin rejection checks passed. Hosted browser checks confirmed the booking opt-in panel and blocked-permission guidance in English and Portuguese; component previews covered mobile menu stacking, responsive controls and email payment/review buttons. All three currently listed businesses have usable exact review destinations. Dedicated database preflights reported schema CREATE true and zero unowned tables; no error-level entries appeared in checked startup windows. No real client message, booking, payment or device subscription was used for QA. Physical-device delivery, real-provider inbox receipt and authenticated hosted owner approval were not tested. See docs/v1.3.220-verification.md. Main and staging source branches are synchronized; documentation-only [skip render] commits may follow the LIVE application commits.

# v1.3.219 release handoff — Device payment alerts and financial layouts

Release source: v1.3.219

Owner dashboard adds a device-notification control beside the bell. Existing device opt-in is reused for session requests and new completed session, membership and service-package payment alerts. Payment alerts are queued from authoritative recorded payment events and isolated by business and opted-in owner device; historical payments are not replayed. Client booking alerts open the private booking status page, which offers the existing payment action after acceptance and rechecks payment eligibility. Booking device subscriptions support separate opt-in/out per device.

Financial stage summaries and revenue summaries use aligned tables, with readable amounts, scrollable transaction details and separate activity cards. Shared metric styles prevent numbers and words from being compressed into narrow columns. Existing booking, payment, membership, commission and access rules remain in effect. Additive migrations 090/091 support payment delivery and multiple booking devices.

Verified LIVE November 5, 2026 UTC via PR #154. Final source 9cfa846c34363c73b8b86c3067723884c53766f4 and production merge a96694a8945ee534b7626e4b0359733df292d7ba share application tree 8c082239c1e13372b92a17cf9d230835d6dd8e28. Final GitHub workflow 41954175295 and Render staging passed all 695 tests, TypeScript and production builds; native checks passed. Final staging dep-dblue6qs2dac7397qv5g LIVE at 02:38:36Z; production dep-dbluokfb9u1s7387nkq0 LIVE at 02:41:06Z. Both health endpoints report 1.3.219, push configuration is ready, and booking/payment shells, protected APIs, invalid invitations and foreign-origin rejection passed. Migrations 090/091 applied to dedicated staging/production databases with schema CREATE true and zero unowned tables. Browser checks verified financial layouts at desktop/tablet/phone widths, long Portuguese text and large amounts, plus final deployed client-page spacing and shared menu sizing. The staging-only test origin fixture was corrected before release; subsequent visual checks corrected page-margin specificity and mobile menu compression. See docs/v1.3.219-verification.md. No real customer payment or outgoing message was used for QA; physical-device receipt and authenticated hosted acceptance remain untested. Main and staging source branches are synchronized; documentation-only skip commits may follow the LIVE application commits.

# v1.3.218 release handoff — Responsive owner workspace and shared layouts

Release source: v1.3.218

Shared layout improvements cover translated text, narrow screens, scrollable tables, modal sizing, focus indicators and owner navigation. Direct Bookable sessions, Team management and Payment setup destinations open the existing settings panels; all original destinations and unsaved-settings protection remain. Dashboard metrics open related lists, schedule or date-filtered reports. Pending requests precede quick actions. Owner booking, appointment details and session roster receive focus containment and restoration. Settings failures retain drafts and show a persistent inline error. No API, authorization, database, payment, commission, booking or email rule changes. Verified LIVE in staging and production.

Verified LIVE November 4, 2026 UTC via PR #153. Final source `b98e73cf150d1643471a7d580095a0bdaf84f0a0` and production merge `99c8bb0bfa24801f0e3a41481c736bcdf9ac5a0f` share tested tree `98511ba9fdc06f27c7ed1b65effbca8a0931aec7`. Staging `dep-dblq3adg8ees73fqfij0` LIVE 21:41:01Z; production `dep-dblqd7vb9u1s73dnbqpg` LIVE 21:43:42Z. Both health endpoints report 1.3.218. Exact final source passed all 681 local tests, TypeScript and production build; GitHub CI run `41915964182` passed web/native checks; final Render staging passed 681 tests with zero failures and its build. Public booking/payment shells, protected API HTTP 401 checks and invalid-invitation/no-store checks passed in both environments. No error-level entries returned in the checked final startup windows. Browser checks cover actual owner, team, admin and customer components with synthetic records, long text, 40-row tables, empty states, translated layouts, phone/tablet/desktop widths, focus handling and retained form drafts. Hosted public pages loaded without observed application-origin console errors. No real records, charges, messages or business settings were changed for QA. Authenticated hosted private-role acceptance, physical devices, actual browser zoom and live provider transactions were not exercised. See `docs/v1.3.218-verification.md` for scope and limits. Documentation-only [skip render] commits may follow the LIVE application SHA.

# v1.3.217 release handoff — App-wide interface languages

Release source: v1.3.217

Shared root navigation adds US English, Spain Spanish and Brazil Portuguese flag controls at the top right on every app page. Language persists on the visitor device and across tabs. Same-origin, on-demand static catalogs cover more than 6,000 interface strings per language, including forms, owner/team/admin navigation, dynamic status messages and dialogs. Translations are prepared offline with Argos-compatible models, with curated interface/financial vocabulary and protected numbers, brands and interpolation slots. No page text, client record or private dashboard content is sent to an external translation service. Only display text and accessible labels change; input/option values, URLs, IDs, financial records and API authorization remain canonical. Saved custom business content without an interface-catalog match, PDFs, outgoing emails, native apps and external provider pages retain their original language. English source remains the canonical text. No migration, provider account or environment change. Automated interaction tests include actual React reconciliation, dynamic nodes, protected/editable text, controlled forms and restoration. Verified LIVE in staging and production.

Verified LIVE November 4, 2026 UTC via PR #152, merge 3ce415090f439fdb01110a7ffd874bfda85bbec8. Final source e7b4d58f6c58687b46c0cd87ca9ec5ae87d6433b and the production merge share application tree 9a5a726d722953282202ec9544590670746cfc93. GitHub workflow 41900825121 and final staging passed all 676 tests, TypeScript and production builds; native checks passed. Staging dep-dblop0mk1f9s73enfh20 LIVE 20:03:38Z; production dep-dblovts9v7es73bos7m0 LIVE 20:07:33Z. Both public health endpoints verified 1.3.217. Exact deployed Spanish and Portuguese catalog bytes match the tested files (6,217 entries each). Public browser checks verified flag placement, Spanish and Portuguese translations, page navigation/reload persistence, form labels, polished public copy and English restoration; no application-origin browser errors were observed. Read-only public booking/payment shells, protected APIs and invalid-invitation/no-store checks passed. No error-level entries returned in the checked final startup windows. Local TypeScript/build and focused interaction checks passed, including NODE_ENV=production. Earlier full local checks exposed two markup-only expectations; those were corrected. Earlier staging attempts exposed React act helpers being absent under production NODE_ENV; tests now select the test runtime before importing React. Final CI and staging runs have zero failures. No real customer records, outgoing messages, charges or business-setting changes were created for QA. Signed-in private-workspace and physical-device visual acceptance were not performed; shared interactions are covered by actual React/DOM fixture tests. Translation packs were machine-prepared and curated for principal terms/public copy; every sentence has not received human language review. Unknown custom content, PDFs, transactional emails, native apps and external provider pages retain their original language.

# v1.3.216 release handoff — Recurring memberships and one-time service packages

Release source: v1.3.216

The shared Membership/Packages tab offers a payment-type selector when creating an offer. Memberships retain recurring billing; service packages charge once for a fixed total session allowance with no automatic renewal or monthly reset. Package credits remain until used. Owner forms, customer checkout, invitations and receipts explain the selected payment terms. Existing offers remain memberships.

Migration 089 adds plan/enrollment billing types, snapshots enrollment terms and prevents converting enrolled offers between payment types. Package checkout uses a one-time payment, does not save recurring authorization or create a subscription, and activates credits only after verified payment or existing manual-payment confirmation. Repeated payment events remain idempotent; full refunds deactivate package access. Existing first-time commission and tenant-isolation policies remain in force. No real customer transactions are created for QA. Verified LIVE November 4, 2026 UTC via PR #151, merge 6fe3039a827df17f957b02c54291652547f8a7ef. Final source ec97c831c33757ea28daa1a97804998058d141ab and merge share application tree 484de7c67eb8ff4b2ea80996f83640d36cf89485. Final local, GitHub and staging suites passed all 668 tests; TypeScript/build passed, and GitHub workflow 41749512258 passed native checks. Initial local/hosted runs exposed outdated test fixtures, link labels and release markers; corrected runs passed. Staging dep-dbl81g5hnmic73e4ao3g LIVE 01:06:28Z; production dep-dbl8afk9v7es73cdv030 LIVE 01:08:53Z. Migration 089 applied in both dedicated databases with schema CREATE true and zero unowned tables. Both public health endpoints verified 1.3.216; booking/payment shells, protected APIs, invalid invitations and foreign-origin rejection passed. Existing public offers retain membership billing. No error-level entries returned in checked startup windows. Signed-in browser, physical-device and real-provider payment acceptance were not performed; isolated payment fixtures cover commissions on/off, duplicate events, refunds and credit exhaustion. No real customer charges, emails or enrollments were created for QA.

# v1.3.215 release handoff — Membership sessions column order

Release source: v1.3.215

Member enrollments now orders columns Customer / Member ID, Sessions used, Payment status / actions, Plan. Complete cells and sorting values move together, preserving all actions and counters. Payment-control spacing follows column three. Applies to all businesses; presentation only, no migration or data changes. Local validation passed: 666 tests, TypeScript, production build, and AST comparison confirming only header/data cell reorder. User approved publishing and deployment. Hosted staging and production verification pending.

# v1.3.214 release handoff — New session editor modal

Release source: v1.3.214

Create session immediately opens the new numbered draft in a native modal with all existing session fields and Save business settings. Closing retains the draft, saving retains existing validation and persists all pending settings, and failed saves keep the editor open with an error. Native modal focus/inert behavior and scroll restoration avoid scrolling to the last session. Shared owner flow applies to all businesses; plan limits and publishing rules unchanged. No migration or business-data changes. Validation and deployment pending.

# v1.3.213 release handoff — Membership payment column order

Release source: v1.3.213

Member enrollments now orders columns Customer / Member ID, Payment status / actions, Plan, Sessions used. Both headers and complete row cells move together, retaining sorting, payment controls, counters and renewal form behavior. Shared owner component applies to all businesses. Presentation only; no migration, business-setting, membership or payment changes. Verified LIVE November 3, 2026 via PR #148, merge 0b42419b8380acd61bed15fb40c29eabfd4df3dc. Source a70984a34936e2df6eef6767369f90716480b305 and merge share tree 021adb57e2f04ba58dfd6bfaf25e30a191f4b1b9. Staging dep-dbl3ll3l550s73eeho00 LIVE 20:02:00Z; production dep-dbl3sn7b9u1s73ehn83g LIVE 20:06:36Z. GitHub workflow 41706876103 and staging passed all 661 tests, TypeScript and builds; native checks passed. Local TypeScript/build and two continuity tests passed; AST comparison verified complete header and row cell contents only reordered. Both environments serve health version 1.3.213 and compiled membership column order and column-two CSS were verified. Public booking/payment shells and protected API smoke passed (anonymous GET/POST 401, foreign-origin POST 403, no-store). No error-level entries returned in checked startup windows. No live customer data, emails, charges or business settings changed for QA. Signed-in browser visual and physical-device acceptance were not performed.

# v1.3.212 release handoff — Shared private service slots

Service catalog has an explicit same-time team-sharing option. Same service, start and duration can share one team member up to the existing business-wide service slot limit. Availability and atomic confirmation use the same policy; different services, staggered starts, scheduled groups, buffers and blocked time remain protected. Existing exclusive slot records remain intact and compatible records are recognized. Cancellation reopens capacity and no-show attendance corrections recheck capacity. Pending approvals reserve no seat. Migration 088 enables only Arcila Training (arcillatrng) Private Session, preserving its current six-slot limit and all other business settings; other businesses default off and can opt in deliberately. No payment, commission or credit rule changes. Verified LIVE November 3, 2026 via PR #147, merge b76fd8221e6bd5c91e3cd9120ad5252328fc6732. Final source 3b424f4093c52be52fd9f4d076280d8d4b63e8cb and application tree cebe175fa4a59d00a5d619054eb179fe0aa3d389 match the production merge. Staging dep-dbl335qtnucc73fsh5a0 became LIVE at 19:26:42Z; production dep-dbl3bo2vcj2c73a80c20 became LIVE at 19:30:43Z. GitHub workflow 41700743406 and corrected staging passed all 661 tests, TypeScript/build; GitHub native checks passed. Local full run initially passed 660/661 with one documentation-marker failure, corrected and separately verified; final six focused/continuity checks and local typecheck/build passed. Initial staging dep-dbl2vjuk1f9s73ec23ug stopped on that same documentation-only failure before deployment. Final full GitHub/staging runs have zero failures.

Migration 088 applied in both dedicated databases, with schema CREATE true and zero unowned tables. Staging's older Arcila catalog limit is one; the migration intentionally preserved it while enabling the policy flag. Production's current limit remains six, with only Private Session opted in. Read-only production availability verifies November 5 at 9:00 AM now open with 5/6 remaining (previously hidden), while staggered 9:30 AM remains blocked; November 4 and 6 also returned correct capacity. Both actual public health endpoints serve 1.3.212. Public booking/payment shells and protected API smoke passed, including owner membership GET/POST 401 and foreign-origin POST 403 with no-store. No error-level entries returned in checked final startup windows. No real customer booking, email or payment was created for QA. The requested Arcila policy activation is the only business-setting change; existing slot locks, bookings, payments and other tenant settings are preserved. Signed-in owner visual and physical-device acceptance were not performed.

# v1.3.211

- Show per-member payment request and provider-submission counters using existing invitation history.
- Deduplicate uncertain send retries without counting worker delivery attempts or implying inbox delivery.
- Bound stalled optional Stripe sandbox preparation during startup while preserving required migration and setup failures.

# v1.3.210

- Add owner-reviewed Email payment link beside Pay on Site with business-scoped authorization and duplicate-send safeguards.
- Reuse private payment pages and existing commission/payment verification; suppress stale payment requests without charging clients or recording payment on send.

# v1.3.209

- Use normalized email or phone with matching names and compatible birth dates as supporting first-time commission evidence.
- Retain only salted contact hashes and financial identity links; guard shared contacts, conflicting identities and competing payment attempts without merging profiles or changing existing fees.

# v1.3.208

- Add team cancellation requests, owner-only approvals, decision history and owner notification-bell alerts.
- Preserve bookings until approval; use atomic cancellation with stale-appointment and open-payment safeguards, retaining customers, payments and history.

# v1.3.207

- Add this-week, past-six-month and year-to-date financial report periods plus inclusive custom From/Through calendar selection.
- Apply shared Eastern-date filtering to report totals, pipeline, detail views and regular exports; preserve full pre-reset backups.

# v1.3.206

- Add durable service payment attribution and owner/platform commission reports by business and team member, with refunds, cash liabilities and complete paginated transaction records.
- Show SelahFlow platform costs alongside team service shares without changing fee activation, first-time eligibility or the saved member split.

# v1.3.205

- Consolidate service percentages under Team logins & workspace fees with ordered access, percentage setup and transactions/balances sections.
- Improve responsive navigation and member-card layout; preserve existing financial controls and records.

# v1.3.204

- Add owner-configurable team service percentages, prospective immutable service ledger, per-member balances and audited manual receipts.
- Preserve tenant isolation, historical rates, zero-price membership services, attendance corrections and existing payment/commission flows.

# v1.3.203

- Team members publish assigned-service bookable sessions using shared business package limits and calendar protections.
- Owners choose free or recurring paid workspace access per login under Team logins & workspace fees.
- Add explicit employee authorization, direct connected-account Stripe subscriptions, verified invoice access, cancellation and risk reconciliation; preserve existing free access and customer membership credits.

# v1.3.202

- Place membership badges beneath client names consistently in directory cards, profiles, calendar lists and member/history tables, with responsive wrapping.

# v1.3.201

- Add accurate booking-software page titles, descriptions, canonical links, sharing metadata and public business search snippets.
- Publish an active-business sitemap, crawler rules and staging/private-page indexing safeguards; retain Google ownership verification.
- Add server-rendered, expandable search topics and factual structured data without changing booking, billing or business records.

# v1.3.200

- Each team workspace can approve, decline or correct bookings assigned to that team member, alongside owner dashboard approvals.
- Approval permissions are independent of notification routing; legacy delegated links retain their scope.
- Recheck assignment, account access and reviewed details during atomic calendar approval; preserve prices, waivers, capacity and payment safeguards.

# v1.3.199

- Confirm onsite cash for owners and assigned team members; preserve first-service and first-membership commission eligibility.
- Show the separate cash commission balance and freeze itemized monthly statement collection on the owner-authorized date.
- Add migration 082 for collection schedules and consent audit; existing billing and data remain intact.

## 1.3.198

- Add owner browser card checkout for approved onsite appointments, with saved prices and existing commission/receipt safeguards.
- Make onsite payment checks reconcile Checkout and Terminal, show progress and clear next steps, and preserve paid/cancelled states.
- Explain installed-phone requirements instead of silently launching a missing app; permit cash settlement only after verified unpaid checkout expiry.

## 1.3.197

- Wrap expanded benefit descriptions within the benefit column, overriding inherited table nowrap styling. Also recover card activation and paid statements after an interrupted database write; fees are unchanged.

## 1.3.196

- Add explicitly authorized monthly cash commission billing, itemized statements and outstanding-balance payment links.
- Preserve first-purchase eligibility, administrator switches and card commission collection; add tenant-scoped reconciliation and retry safeguards.
- Replace benefit cards with concise comparison tables and expandable descriptions, including booking, service and membership payment integration.

# v1.3.195 release handoff — Concise booking client ID instructions

The customer booking form removes the explanation of ID generation from the returning-client box. Two short paragraphs now explain: returning clients enter their client ID to fill in saved details; first-time clients leave it blank and complete the form below. Client lookup, assigned IDs, required fields and booking behavior are unchanged. No migration or business setting update is required.

Full validation and staging/production rollout pending. This is a copy-only change to the booking form shown in the user screenshot; no business/customer records are changed for QA.

# v1.3.194 verified LIVE — Marketplace logos open business landing pages

PR #126 merged as 49cafc264893b68302a8cbe5abfe672f455adfe7. Staging source daa2ae57993651fcd18bf80bee2d88da48211aaf / dep-dbitdktg1s2s73e6sqpg LIVE at 2026-10-31T12:03:46.267032Z; production dep-dbitijeq1p3s73a4k700 LIVE at 12:06:10.691327Z. Both deployed application trees equal 71b5f3e26770901ba6bd8a4b998284f651112204. All 560 local/staging tests, TypeScript, production builds and final-head GitHub checks passed (web 124530108465 / 124530066341; native 124530108582 / 124530066476). Both environments passed versioned health, public booking/payment shells, protected API and invalid-invitation/no-store checks. Checked startup error windows were empty. No migration is required.

Live browser verification clicked the actual Arcila Training marketplace logo on both environments and reached the matching /arcillatrng landing page with its business heading, services and booking/membership links. Production also displayed Crawford Hair Company's logo as a link to /crawfordhaircompany. Real component tests cover native anchor semantics, accessible business label, encoded slug and preserved placeholder/failed-image behavior. Physical-phone interaction was not exercised; native links support click/tap, keyboard activation and ordinary browser link controls. Existing carousel, logo dimensions and all data/payment paths are preserved. No business/customer record, booking, payment, provider setting or outgoing message was changed for QA. Earlier pending notes below are superseded by this verified rollout. Documentation-only verification commits may follow the application SHAs without rebuilding.

# v1.3.194 release handoff — Marketplace logos open business landing pages

Every marketplace business logo is now a native link to that business's public landing page, using its encoded slug and an accessible name identifying the business. Clicking the logo, pressing Enter when focused, or using normal browser link controls opens the same destination as the business name/View business link. Keyboard focus is visible. Placeholder and failed-image fallbacks retain the business destination; existing logo sizing, carousel behavior and all data/payment paths are preserved. No migration or business setting update is required.

Verified LIVE on staging and production; all 560 tests and release checks passed. Existing logo rendering/fallback tests also cover link semantics, tenant destination and URL encoding. No business or customer records were changed for QA.

# v1.3.193 verified LIVE — Customer categories follow the marketplace

PR #125 merged as 22636274605c82c147d16aa843ad1ce6226c0687. Staging source 6819a8c6ae799e96352ce8d9b9ff45da73a296c3 / dep-dbit4l5g1s2s73e677pg LIVE at 2026-10-31T11:44:10.788309Z; production dep-dbit9k3bc2fs73cqs8a0 LIVE at 11:47:10.421144Z. Both deployed application trees equal 690f4abe4a57762ed84d2847bbdd8d8538036720. All 560 local/staging tests, TypeScript, builds and final-head GitHub checks passed (web 124526239100 / 124526184614; native 124526238967 / 124526184449). Both environments passed versioned health, public booking/payment shells, protected API and invalid-invitation checks. Checked final startup error windows were empty; no migration is required.

Live category API checks on both environments verified unique metadata matching public business industries, preserved global categories during filtering, and at least one correctly categorized result for every category. Production currently represents auto-detailing, barber, consulting, fitness and landscaping; this is a live inventory snapshot, not a hardcoded list. The customer page uses canonical catalog names and matching exact filter codes. No business category or record was edited to produce that result.

Staging and production browser checks showed only the five represented category buttons, without the previous unsupported Sports coaching / Hair & beauty / Wellness links. The Barbershop button opened matching results on each environment: the synthetic test business in staging and Crawford Hair Company in production. At the checked 1363px desktop viewport the document width was 1348px. Physical-phone interaction and an actual business activation/archive were not exercised; SQL/API fixtures cover category visibility and updates, and existing responsive chip styles are retained. No customer, business, payment, provider setting or outgoing message was changed for QA. The broader registration industry catalog and discovery search form remain available as before; this request changes the customer landing-page shortcuts. Earlier pending notes below are superseded by this verified rollout. Documentation-only verification commits can follow these application SHAs without rebuilding.

# v1.3.193 release handoff — Customer categories follow the live marketplace

The customer landing page's category chips are derived from the same active businesses returned by the public marketplace, replacing the hardcoded Sports coaching / Fitness / Hair & beauty / Wellness / Auto detailing list. The marketplace API adds unique industry-code metadata from all eligible rows before search filtering and the 500-result cap. Chips use the existing catalog's exact category names and filter codes, update on page load and return to the tab, and remain absent while loading or unavailable rather than advertising nonexistent categories. Pending, rejected and archived businesses cannot introduce public categories. Empty and duplicate categories are excluded.

The broader industry catalog for registering businesses is unchanged. Marketplace search, visibility rules, business records, payments and ownership are preserved. No migration or business setting change is required. Focused SQL/API and rendered-component tests pass; all 560 tests and release checks passed; verified LIVE on staging and production. No actual business is created, activated, archived or edited for QA.

# v1.3.192 verified LIVE — Customer membership offers before Google reviews

PR #124 merged as da1e6dcdc2caf0ee5d222de3f96a21b0fce2b2c9. Staging source 8db204bca711007c3fb074f61d0bc14a573bca0e / dep-dbims54s728c73fom050 LIVE at 2026-10-31T04:36:26.214774Z; production dep-dbin0vtg1s2s73f6i7ug LIVE at 04:38:50.923219Z. Both deployed trees equal a5af592827ef03775008d31ef86181cfc6801848. All 558 local/staging tests, TypeScript, builds and final-head GitHub checks passed (web 124441471411 / 124441370564; native 124441471259 / 124441370718). Both environments passed versioned health, public booking/payment shells, protected API and invalid-invitation/no-store checks. Checked startup error windows were empty. No migration is required.

Staging browser verified Arcila's eight offers, a single-column layout and membership panel before the Google container; switching to Small Group Training retained order with three offers. Google content is not configured for that staging business. Production browser verified eight offers, the configured Google UI Kit/reviews region and View all Google reviews link below the complete membership panel. Actual DOM order is introduction → membership panel → Google container. At a 1363px viewport the document was 1348px wide with one 1004.59px content column; panel bottom 2418.06px preceded Google top 2458.94px. The Google review link was visually inspected below the offers. Full third-party rating/photo rendering and physical-phone acceptance were not claimed; the one-column source order applies at every breakpoint. No membership selection was submitted, registration signed, payment made, or business/provider/customer record changed for QA.

The v1.3.191 administrator workspace and v1.3.190 Stripe/team fixes remain included. All currently requested work is implemented and verified LIVE. Earlier pending notes below are superseded by this record; documentation-only verification commits may follow these application SHAs without rebuilding.

# v1.3.192 release handoff — Customer membership offers before Google reviews

The customer membership page uses one column at every screen width: business introduction, membership offers/registration panel, then Google photos and reviews. Google content sits after the complete membership panel in document order and waits until membership data has loaded, so faster Google responses cannot place reviews ahead of the offers. The shared Google gallery, attribution, review links, business branding and all membership grouping, details, IDs, coupons, consent, registration and payment logic are preserved. Business home and booking page layouts are unchanged. No migration or business setting change is required.

Verified LIVE on staging and production; all 558 tests and release checks passed. This is a display-order change; no real membership, payment, customer record or provider setting is changed for QA.

# v1.3.191 verified LIVE — Organized platform administrator workspace

PR #123 merged as 1ea43abc66076ab9343fe115204c492fa7caa881. Staging source 6b9deaada87fcda0cd00fe1348d21195ac5b83d8 / dep-dbimllvb9u1s73buno4g LIVE at 2026-10-31T04:22:38.179971Z; production dep-dbimq8jncjis73cq2npg LIVE at 04:24:32.454012Z. Both deployed trees equal c00388608fedbf61631d96189009dd815360dd4c. All 558 local/staging tests, final TypeScript/builds and GitHub checks passed (web 124438397365 / 124438352309; native 124438397180 / 124438352160). Both environments passed versioned health, public booking/payment shells, protected APIs and invalid-invitation checks. The administrator page requires login, anonymous overview reads return 401 and foreign-origin writes return 403. Checked startup error windows were empty; no migration is required.

Desktop sidebar, phone section selector, clear task cards and role-specific sections are shipped. Real JSX/state tests exercise navigation, retained tools, ordinary/primary visibility, approval action restrictions, summary counts, empty/error states and safe/legacy section links. Signed-in live administrator browser and physical-phone visual acceptance were not exercised; no administrator approval, provider setting, credential, account permission or business record was changed for QA. The payment and team improvements from v1.3.190 remain included. Earlier pending notes below are superseded by this verified rollout.

Next authorized request: put customer membership offers before the business Google reviews after this production release. Documentation-only verification commits may follow these application SHAs without rebuilding.

# v1.3.191 release handoff — Organized platform administrator workspace

The platform administrator page replaces its long stack of tools with a calm SelahFlow layout, a desktop sidebar, a labelled phone section selector, clear page headings and Overview / Businesses / Business approvals / Packages & team / Payments & fees / Connections / Admin access destinations. Task cards and pending counts lead directly to work. The overview separates application counts from financial settlement, shows package assignments and the review queue, and places secondary reporting notes under a disclosure. Business support and the directory come first; business management/archived records and waiver guidance sit in labelled disclosures.

Approval cards show owner, location, requested package, package payment state and submission date, while the existing server performs final signature/payment/primary-role verification. Primary-only payment, commission, email and Google tools remain primary-only. All existing controls, support, package overrides, seat requests, archive/restore/purge confirmations and administrator security remain present. Sections stay mounted when hidden so navigation does not discard form drafts. Only allowed section hashes restore; unknown/role-ineligible hashes return to Overview. Loading, retry, refresh and empty states are explicit. The overview API's obsolete v1.3 not-live payment wording is replaced with a stable reconciliation note; no payment behavior changes.

Verified LIVE on staging and production; all 558 tests and release checks passed. Real component rendering/navigation tests cover tool preservation, role visibility, approval controls, counts, mobile navigation, empty/unavailable states and safe section links. No real business approval, provider setting, billing action, account permission or record is changed for QA.

# v1.3.190 verified LIVE — Stripe package fix and team booking workspace

PR #122 merged as 77a5e612fc82837d9a74dc61a06d7f1acf1e371d. Final staging source 9b50ce12acbba872cdf036c512229c10a0a03385 / dep-dbimcoijnfac73b1jih0 LIVE at 2026-10-31T04:03:31.466414Z; production dep-dbimhb15efls73d7c4l0 LIVE at 04:05:21.333447Z. Both deployed trees equal d9cd01878a9f74c2404d7f740ac7ccbbda0831ee. All 553 final local and staging tests, TypeScript, production builds and final-head GitHub checks passed (web 124434574919 / 124434568930 and native 124434575054 / 124434568707). The first staging attempt stopped on a test fixture origin mismatch; the CSRF guard correctly rejected the example origin under staging APP_URL. Isolating that test's APP_URL fixed it, and all 553 tests also passed locally under the deployed APP_URL. No application security rule was weakened.

Package Checkout now explicitly uses standard Stripe Billing instead of the account's Managed Payments default. Stripe accepted an unpaid live Professional verification Checkout for 2499 USD cents with managed_payments.enabled=false. No customer, card, subscription or payment was submitted; the unshared verification session expires automatically. Both published paid prices were verified active on the SelahFlow LLC account. No product tax code, account-wide setting, price, commission or tax registration was changed. Automatic tax remains a separate setup task. New retry keys avoid replaying the old failed request; saved agreements and existing recorded open sessions are retained.

Both environments passed versioned health, booking/payment shells, protected owner APIs, invalid-invitation/no-store and team notification/review anonymous/origin rejection checks. Checked final startup error windows were empty. No migration is required. Production browser verified the top Share page button above Chris Crawford's profile, correct friendly public URL, and no horizontal overflow at a 1363px viewport (1348px document). That profile does not exist on staging; no profile was created just for QA. Private signed-in team review, real approval/decline/edit actions, native sharing destinations and physical phone acceptance were not exercised in the live browser; isolated API/database/JSX/sharing tests cover them. No actual booking, client data, photo, reviewer setting, legal signature, charge or outgoing message was changed for QA. Earlier pending notes below are superseded by this verified rollout.

Next authorized request: modernize and organize the platform administrator page after this release is finished. Documentation-only verification commits may follow these application SHAs without a rebuild.

# v1.3.190 release handoff — Package payment fix, team sharing and booking approvals

Package subscription Checkout explicitly sets managed_payments[enabled]=false to retain SelahFlow LLC's standard Stripe Billing model when the account defaults to Managed Payments. This fixes the missing-product-tax-code rejection without inventing a tax classification, changing account-wide settings or enabling automatic tax. The versioned idempotency namespace allows retry after the previous failed request. Existing recorded open sessions are reused, and paid invoice verification, signatures, reviewer approval, pricing and first-customer commissions are preserved. Tax registration/configuration remains separate.

Public team profiles have a top Share page button using native sharing with clipboard/manual-copy fallbacks. It shares only the public pathname, without query parameters or private workspace URLs. The private workspace bell moves out of the business header into a clearly labelled Bookings & approvals panel below the welcome area and before the workspace tabs. Pending request and unread confirmation counts refresh automatically. Expanding the panel shows full-width booking details, submitted answers, capacity, edit controls, Approve and add to calendar / Decline actions, then assigned confirmations and a calendar shortcut. The panel stays in normal document flow on phones.

The existing review API accepts a verified team session in addition to its expiring bearer links. It checks current business settings for the assigned approval reviewer; other members get no pending customer data or approval rights. Forced password changes, disabled/removed accounts, expired links, origin guards, tenant scoping and existing atomic booking/capacity/payment protections remain enforced. Confirmations remain limited to that team member's assigned appointments. No migration or business reviewer setting change is required. Owner-managed approvals remain owner-managed unless the owner explicitly assigns a team reviewer.

Verified LIVE on staging and production; all 553 tests and release checks passed. Synthetic account/database/API and real component rendering tests cover session-versus-link access, reviewer reassignment, cross-tenant isolation, details/action display and safe public sharing. No real booking is approved, declined, edited or created for QA.

# v1.3.189 verified LIVE — Google account choice and modern agreement-first signup

PR #121 merged as 120033f1de124ac0afeef628354560d85566d89b. Final staging source 3605b2da6af63878d0bf0d00e6527084282c96b7 / dep-dbilo8iqphnc73dfn1n0 LIVE at 2026-10-31T03:28:13.702867Z; production dep-dbim0tavcj2c73e60tgg LIVE at 03:30:40.221168Z. Both deployed application trees equal 56773b82d0ed6bdf3cab7334f1a483c540d5ac8d. All 549 final local and staging tests, TypeScript, builds and final-head GitHub web/native checks passed (runs 41163202612 and 41163197215). Native checks validate source/prebuild/JavaScript exports, not signed native binaries or physical devices. Migration 080 applied during the first staging rollout and in production at 03:30:35Z; final startup preflights confirmed dedicated database/role, schema CREATE and zero unowned tables. Checked final startup error windows were empty.

Both environments passed versioned health, public booking/payment shells, protected owner APIs and invalid-invitation/no-store smoke. Google identity readiness was true on both. Safe authorization-start checks verified basic openid/email/profile scopes, the registered callback, PKCE and HttpOnly/Secure browser binding; foreign origins, unsigned registrations and anonymous package Checkout were rejected. No Google account was authorized, real registration/signature submitted, payment made or actual business setting changed for QA. Complete real-account sign-in and paid Checkout were not exercised.

Browser inspection verified Free, Professional and Business package agreement details on staging, plus the production Business signup and printable contract with its $69.99 monthly price and exact benefits. The production Google button became enabled after readiness loading. Desktop signup document width 1348px stayed within a 1363px viewport. Physical phone, signed-in owner/team and real-account browser acceptance were not exercised; isolated JSX, responsive styles and crypto/database/billing fixtures cover those paths. Saving the signed application precedes a separate Make payment action; provider-verified paid invoice and primary administrator approval still gate active access. Same-package payment retry preserves the draft; changing package resets its consent. Historical signatures and records remain intact. Earlier pending notes below are superseded by this verified rollout; documentation-only verification commits can follow these application SHAs without rebuilding.

# v1.3.189 release handoff — Account choice, contract review and separate payment

Business package signup follows four clear steps: account choice, business details, agreement review/signature, then explicit Make payment. Google/Google Workspace identity and manual email/password are supported. Google uses a separate browser-bound, PKCE and nonce-protected authorization flow with RS256 issuer/audience/expiry verification through jose. It requests only openid/email/profile, stores no provider access/refresh tokens, uses immutable provider subject identity, never links existing password users by email alone, honors forced password rotation and does not create an application or accept terms merely by signing in. One-use signup proofs expire after 30 minutes and are consumed in the registration transaction.

The existing registered /api/platform/gmail/callback endpoint dispatches only sf_auth_ states into basic identity sign-in; ordinary Gmail connection states still use the existing administrator-only delivery flow. GOOGLE_SIGNIN_CLIENT_ID/SECRET can override the existing GMAIL_CLIENT_ID/SECRET web OAuth client. No Gmail/offline/Business Profile scopes are requested by sign-in. Google console availability and complete real-account sign-in must be verified separately from isolated token tests; no real account, signature or charge is created for QA.

The modern package sidebar shows published price and exact benefits. A prominent contract/disclaimer opens a native accessible document reader; explicit review acknowledgment unlocks signature and consent fields. The v2 contract corrects payment-before-approval wording, lists selected package benefits, and retains subscription, commission, processor fee, renewal/cancellation, responsibilities, privacy and electronic-record terms. New registrations and new Checkout authorization require v2 review and signature; existing v1 signed applications retain review eligibility and stored records are not rewritten. No new legal approval has been obtained.

Saving the signed application creates a private pending account without charging. Only the subsequent Make payment button starts Stripe Checkout. Provider-verified payment and primary administrator approval still gate active business access; Free requires no card. Existing commission switches, client payment integrations and business data are preserved. Printable contract copies retain the selected package. Sign-in pages also expose Google for returning federated owners.

Verified LIVE on staging and production; all 549 final local/staging tests, TypeScript, builds, GitHub checks and safe live endpoint checks passed. See the verified release record above for exact SHAs, deployments and test limitations.

# v1.3.188 verified LIVE — Clearer owner navigation and responsive layouts

PR #120 merged as 7d94976946b45167c47eb7fcb410399c148a0282. Staging 89a041f50f9e6b4dec1dfc50218ecf697df6f5cb / dep-dbil94ks728c73fkltbg LIVE at 2026-10-31T02:47:25Z; production dep-dbildreq1p3s739u6en0 LIVE at 02:49:36Z. Both deployed application trees equal 238875517632968471e18f17de25e4f5ad81c60c. All 538 final local and staging tests, TypeScript, final builds and GitHub checks passed. Both environments passed versioned health, public booking routes and protected API checks; checked startup error windows were empty.

Owner daily task shortcuts, reordered settings and the labelled phone category selector are shipped. Session setup cards no longer contain a Reschedule action; Schedule → dated session → Reschedule session opens a separate scrollable dialog. Existing customers, pending requests, capacity and independent recurring dates are preserved. Shared form containment, date/time sizing, mobile save-bar flow, whole-word business header names and top-level team Share page / Preview controls are shipped. v1.3.187 session-full controls remain included.

Browser verification at a 1363px viewport confirmed the staging test business and production Crawford Hair Company headers use the new grid layout, with no header controls outside the viewport. Crawford, Hair and Company each occupied a single text fragment, with no mid-word break. Public pages were also inspected visually. Signed-in owner/team browser changes and physical iPhone interaction were not exercised; isolated rendering, safe-sharing fallback and existing scheduling/database regressions cover those paths. The cloud browser disallows local file fixture previews. No real business setting, booking, client record, photo, payment or outgoing message was changed for QA. Earlier pending release notes below are superseded by this verified rollout.

# v1.3.188 release handoff — Clearer owner navigation and responsive layouts

Owner dashboards have four plain-language daily shortcuts. Settings categories follow business setup order and expose a labelled category selector on phones instead of a horizontally scrolling category strip. The prominent reschedule action is removed from bookable-session setup cards. Existing safe schedule changes are available from Schedule → click a dated session → Reschedule session, in a separate focused dialog that preserves existing customers and pending requests. The dialog changes only the selected occurrence and does not save unrelated setup drafts.

Business navigation reserves a complete row for identity on smaller screens and wraps ordinary business-name words together. Header actions wrap on a separate row. Shared form styles contain date/time fields and nested grids, stack narrow form rows, wrap toolbars and move the mobile settings save bar into normal flow to avoid covering fields. Team workspaces expose Share page and public-page preview in their toolbar on every tab; links use the public profile slug, never private workspace URLs or client data, with native share and clipboard/manual-copy fallbacks.

Staging/production deployment verification pending. Local browser file fixtures are unavailable under the cloud browser URL policy; isolated component rendering and stylesheet checks cover responsive breakpoints, and deployed public pages will be checked in the browser. No real settings, appointments, client records, photos or outgoing messages are changed for QA.

# v1.3.187 verified LIVE — Owner session-full checkbox

PR #119 merged as e59c6d30ed32bbae317bcf94b67e25e4138c5e94. Staging 90a1250951c2ba367f414f7fa7475ff2f8119631 / dep-dbikvoh42hec73apoong LIVE at 2026-10-31T02:27:21Z; production dep-dbil47p5efls73d6av10 LIVE at 02:29:24Z. Both deployed application trees equal 1917aedb797757dbfeb06503143312da0baa9298. All 533 final local and staging tests, TypeScript, builds and GitHub validation passed. Both environments passed versioned health, public routes and protected endpoint checks. Staging additionally rejected unauthenticated, public and foreign-origin session-full actions. Checked startup error windows were empty. No real business session was toggled for QA.

# v1.3.187 release handoff — Owner session-full control

Owners can click a bookable calendar session and check “Session full” in its private roster. The change saves immediately for that occurrence, keeps the session visible, and blocks new public, owner and team bookings plus pending-request acceptance. Unchecking restores actual remaining capacity. Existing attendees, payments, capacity and other recurring dates are preserved. The server scopes writes to the authenticated active owner and serializes them with booking confirmations using the schedule lock. Stale general settings drafts cannot overwrite closure state. No migration is required.

Staging and production rollout pending. Automated regression tests exercise persisted closure/reopen, tenant isolation, stale bookings, pending approvals, recurrence, visibility and roster preservation without changing real business records.

# v1.3.186 release handoff — Agreement-first paid business activation

New paid business signup now enforces the complete order: read and electronically sign the current services/revenue agreement, create the private pending account, then open SelahFlow's Stripe-hosted subscription Checkout from the clearly labeled “Sign up now and pay with Stripe” action. The saved current agreement is verified server-side before Checkout can be created; returning from Checkout does not grant access. Only a signed Stripe webhook and provider-verified paid invoice can mark the requested Professional or Business package paid.

Pending paid businesses can authorize payment before administrator review, but remain unlisted and cannot use the owner workspace. The primary administrator cannot activate or publish a paid business until its signed agreement and verified package payment both match the requested tier. Free businesses require the signed agreement but no card or package payment, and still require primary approval. Registration status and package setup now show the exact incomplete step, safe retry path, verified-payment state and active workspace link. Existing cancellation, refund, dispute, fraud-hold, Customer Portal and tenant-isolation protections remain intact. Automatic Stripe Tax is still not enabled; registration and tax setup remain separate.

Team workspaces now show a top notification bell for confirmed appointments assigned to that exact team account. The durable per-member inbox includes client, assigned member, service, date and time, polls while the workspace is open, and stores independent read/unread state. Reassigning an appointment removes it from an unrelated member's current bell view; existing optional device push remains available separately.

All 528 local tests, TypeScript and the production build pass. Staging and production verification are pending. No real business registration, agreement, payment, appointment, email or administrator setting is created for automated QA.


# v1.3.185 verified LIVE — Team profiles and Stripe package signup

PR #117 merged as e4543feeeddda562d6b4d1719eabab1b6ff3a13b. Final staging 47a5e8061a633c6530833418fca87474e234c4a4 / dep-dbiem10s3ums73eb20jg verified LIVE 2026-10-30T19:19:24Z; production dep-dbiesjnavr4c73blpq3g verified LIVE at 19:23:36Z. Application tree 9a013a8b71ac1f316dc6991a68935ad1aa43feb2 matches the final tested source exactly. All 527 final local, GitHub and staging tests passed, with TypeScript and production builds. GitHub run 41112675419: web 124258784561 and native 124258784994 passed; native validation covers TypeScript, prebuild and iOS/Android JavaScript exports, not signed native binaries or physical NFC. Staging applied 076–077 at 18:41:27Z and 078 at 19:19:05Z; production applied 076–078 at 19:23:32Z. Dedicated database startup preflights passed with schema CREATE true and zero unowned tables; checked final startup error windows were empty. Earlier pending notes below are superseded by this verified rollout.

Public team pages now use business/member-name URLs. UUID and prior-name links continue to resolve; disabled/hidden staff remain excluded. The exact supplied Chris Crawford UUID redirected in the production browser to https://selahflow.onrender.com/team/crawfordhaircompany-chris-crawford. Production Crawford's carousel shows Chris and Alyssa with circular portraits and their saved biographies; actual portrait frames are 160 by 160 with 50% radii and contain the friendly profile links. Screenshot: docs/screenshots/team-profiles-v1.3.185.jpg. Upload controls offer position and zoom in a responsive circular preview; the server validates and applies the crop. Team-created bookings queue one confirmed appointment email with Pay on Site only and cannot open online payment, while public service-enabled choices remain intact. Ten-year recurrence validates/renders safely, counts daily/weekly occurrences without expansion and preserves dated booking identities. Reschedule controls are subtle links/light panels. Share controls sit in the public business/booking header and remain right-aligned when navigation wraps.

Every public registration, including Free, requires the current services/revenue agreement, representative name and separate services/revenue/electronic-consent checks. The server persists the exact agreement, version, signature, digest and time; missing/spoofed acceptance is rejected. Commission consent does not enable either administrator-controlled first-booking/first-membership switch. Existing first-customer eligibility, independent once-per-client conditions, 10% / $5 minimum, returning-client exclusions and unchecked behavior passed regression tests.

Approved owners can authorize Professional $24.99 USD/month or Business $69.99 USD/month in Settings → Payment setup → Manage your SelahFlow package subscription (/settings/package). Free requires no card. Accounts v2 customer configuration reuses the business's account, and provider-verified paid invoices control automatic package entitlements. Separate signed platform webhooks, invoice receipts, payment references, event deduplication, risk holds, customer cancellation portal and archival guards preserve billing isolation. Provider-confirmed cancellation/unused Checkout expiry releases the archive hold; pending collection and unresolved risk remain protected. Migration 078 preserves authorized Free-registration purge behavior while existing connected-billing/financial-history guards remain.

SelahFlow LLC live Stripe configuration was completed without a customer charge: both active monthly prices, a separate /api/platform-billing/webhook destination (including Checkout expiry, invoice/subscription and refund/dispute/fraud events), production price/signing-secret environment variables, and a Customer Portal with invoice history, payment-method updates and period-end cancellation. Existing Connect webhook events were preserved and payment_intent.succeeded plus checkout.session.async_payment_succeeded enabled. Secrets were not committed or printed. Automatic tax is not enabled; tax registration/configuration is separate. Agreement wording has not received legal review. Paid checkout begins only after business approval and explicit owner authorization.

Both environments passed public package/agreement pages, unsigned-signup rejection, private 401, origin 403, unsigned-webhook 400 and commission disclosure/control guard checks. Staging browser verified package-specific signup, Free disclosure, unchecked consent and disabled continuation, readable compact header and right-aligned business/booking sharing. Production verified the original UUID-to-name redirect and populated two-member carousel. No real application, signature, client appointment, photo upload, outgoing email, charge, commission activation or business setting was changed for QA. Private authenticated owner/team browser saves, real subscription Checkout/renewal/refund, provider email delivery and physical-phone acceptance were not exercised; isolated API/database/component tests cover those code paths. Native Tap to Pay still requires signed distribution, entitlements, compatible devices and business activation; do not describe unsigned source/exports as an installed working phone app.

# v1.3.185 release handoff — Team profiles, resilient recurrence and platform packages

Final source verification: all 527 local regression tests, TypeScript and production build pass. Migration 078 scopes dependent agreement/consent cleanup to an already-authorized business purge; existing external billing/history guards remain. Pending Stripe package checkout and unresolved billing risk block archival; provider-verified ended subscriptions or unused Checkout expiry release that hold. The platform webhook includes checkout.session.expired and reconciles its saved customer/business/session before updating status. Customer and other-business records remain isolated. Stripe Customer Portal is configured with invoice history, payment-method updates and cancellation at period end. Final staging and production verification are pending.

Public team pages use business/name slugs, preserve UUID links and old-name aliases, and exclude hidden/disabled staff. Circular portraits have position/zoom upload previews with server-validated square crops. Team workspace booking confirmations are queued transactionally with Pay on Site only; no online checkout or paid marker is created. Business landing/booking headers put Share page at top right and strip private query/fragment details. Session reschedule actions are subtle links; ten-year recurrence validates and renders without flattening every occurrence.

Every public signup, including Free, requires a typed authorized representative name and separate services/revenue/electronic-consent checks. The server validates the current version and saves the exact agreement snapshot and digest. Commission consent never changes administrator-controlled booking/membership switches. Existing first-customer 10% / $5-minimum rules and returning-client exclusions remain independent and tested.

Approved owners may subscribe to Professional ($24.99 USD/month) or Business ($69.99 USD/month) through platform-owned Stripe Checkout. Accounts v2 customer configuration reuses their connected account. Platform billing has a separate signed webhook and revenue ledger, verifies saved business/customer/price/subscription/invoice data, and grants access only from provider-verified paid invoices. Customer Portal supports payment method updates and cancellation. Refund/dispute/fraud events hold billing for review. Support impersonation cannot authorize subscriptions. No real charge, application, signature, client email or business setting is created for QA. Free requires no card. Automatic tax is not enabled; tax registrations/configuration are separate. Agreement text has not received legal review. Native Tap to Pay distribution remains pending from v184.

Stripe operational setup verified 2026-10-30: SelahFlow LLC live account has Professional $24.99/month and Business $69.99/month active USD prices. A separate platform-owned webhook is configured at /api/platform-billing/webhook and its signing secret plus both price IDs were merged into production environment configuration without exposing credentials. Existing Connect destination events were preserved and payment_intent.succeeded / checkout.session.async_payment_succeeded appended. No customer, subscription, signature or charge was created. Stage retains its sandbox boundary. Environment changes automatically initiated a rebuild of the existing v184 main commit; v185 remains unmerged until staging verification.

All 524 local regression tests, TypeScript and production build passed; final package-key whitelist and shared URL-allocation lock also have focused verification. v185 staging/production deployment is pending; do not claim this source release is live until exact staging/production commits and startup logs are verified.

# v1.3.184 verified LIVE — Onsite choices and native payment backend

PR #116 merged as c9942f60f469cda842547a10c3cd7104198029d5. Final staging 838199b7d4f07f98e4ebf55b47f9332fe0523012 / dep-dbic47psrm7s73drdhq0 verified LIVE at 2026-10-30T16:22:14Z; production dep-dbic9iqvcj2c73cg7t1g verified LIVE at 16:26:32Z. Application tree c09f218ec07c6d70be7607a88ef62dd4b4c7b10d matches tested source exactly. All 516 final local, final staging and final GitHub web tests passed, with TypeScript and production builds. GitHub run 41087882532: web job 124173733454 and native job 124173733626 passed. Native checks include dependency install, TypeScript, Expo prebuild and iOS/Android JavaScript bundle exports, not native binary compilation or signing. Migration 075 applied in staging at 15:52:52Z during the initial rollout and in production at 16:26:28Z. Checked startup error windows were empty. Earlier candidate/pending notes below are superseded by this verified status.

Future booking confirmations and transactional emails include service-enabled Make Payment / Pay on Site actions. A private-link POST saves an unpaid onsite preference for pending or approved bookings; email links never mutate on GET. Approval still gates online collection. Owner appointment tables, calendar details and session rosters expose onsite collection/check/cancel; Payment setup selects the connected business's Terminal location. Paid/free/covered bookings do not offer an active collection action. Each business remains isolated; existing IDs, prices, waivers and financial history are preserved.

The native companion source is in native/selahflow-pay. PKCE single-use codes and one-appointment owner-session grants protect Terminal calls; support impersonation cannot delegate collection. Current Accounts v2 card-payments capability must be active. Server-priced card-present intents verify/expire unpaid online Checkout before collection and preserve first-customer commission rules. Signed webhooks or authenticated provider retrieval verify the exact account, attempt, metadata, amount, succeeded status and paid card-present charge before committing one receipt, financial sale, appointment paid marker, commission and confirmation. Paid receipt replay does not restore deleted client rows. Shared locks and provider state prevent competing charges. Online/onsite/cancel/online/onsite transitions use distinct Stripe attempt contexts and clear inactive pointers while retaining history; confirmed cancellation permits a subsequent owner-confirmed linked cash payment without fabricating a Stripe receipt. Active Terminal collection blocks cash and appointment/client deletion. The test-only VAPID fixture pads generated scalars to remove an intermittent invalid-key test failure; no production push behavior changed.

Both environments passed live health/version, setup/authorization page, owner-return redirect, anonymous owner/native API, browser-origin and invalid private-token guards. Staging and production browser checks verified the setup page's pending-distribution wording, Back to owner dashboard → protected sign-in, and Back returning to setup. No real client, appointment, membership, payment, outgoing message, account, signature, consent or business setting was created or changed for QA. Private authenticated owner button/save walkthrough and physical-phone acceptance were not performed; isolated database/API/component tests cover those paths.

Phone Tap to Pay is NOT yet an installed/live mobile release. Signed native builds/distribution, Apple entitlement approval, supported physical devices, Stripe/Apple account linking/terms and activation remain required. No NFC or live charge was tested. The existing Connect webhook destination must subscribe to payment_intent.succeeded before automatic background Terminal reconciliation is relied upon; this provider setting was not changed or verified here. Phone/dashboard Check payment independently retrieves Stripe and reconciles when delivery is delayed. The public /onsite/setup page and native README explicitly state these remaining steps. Do not describe unsigned source or JavaScript exports as a working phone installation.

# v1.3.184 release handoff — Onsite appointment payments

Client confirmations and future transactional emails include service-enabled Make Payment / Pay on Site actions. Private-link POST saves onsite preference for pending/approved bookings without recording received money. Paid/free/covered bookings omit active payment choices. Owner appointment tables, calendar details and session rosters expose onsite collection/check/cancel; Payment setup selects a business-scoped Stripe Terminal location.

Native Expo/React Native companion source is under native/selahflow-pay. PKCE one-use codes and owner-session-bound one-booking grants protect Terminal endpoints; support impersonation cannot delegate native collection. Card-present intents use saved prices/waivers/commission policy, expire verified unpaid online Checkout first, and block competing online/cash flows. Signed webhooks or authenticated provider retrieval verify amount/account/metadata/paid card-present charge before atomically recording a single receipt, revenue event, appointment status, commission and confirmation. Pending collection blocks appointment/client deletion. Migration 075 is additive.

Distribution remains pending: no signed app, Apple entitlement approval, store installation, physical NFC/device acceptance, live payment or business activation has been performed. Setup page and native README state these requirements. The existing connected-account webhook destination needs payment_intent.succeeded subscribed for automatic background reconciliation; authenticated Check payment provides provider verification if delivery is delayed. Testing/deployment verification pending.

# v1.3.183 release handoff — Business sequences for clients without a birth date

Missing birth date uses first/last initials plus a business-wide transactional sequence starting at 1001. Booking, membership and owner-added clients share the allocator. Supplied birth dates retain initials + MMDDYY; existing IDs and historical records are not rewritten. Business-required questions and waiver/payment verification rules remain. Migration 074 adds only a per-business counter and permits an ID-less profile to receive its initial immutable registration identity. Verified staging and production rollout is recorded in AGENTS.md.

# v1.3.182 release handoff — Service payment buttons and team booking defaults

Service catalog supports Make payment, Pay onsite or both (legacy/new default). Public booking shows the saved choices; online checkout enforces the business-scoped catalog choice. Onsite does not mark payment received. Team profile links keep the visible qualified member selected through availability, date/service changes and booking; scheduled sessions retain their assigned host. Approval, waiver, capacity, merchant readiness and verified-payment rules remain. Verified staging and production rollout is recorded in AGENTS.md.

# v1.3.181

- Add a compact Back / Pages menu across business, team, owner and platform pages.
- Show eligible public team portraits and biographies in a business landing-page carousel with profile/booking links.
- Preserve login boundaries, business visibility and private client media.

# v1.3.180

- Add a simple owner how-to PDF with task-based instructions, screenshot, clickable contents and dashboard return links.
- Add Owner guide (PDF) to the dashboard header and Important URLs. Select staging/production return links on the server.

# v1.3.179 release handoff — Social platform logos

Shared platform marks accompany saved social links on business navigation, public team profiles, Important URLs and owner branding fields. Recognizes current business-supported Instagram/Facebook/TikTok/YouTube/LinkedIn/X plus Threads, Pinterest, Snapchat, WhatsApp, Telegram, Reddit, Discord, Twitch and Bluesky for team links. Domain matching uses exact hosts/subdomains and rejects spoofed domains. Unknown websites use a globe. Original SVG geometry is bundled locally from Simple Icons and Bootstrap Icons with source/license records under public/brand/social; inline icons inherit readable theme colors. Existing visible labels, target URLs, HTTPS validation and link safety remain. No database/payment/auth changes. Verification/deployment pending.

# v1.3.178 release handoff — Important URLs

Business settings → Important URLs lists current customer homepage, booking, memberships/status/help, owner login and all workspace/settings destinations, team login/workspace, active visible team public pages, saved social/website/Google listing and directions. Open and Copy URL controls use the current environment origin. Owner deep links validate known section/settings names and preserve existing Stripe/Google return behavior. Client-specific payment, waiver and booking access tokens are never collected into this list. Uses existing authenticated business/team endpoints, no migration or account/data changes. Verification/deployment pending.

# v1.3.177 release handoff — Email-only team login and business branding

Team profile setup includes Enable booking notifications using an account-scoped device subscription. Additive migration 073 queues jobs only from actual appointment inserts, team transfers and appointment assignments; time-off/settings changes never enqueue. A background worker rechecks active business/account/current assignment before sending, uses the existing VAPID provider and staging restrictions, and opens /team/workspace. Delivery attempts are not replayed after ambiguous failures. No real subscription or device permission was enabled for QA; actual phone delivery remains owner/member acceptance.

Team sign-in requires only email/password. Duplicate matching workspace credentials offer a workspace picker after verification, without a business-link field. Login rate limits use normalized email across businesses. Owner create/reset uses temporary password 123456, requiring replacement before private access. Migration 072 applies it only to accounts still awaiting first setup and revokes their pending sessions; chosen permanent passwords remain unchanged. Team private/public pages use the canonical owner theme, fonts, colors, logo and business header, with readable theme-derived surfaces and controls. Existing tenant isolation, profile privacy and package limits remain. Deployment verification pending.

# v1.3.176 sample appointment removal

Removed the client-side six-appointment preview and its Show samples toggle from the shared owner dashboard. Empty businesses, including Crawford Hair Company, now show their actual empty calendar. The preview was never saved to the database; no real appointment, client or payment is deleted. Applies to all existing and new businesses. Verification and deployment pending.

# v1.3.176 release handoff — Team member workspaces (implementation; deployment verification pending)

Owner Settings → Team logins creates/resets/disables one separate login for each saved staff record. Existing server-enforced package roster limits and platform administrator overrides remain authoritative; no extra seats or accounts are provisioned automatically. Generated one-time temporary credentials require rotation; resets revoke sessions. Team accounts/cookies/tables are separate from owner accounts and cannot authenticate to owner APIs. Removed/disabled staff and inactive businesses lose portal/public access.

Team workspace has My calendar, My profile and My clients. Profile supports a portrait, public phone/email, biography and six HTTPS social links. Private client visits are limited to assigned appointments and support notes, client portraits and service images. Images are decoded, size-limited, re-encoded without metadata and authorized on every read; client media never appears on shared pages. Public /team/{id} shows an allowlisted profile and available booking times, linking into the existing booking flow with team/service/date/time preselected. Existing waiver, approval, pricing and payment rules remain in force; staff/owner calendar forms do not collect money.

Owners and team members can select calendar days to book clients or create/edit/remove hourly or multi-day time off. Owner daily grid hours open the same planner. Time off is written under the existing schedule lock, checks appointments/published sessions, and affects availability and atomic confirmation. Owner settings drafts preserve current team time off. Session reschedules cannot move onto blocked time. Additive migration 071 retains existing records. No live team credentials, customer appointments, photos, messages or payments were created for testing.

Verify local and CI tests/typecheck/build, staging then production deployment/health, and live public pages before marking LIVE. Private browser and physical-device acceptance must be reported separately from isolated automated tests.

# v1.3.175 release handoff — Service description and location discovery

Registration requires a public service description (1–600 characters), editable through Business details or Branding and synchronized with the canonical businesses.description used in Discover. Search matches business name and service-description words case/accent-insensitively. Migration 070 fills only empty legacy descriptions from existing business story/industry, and adds an isolated Google location cache. City matching uses verified Google city, owner-entered city and city parsed from full owner addresses; address display prefers verified Google details. The background location worker refreshes selected Place IDs daily, checks every five minutes, expires Google-derived addresses after 30 days, and falls back to owner data if Google is unavailable. It never guesses locations from business names or runs a provider lookup per search. No booking, payment or signature data changes. All 470 tests, typecheck, build and final GitHub validation 40901084624 passed. PR #107 merged as eda071ea172a2b56687da5ff0fbd900a07c8924a. Final staging 0dce445c4d3aadc9fcf80a8106967015899ce8e8 / dep-dbhm9tjbc2fs73es42dg and production dep-dbhme6h5efls7392h25g verified LIVE. Migration 070 applied in both environments. Staging was verified before production promotion. Live registration DOM requires the 600-character description; server rejection checks created no real account. Production keyword/city searches, unknown-city exclusion and saved-address compatibility passed. Arcila matches Google's Lutz city and its owner-saved Wesley Chapel city. Production refreshed two selected Google locations; staging has no server-side Places key and uses owner-location fallback. Capstone's legacy street-in-city value is preserved as an address but is not treated as a city; profiles without valid city data still need owner completion. Both environments passed health/version and commission protection smoke checks; no error-level entries in checked rollout windows. Physical-device and private owner-browser saves were not performed. Screenshot: docs/screenshots/services-location-form-v1.3.175.jpg. No real customer booking, charge, signature or outgoing test message was created.



# v1.3.174 release handoff — Soft business-logo presentation

Business logos use consistent light neutral gradient panels, rounded image edges, subtle borders/shadows and balanced spacing. Discovery categories appear below the logo panel so all businesses have the same brand area. Shared header, business home and owner brand preview use matching treatments. Original uploaded assets, colors, transparency and full logo proportions are preserved; no blend modes, recoloring or background removal. All 465 local and staging tests, typecheck, builds and GitHub validation 40890153507 passed. PR #106 merged as 9a2eafa6a56e953063c1d0bf3141e5b1979aaae3. Production dep-dbhldvks728c73d9d3rg and staging dep-dbhlbcgu01pc73bkgri0 verified LIVE. Live browser verified the carousel panels and shared business header/home frames, preserved Arcila image proportions and 12px image corners; the branding preview is covered by typecheck/build and existing source regression checks. Both environments passed health/version and commission protection smoke checks. No error-level entries in checked rollout windows. No physical-phone or private owner-browser acceptance was performed. Screenshot: docs/screenshots/soft-logos-v1.3.174.jpg.

# v1.3.173 release handoff — Discover business carousel

Discover search results use a horizontal native-scroll carousel with mobile next-card peeking, snap points, previous/next controls, keyboard arrows, position feedback and reduced-motion support. Search, URL history, business branding, Google photos/reviews, booking and directions links remain intact. No automatic rotation, data or payment changes. Verified v1.3.173 LIVE in production (PRs #104/#105, final 0d3f89d2af2a9c456a522a97f6f82cc0255a8137, dep-dbhl0eh5efls738vud4g) and staging (81ea3c524df1ec5c31cc3433baa572acd4e482a4, dep-dbhl0bon74is73eatvs0). All 465 tests, typecheck and build passed. GitHub 40884711640 passed; final 40886352623 passed on retry after the known intermittent push-key fixture failure, which also passed in isolation. Browser verified carousel start/end boundaries, horizontal movement, no page overflow, one-result/empty-result/clear searches and retained booking links; staging controls verified. Physical-phone swiping was not tested. No data/payment/provider changes.



# v1.3.172 release handoff — Payment setup and Helcim activation requests

Business settings → Payment setup replaces the Stripe-only category. Owners can save an isolated Stripe/Helcim setup preference, review dated U.S. fees/pros/cons with official-source links, open Helcim’s website, and record an activation request visible to the primary platform administrator. Existing Stripe connection/help and administrator-only commission controls remain available. Migration 068 adds preferences; migration 069 preserves archive/restore and explicit permanent-business-purge compatibility. Neither migration reroutes checkout, changes merchant connections, deletes a business or migrates subscriptions.

PARTIAL IMPLEMENTATION: Helcim payment collection is NOT implemented or activated. Preference/request and verified active provider are explicitly distinguished. Remaining work: Helcim partner setup, confirmation of exact 10%/$5 first-purchase commission collection, native booking checkout, recurring billing, provider-verified reconciliation, refunds and end-to-end sandbox acceptance. Do not advertise Helcim as a working checkout provider.

Verified LIVE after the user authorized publication and deployment: PR #103 merged as e3d214541c944569d76efda0e2997559f1213125. Production deployment dep-dbhk117avr4c739un8tg LIVE October 29, 2026 at 12:50:00.150978Z (8:50 a.m. EDT). Final staging commit 4bab58416247ca7ae8360165f7e3bda06b6213ca, deployment dep-dbhjs8v1f1fs73dssl10 LIVE at 12:47:24.621005Z. Both deployed source trees are f1d49d115a40ae16f1d695bb07012c41f4c00455. The first staging revision was superseded by the final cleanup-compatible revision.

All 464 final local and Render staging tests, TypeScript and production builds passed. Final-head GitHub validation 40874838687 also passed. Tests cover tenant isolation, archive/restore/purge compatibility, actual provider API authentication/origin/size/field validation, comparison rendering and pending-versus-active status. Production applied migrations 068–069; final staging applied 069 after its earlier revision applied 068. Startup preflights confirmed the dedicated database/role, schema CREATE and zero unowned tables. No error-level entries appeared in the checked final startup windows. Both environments passed read-only health/version, booking/payment shells, protected owner APIs, invalid-invitation/no-store and commission safeguards. The new provider API rejects anonymous GET/POST with 401 and foreign-origin POST with 403, retaining private no-store responses.

No real business preference, customer booking, charge, credentials or outgoing test message was created for QA. Private authenticated owner-browser and physical-device acceptance were not performed; browser verification reached the sign-in wall. Retired service untouched. Documentation-only [skip render] commits may follow running application SHAs.

# v1.3.171 release handoff — Neutral Google cards

Shared compact and full Places UI Kit cards force the supported light color scheme with a neutral off-white surface, readable dark text, muted green links/buttons and subtle borders. Applies across business pages and expanded reviews, including devices preferring dark mode. Google content, attribution, photos, review links and loading behavior are preserved. No provider configuration, data or payment changes. All 460 tests, typecheck, production build and GitHub validation 40862283277 passed. PR #102 merged as 33775ed70c3fe6ebf4e88f70326d0c1b7111dc2e. Production dep-dbhiignb9u1s739tibi0 and staging dep-dbhifkifngtc73boie20 verified LIVE. Live browser verified compact/full card backgrounds rgb(247,248,246), forced light scheme, photos, attribution and expanded reviews. Both environments passed health/version and commission protection smoke checks. Screenshot: docs/screenshots/google-neutral-v1.3.171.jpg. Physical iPhone dark-mode acceptance was not performed.

# v1.3.170 release handoff — Administrator-only commissions and $5 minimum

Only the primary platform administrator can toggle booking or membership commissions. Owners can review activity, accept revised terms, and expire unpaid checkouts; owner API rejects activation fields with 403. New first-purchase commissions use max(10%, $5), capped at eligible payment basis minus one cent. Free purchases remain exempt. Booking and membership eligibility remain independent, renewals remain exempt, and existing checkout quotes/refunds retain their stored fees. Revised v2 terms require owner acceptance before new fees can be collected; existing activation flags are retained. No business is activated automatically.

All 460 tests, typecheck, build and GitHub validation passed. PR #101 merged as 846fc9cfc58e82a6dd8f38dfc575d8e94f68c560. Production dep-dbha12ks728c73crtou0 and staging dep-dbh9ua9iimcc73e8ul10 verified LIVE; commission disclosure/authentication/origin smoke checks passed without real payments. No real payments or customer data changed for verification.

# v1.3.169 release handoff — Administrator waiver activation

Platform administrators manage template selection, legal-review records and activation through Platform Admin → business directory → Open owner workspace for support → Settings → Service catalog → Participation waivers. Ordinary owners cannot change category templates or either legal-review record. The settings transaction rechecks the actual authenticated account role against the persisted settings; forged browser flags and stale owner submissions do not grant approval authority. Existing signed records remain intact. Source implementation; deployment pending.

# v1.3.168 release handoff — Industry-specific waiver generation

PR #99 implements opt-in category waivers across businesses. Owners select a category (suggested from their registered industry), add business and service terms, preview the complete document and record a completed legal review before saving activation. The document explicitly lists all waiver-required services; it is a business-wide scope, not a separate signature per booking. Medical, veterinary and other specialized/unknown industries default to general and require their own tailored review.

Category consent is bound to business/client identity, template version, category and SHA-256 of legal content. Service names, descriptions, scope and custom terms affect the fingerprint; palette-only changes do not. Optional media permission starts unchecked. Existing legacy documents, signatures and their compatibility rules remain unchanged until explicit activation. Migrations 066–067 retain signed content revisions while preserving legacy per-version uniqueness. No actual business template or legal review is activated by deployment.

Verified LIVE in production: PR #99 merged as af2e874d7a85e5026b40f533f6a11ae0ae6fa05c; deployment dep-dbh7bqvb9u1s73an0f0g LIVE 2026-10-28T22:25:18.032863Z (October 28, 6:25 p.m. EDT). Final staging commit 9c8d90f75e3064e8d6e89226f760eb4de068e99e, deployment dep-dbh74m6o6a2s738bq6tg LIVE 22:23:10.048889Z. Both share source tree 68dbe523ab69a8ec4c8cb8f59c4a65c1b26e50ae. Production applied migrations 066 and 067; staging applied 067 after its earlier queued revision. Both startup logs confirm database readiness; checked final startup windows contain no error-level entries.

All 458 local and Render staging tests passed; TypeScript and production builds passed. Final-head GitHub validation jobs 123130592196 and 123130558170 passed. Actual booking-handler tests cover category signing and status, stale review rejection, retained legacy evidence and fresh consent after content changes. Rendered UI coverage checks owner/client wording and optional unchecked media consent. Initial validation found two outdated test harness/assertion dependencies, corrected before final checks. Both live environments passed health/version, booking/payment shells, protected owner API and invalid-invitation/no-store checks.

No actual business template or legal review was activated. No legal review has been performed by this implementation. Physical-phone and authenticated owner-browser acceptance were not performed. No real customer signature, booking, charge or outgoing message was created for QA. The retired service was untouched. Documentation-only [skip render] commits may follow the running application SHA.

# v1.3.167 release handoff — Deduplicate business introductions

All tenant business landing pages render their introduction through shared businessIntroLines. Matching tagline and business-model/description text appears once, comparing case, whitespace and Unicode compatibility forms. Distinct wording remains visible in its original form. A tagline-only business displays it once; empty introductions retain the generic fallback. Description precedence and saved business records remain unchanged. Discovery, booking and membership surfaces were reviewed for the same repeated-field pattern; they do not render this pair twice.

Production verified LIVE: PR #98, merge fa81b0bd1506fd22131f5ab22d3dea7acb43a643, deployment dep-dbh4kjh5efls73ar1d70 at 2026-10-28T19:19:32.312924Z (October 28, 3:19 p.m. EDT). Staging commit 57e5424fdacca5e10ad38f1b3bb9a79d7180f141, deployment dep-dbh4i4flk1mc73f0ihd0 LIVE 2026-10-28T19:20:04.264674Z (October 28, 3:20 p.m. EDT). Identical application tree f1f80dde49ffd2561a0b0a7ec96e6095bba1839e. Both startup logs confirm database readiness and Next ready; no error-level entries appeared in the checked rollout windows.

All 454 local tests, typecheck and production build passed. GitHub validation 40752124356/job 123041306266 passed tests/typecheck/build/assets. Regression coverage renders the actual tenant landing page for two businesses and checks duplicate versus distinct text, case/spacing, tagline-only profiles, description fallback and empty content. Both live environments passed health/version, booking/payment shells, protected-owner API and invalid-invitation/no-store smoke checks. Read-only live workflow 40752124337/job 123046035893 passed after rollout, including assistant/status and commission safeguards; its initial attempt preceded deployment.

Browser acceptance reproduced the old duplicate on production Capstone, then verified exactly one landscaping introduction after deployment. Production Arcila likewise displays one fitness introduction. Staging Capstone also displays the introduction once. Distinct descriptions remain covered by rendered fixture tests without changing real business settings. Physical-phone and private authenticated owner-browser acceptance were not performed for this display-only change.

No database migration or authentication, payment, email or customer-data changes. No real booking, charge, outgoing email or settings mutation was made for QA. The retired service was untouched. Documentation-only [skip render] commits may follow the running application SHA.


# v1.3.166 release handoff — Business-neutral language and clearer navigation

Shared platform wording uses business, client, service, team member and booking in place of salon/studio/player/coach assumptions. Generic fallback catalogs and sign-up default to a neutral business category; industry-selected catalog examples and all saved business branding, service names and custom question/page wording remain intact. Client ID is explained as the same identifier used for memberships; booking status does not imply that a membership is required. Shared errors, membership forms, page-editor previews, payment guidance and preparation-time labels are updated.

Public desktop/mobile navigation shares the same destinations, with Find a business and Client help distinct from Business sign in, business information and SelahFlow business plans. Business pages distinguish Business home, Book a service, Memberships and Booking & membership status, with separate owner access and business discovery. Status navigation returns to the status panel even from later booking steps. Owner navigation has four task groups and clearer labels while preserving all 12 internal destinations, search aliases and unsaved-change protections. Edit services opens the correct catalog settings, and the profile shortcut stays within the current owner/support workspace. A booking-status page without a selected booking has a recoverable empty state instead of indefinite loading.

Production verified LIVE: PR #97, merge a26bc669c6cba3435367c63059ed342feb9734b7, deploy dep-dbh4d3a9lscs738389c0 at 2026-10-28T19:03:20.9709Z (October 28, 3:03 p.m. EDT). Staging c6e99289944e1824f6e6384759f6392c480f78c4, deploy dep-dbh3a8sipgvc73dlkc60 LIVE 2026-10-28T17:55:05.041689Z (October 28, 1:55 p.m. EDT). Identical application tree 920c30d5f78985382fc806865864e9de6b15aed9. Startup logs show database readiness and Next ready; checked error-level startup windows contain no entries. No new database migration.

All 452 local tests, typecheck and production build passed. GitHub validation 40739007514/job 122995188902 passed tests/typecheck/build/assets. Read-only live workflow 40739007459/job 123037037517 passed after rollout; its initial attempt preceded deployment. Both environments passed health/version, booking/payment shells, invalid-invitation/no-store, anonymous support entry 401/private-no-store, foreign-origin support entry 403, owner APIs 401 and anonymous workspace login redirect.

Public browser acceptance: staging discovery displayed the shared menu and tenant service links. Both staging and production progressed safely from service selection to time selection and returned through Booking & membership status to the expanded client-ID checker. Production repeated that recovery while already on the status URL. Production business landing retained branding/catalog content and displayed the new business navigation. Production client booking details without a selected booking displayed No booking selected and a discovery recovery link; Client help opened the booking-help anchor. No personal client data was entered or booking submitted.

Authenticated private owner-browser and actual physical-phone acceptance remain unverified because the available browser requires administrator sign-in. React-rendered and workspace regression tests cover menu parity, preserved owner destinations/search aliases, custom overrides and status distinctions; this does not prove universal usability. No provider/authentication changes, real customer mutation, booking, payment or outgoing email for QA. Saved business content and business-specific client PDFs remain intact. The retired service was untouched. Language/navigation audit: docs/BUSINESS_LANGUAGE_NAVIGATION_AUDIT.md. Documentation-only [skip render] commits may follow the running application SHA.


# v1.3.165 release handoff — Proxied workspace access and unlimited support

Fixes valid owner and administrator support workspace requests being rejected when the browser uses the public HTTPS app URL but the server receives an internal proxy URL. Workspace referrer validation uses the existing trustedOrigin configuration (APP_URL / RENDER_EXTERNAL_URL), retaining exact business scope, stale-tab rejection and trusted-origin write checks. A regression first reproduced the previous AUTH_REQUIRED failure with an internal localhost request, then passed for ordinary-owner and support GET/POST requests. The actual requireOwner helper was also tested with an internal 0.0.0.0 request URL and public workspace referrer.

Removes the separate one-hour support timer. A selected business remains available while the administrator's normal login is valid, until explicit exit, switch, logout, role revocation or business deactivation. Migration 065 changes legacy support expiry defaults/existing values to infinity, retaining the column for compatibility with the previous running instance. New selections are unlimited; the resolver no longer uses old support timestamps as an access cutoff. Normal login expiry and password requirements remain enforced. Directory and workspace wording state no separate support limit. This does not create an indefinitely authenticated login.

Production verified LIVE: PR #96, merge 5179b02aeadc6f9b897228c505e0a34cb4973c31, deploy dep-dbh2sdp7lnhs738h55tg at 2026-10-28T17:19:29.102573Z (October 28, 1:19 p.m. EDT), application tree 9da83044f78da6df1d59e9d1cd3836498aa0315b.

Staging verified LIVE: e77279d56dbcd1a4100a45f39c1f37393669ae86, deploy dep-dbh2pivf3r2c73eo3p70 at 2026-10-28T17:19:41.292803Z (October 28, 1:19 p.m. EDT), same application tree 9da83044f78da6df1d59e9d1cd3836498aa0315b. Both startup logs confirm migration 065 applied and database initialization ready; no error-level entries appeared in the checked startup windows.

All 447 local tests, seven focused support tests, typecheck and production build passed. GitHub validation 40733342180/job 122975214589 passed tests/typecheck/build/assets. Render staging also passed all 447 tests with zero failures, typecheck and build. New coverage includes the reproduced proxy mismatch, ordinary-owner and support access, exact tenant scope/foreign-origin rejection, actual authentication helper, existing timed selection migration and unchanged login expiry. Existing support role revocation, logout, account identity, tenant switching, audit and purge-compatibility checks remain.

Both final live environments passed health/version, anonymous support entry 401/private-no-store, foreign-origin support entry 403, protected owner API 401, anonymous workspace redirect, booking/payment shells and invalid-invitation/no-store checks. Read-only workflow 40733342303/job 122980086019 passed after rollout, including deployment endpoints, public assistant/status checks and commission safeguards. Its initial attempt ran before expected v1.3.165 was available.

Authenticated private UI acceptance remains unverified: the available browser was at the administrator sign-in page. Build, real helper and PGlite regression evidence does not claim actual private browser/iPhone acceptance. No real customer record, booking, membership, signature, charge, outgoing email, owner password, login lifetime or provider credentials/configuration changed for QA. The retired service was untouched. Documentation-only [skip render] commits may follow the running application SHA.


# v1.3.164 release handoff — Administrator owner-workspace support

Platform Admin → All registered businesses → select an active business → Open owner workspace for support. The administrator uses their own login, independently of the owner's password or forced password change. The selected business's normal workspace and existing permissions/entitlements apply. A banner identifies support mode, its real edits and one-hour expiry, with Exit support. The directory also provides End any active support session. One business is selected per login/browser; stale workspace tabs are rejected after a switch or exit.

Server-side support selections are bound to the actual administrator login/session hash, with role rechecks and active-business/expiry validation. Platform/account endpoints keep the original administrator identity. Same-origin workspace context is required for scoped API requests, and writes require the existing trusted origin. Normal owners cannot select support; role revocation, logout, login expiry and support timeout prevent its use. Ordinary owner and support signed-waiver viewing remain available. Owner Google OAuth is excluded; device notification controls are hidden during support to avoid enrolling the administrator as the owner.

Additive migrations 063 and 064 store selections and audit entry, explicit exit and authorized workspace request attempts using original actor/business IDs, timestamp, method and path, without request bodies, credentials or customer details. A deliberate business purge clears its support selections; opaque audit attribution survives business/account deletion. Existing purge authorization, archival prerequisite, payment checks and explicit confirmations remain intact. No actual business/account purge was performed for QA.

Production verified LIVE: initial PR #94 merged as 2dbbdbb88dbf92dd0e53271593706f98d3debd04; final compatibility PR #95 merged as 8b378cc2bc480475611e983532ed932058abd775. Final deployment dep-dbh132h42hec739ger80 LIVE 2026-10-28T15:17:14.916184Z (October 28, 11:17 a.m. EDT), application tree b67daeefa1c02383cd91c9ddcec7d1180e15e360. Production startup logs confirm both migrations applied across the two rollouts and database initialization ready. Final production security and read-only booking/payment-shell/invitation checks passed; no error-level entries appeared in the checked final startup window.

Staging verified LIVE: 2ca2aa2434e6a5c5dc610596aebd779aa3597484, deployment dep-dbh116bvvlss73bbab6g at 2026-10-28T15:22:11.863007Z (October 28, 11:22 a.m. EDT), identical application tree b67daeefa1c02383cd91c9ddcec7d1180e15e360. Render staging passed all 445 tests, typecheck and build; startup logs confirm migration 064 and database initialization ready. No error-level entries appeared in the checked final startup window. Final staging security checks reject anonymous support entry with 401 and foreign origins with 403, preserve private/no-store responses and protected owner endpoints, and redirect anonymous workspace visits to login. Staging booking/payment-shell and invalid-invitation smoke also passed. Earlier staging revisions completed before the final queued compatibility build.

All 445 final local tests passed, including five focused support tests using PGlite and the actual requireOwner integration. Typecheck and production build passed. Coverage includes independent passwords, ordinary-owner denial, original account/admin identity, tenant switching, stale tabs after exit, foreign origins, expiry/revocation, inactive businesses, ordinary/support waiver viewing and purge/audit compatibility. GitHub final validation 40713406893/job 122904511532 passed tests/typecheck/build/assets; original feature validation 40711496093/job 122897689894 also passed. An intermediate additional local run encountered an existing randomized Web Push fixture failure; isolated recheck and the final complete suite passed without changing provider code/configuration.

Read-only live workflow 40711496008/job 122908471591 passed deployment endpoints, public assistant/status checks and commission safeguards after production rollout. Its initial attempt ran before the expected deployment was ready; final staging compatibility rollout is verified separately below.

Authenticated private support UI acceptance remains unverified because the available browser required administrator sign-in. Entry/banner/exit wiring and authentication behavior were covered by build and regression checks; no actual phone-device acceptance is claimed. No real client record, booking, membership change, signature, charge, outgoing email, owner password or provider credential/configuration was changed for QA. The retired service was untouched. Documentation-only [skip render] commits may follow the running application SHA.


# v1.3.163 release handoff — Bottom View all Google reviews control

Full Google review panels now have an explicit View all Google reviews footer button immediately below the Google-rendered content. UI Kit uses the loaded widget's documented place.googleMapsLinks.reviewsURI after gmp-load, validated as an HTTPS Google URL, without extra provider requests. Missing/invalid links retain the exact-Place-ID Maps fallback. Direct Places mode also has the bottom control. Complete history opens on Google Maps; the public widget's inline selection is not represented as all reviews. Google attribution and display toggles remain intact. No Pro widgets, provider configuration, schema, customer, booking, payment or email changes.

Verified LIVE in canonical production: PR #93, merge a3a2b762809429510f387e2e0845ae0b106c56de, deployment dep-dbh0294s728c739c3m00 at 2026-10-28T14:07:17.717682Z (October 28, 10:07 a.m. EDT). Staging ed3b2f654c93e5dcb6c9782fa11504ffa19485d0, deployment dep-dbh02559fdbs73d6u3g0 LIVE 14:13:45.182745Z. Identical application tree cb1b1d8a7db1c614297dc610efbeacd20ad0177f.

All 440 local tests, typecheck and production build passed. GitHub validation 40702486954/job 122865704896 and Render staging also passed all 440 tests, typecheck and build. Regression checks verify full-panel footer presence, compact/disabled-review omission, exact-ID fallback, native gmp-load direct reviews URL capture and malicious/non-HTTPS/credential-bearing URL rejection. No extra server/provider lookup is introduced for native review links.

Actual production browser verified the new bottom control on Capstone's landing page immediately after Google's review panel and attribution, before the final booking CTA. After Google's gmp-load, the button href became its supplied direct Reviews URL. Clicking opened Capstone Pavers LLC on Google Maps with Reviews selected and 34 reviews shown at the checked time. This is access to all reviews on Google Maps, not inline pagination of the entire history. The public widget still shows Google's selection. Loading complete history inside SelahFlow would require a different authorized integration such as Business Profile reviews access; this release does not claim to implement that.

Both environments passed read-only health/version, booking/payment shells, protected owner endpoints and invalid invitation/no-store smoke. No error-level production startup entries appeared in the checked window. Final staging error check and live workflow: no staging error-level entries in the checked startup window; live workflow 40702486581/job 122870773135 passed after rollout. The initial live workflow attempt ran before the expected staging version was available. No customer/business records, listing selection, consent, signature, payment, email or provider credentials were changed for QA. No physical iPhone acceptance was performed. The legacy service remains untouched.


# v1.3.162 release handoff — Card reviews and centered photo gallery

Discovery cards provide View all Google reviews and a lazy Read Google reviews here disclosure. UI Kit mode uses native Google reviews on expansion; direct Places mode requests review text only after expansion and uses Google's reviewsUri when supplied. Complete review history opens on Google Maps; Places API only supplies a selection. Google review/photo display settings and tenant isolation remain respected.

Business landing pages center the gallery between Services & prices and the final booking CTA. Native Essentials media enables Google's photo lightbox viewer; existing direct Places carousel supports previous/next, keyboard arrows and touch swipes. No Advanced/Pro widgets, scraping, persistent Google content cache, provider credentials, schema or booking/payment/email changes.

Verified LIVE in canonical production: PR #92, merge 414ee38a15932ebd6ca912a7a53302aa2c888f6e, deployment dep-dbgvnq29lscs7396lkn0 at 2026-10-28T13:44:51.354693Z (October 28, 9:44 a.m. EDT). Staging 0152e5d7eb923753fe6a87452c00eae93d851972, deployment dep-dbgvncl9el5s73dkrvrg LIVE 13:49:40.480698Z. Identical application tree c4a9f4a4ef2c923b73bca3d408c415dd373ee0db.

All 440 local tests, typecheck and final production rebuild passed. Focused review tests cover expansion-only loading, selection versus complete-history link, UI Kit branch avoiding direct server review lookup, preserved author/source and safe native/direct links. Native widget configuration verifies the media lightbox and shared Essentials library. Manual execution of actual direct-carousel handlers verifies keyboard next/previous, wraparound, horizontal swipe and vertical-scroll preservation. GitHub validation 40698871936/job 122852914495 and Render staging passed all 440 tests, typecheck and build.

Actual production browser verified the landing gallery between Services & prices and final booking CTA, centered in page content, with 900-pixel Google component width at the checked desktop viewport. Opening a photo starts Google's in-page viewer; next changes the displayed image and close restores the landing page. Discovery Read Google reviews here expands native reviews in a bounded scrollable panel. View all Google reviews opened the exact Arcila Training Google Maps profile; its Reviews tab exposes the complete eight-review history at the checked time. Complete history is on Google Maps, not claimed as all reviews returned inline. Legacy direct Places may supply up to five review texts and uses Google's direct reviewsUri when available.

UI Kit mode was observed active for Arcila Training and Capstone before this release, superseding earlier pending-key snapshots. No credential/configuration changes were made for this task. Native UI Kit photo/review rendering was live tested; direct Places carousel interactions were tested with fixtures. No physical iPhone acceptance or changes to actual Google listing selections, customer data, bookings, consent, signatures, payments or outgoing email were performed. Legacy service remains untouched. Both environment read-only health/version, booking/payment shells, protected owner endpoints and invalid invitation/no-store smoke passed. Production startup error-log check returned no entries in the checked window. Final live workflow: 40698871984/job 122857130672 passed after rollout; its initial attempt had run before the expected staging version was available. Staging startup error-log check also returned no entries.


# v1.3.161 release handoff — PDF Back to app button

The published Arcila Training client guide includes a visible, clickable Back to app button in the footer of every one of its 20 pages. Each points to https://selahflow.onrender.com/arcillatrng. Original guide text, original link annotations and bookmarks are preserved. Help and assistant instruction links continue using the same business-specific PDF. No provider, schema, booking, membership, payment or email changes.

Verified LIVE in canonical production: PR #91, merge f4d6f4dcf310f3965ccc566c68f48acc342a4246, deployment dep-dbgu5tajnfac739nqmr0 at 2026-10-28T11:58:14.635294Z (October 28, 7:58 a.m. EDT). Staging e701e9553ecf22bb0c587ba1279e48c576b9a0e3, deployment dep-dbgu5fmk1f9s73963f6g LIVE 2026-10-28T12:03:38.344458Z. Identical application tree 2f3a12397e51e4d1f0b088bb408d0eb26251b2c5.

All 439 local tests, final typecheck and production build passed; GitHub validation 40683727495/job 122800667034 also passed tests/typecheck/build/asset measurements. An initial local typecheck overlapped the Next build's generated-file replacement; the sequential rerun after the build passed. Do not run these two checks concurrently against the same .next directory.

PDF validation confirms exactly one Back to app label and canonical business URI annotation on each of 20 pages, with original page text, original annotation counts plus one button per page, and bookmarks preserved. All 20 page footers were rendered and visually inspected, with full-page checks on pages 1, 8 and 20. Final PDF SHA-256 829fa16cfe481087c3c5d3c595f48e9a20dab17123d98e3c34bd92b352e454d7; 1,452,016 bytes. Production serves these exact bytes. Actual Chrome PDF viewer click on page 1 returned to https://selahflow.onrender.com/arcillatrng. No physical iPhone acceptance is claimed. Future business guides should include the same navigation pattern pointed to their own business page, never another tenant's guide/URL.

Production read-only health/version, booking/payment shells, protected owner APIs and invalid invitation/no-store smoke passed; no error-level startup entries in the checked window. Final staging verification: all 439 tests, typecheck/build, live endpoint smoke and exact PDF byte checks passed; no error-level startup entries in the checked window. Live workflow 40683727568/job 122804160932 passed after rollout; its initial attempt had run before staging was ready. No customer data, booking, consent, signature, payment, email or provider setting was changed for QA. Old service was not resumed. Google UI Kit provider activation remains separate and pending its dedicated browser key.


# v1.3.160 release handoff — Booking warning placement and larger discovery logos

Booking review errors, including exhausted membership weekly allowance, appear once below the Request booking footer. Earlier-step errors remain next to their step. Existing alert accessibility and booking validation remain. Discovery business logos now use responsive 120–180-pixel-wide, 3:2 contain frames, with matching intrinsic dimensions and preserved SelahFlow fallback. Industry labels wrap beside the larger logo. Applies across all businesses. No migration, provider configuration, membership rules, payment or email changes.

Verified LIVE in canonical production: PR #89 merged as 0c6a9c6a04c0db7d5460de6180b71250f78d5584, then PR #90 containment correction merged as 44848aa6f73d169f838ff3bbf85df4b4ec1a9b89. Final production deploy dep-dbgtm1ks728c7398ft7g LIVE 2026-10-28T11:24:38.743291Z (October 28, 7:24 a.m. EDT). Final staging 45ab9d37236dcf77cdd666bffda1a5ce52f2f7c9, deploy dep-dbgtl97lk1mc739f3cjg LIVE 2026-10-28T11:28:56.44084Z. Identical final application tree 2253ba15b5674c5e9c7750e03130a2e5af4c245b.

All 439 local tests, typecheck and production build passed. Focused logo checks and a production rebuild passed after the CSS containment correction. Final GitHub validation 40679285843/job 122785546655 passed all tests, typecheck, build and asset measurements; initial validation 40678041142/job 122781354793 also passed. Actual booking JSX rendered with mocked client state verifies exactly one sample allowance warning below Request booking on review, with earlier-step warnings retained above their fields.

Live production browser measured all four discovery logo images/frames at 159.36 by 106.23 pixels at the checked desktop viewport, compared with the earlier 50-pixel square images. All images loaded, use contain sizing and fit entirely within the frames, including both SelahFlow fallbacks. Initial visual verification caught square fallback clipping; PR #90 corrects this. Actual service/time/review navigation passed without client data entry, consent, submission or payment. No real membership allowance rejection or physical iPhone acceptance was performed; warning placement is verified with the actual JSX render and source guards. Responsive width rules are 120–180 pixels. No customer/business records, provider credentials, emails or charges were changed for QA. Legacy service was not resumed.

Both initial deployments passed health/version, booking/payment shells, protected owner APIs and invalid invitation/no-store checks. Live workflow 40678041029/job 122784873460 passed after both initial rollouts; its initial attempt had run before the expected version was available. Final production startup error-log check returned no entries in the checked window. Final staging verification: final live endpoint smoke and deployed CSS checks passed; final Render staging passed all 439 tests/typecheck/build; no error-level startup entries in the checked window. Final production endpoint smoke also passed. Google UI Kit provider activation remains separate and pending its dedicated browser key.


# v1.3.159 release handoff — Administrator Google listings and Places UI Kit Essentials

Primary platform administrators can search public Google listings by name/city, including service-area businesses, verify the match and save/remove the listing and review/photo display options. No owner Google connection or manual Finder ID is required. Google must still return a valid public listing ID; unavailable listings cannot be fabricated. Existing owner OAuth tokens remain untouched.

A dedicated GOOGLE_PLACES_UI_KIT_BROWSER_KEY opts the public gallery into Google-rendered Essentials Place Details/Compact components, lazy loaded on visibility without a map or Advanced/Pro components. Only this intentionally public browser key can reach the client; existing server keys remain private. Without the dedicated key, the existing Places display continues. Widget failures show a Google Maps link rather than extra paid fallback requests. Provider enablement and a website-restricted browser key are required before UI Kit can be live verified. No migration or payment/email changes.

Verified LIVE in canonical production: PR #88, merge 6dec3d86cdf271be98113a9043d6376afb431920, deploy dep-dbgli4p5efls73ap7fq0 at 2026-10-28T02:10:09.369129Z. Final staging a15883e11cb46fe89646bbfebb55e3647d5e4127, deploy dep-dbglh8ncv52s739u7rb0 LIVE 02:14:39.670048Z. Identical application tree 9bac4aaddb59182fa1efae1bc39d81945b45ac40. Local, GitHub validation 40618973012/job 122588053329 and Render staging passed all 439 tests, typecheck and build. The initial local run identified a test-harness import issue; the corrected final suite passed. Superseded initial staging deployment dep-dbglgmgae00c73cq3b6g was canceled to run the corrected revision.

Production read-only checks passed health/version, primary-admin endpoint anonymous 401/private no-store, same-origin anonymous POST 401 and foreign-origin POST 403, safe Google public projection, discovery, booking, membership and PDF responses. Existing production Places display remains active with five reviews and ten photos for Arcila Training. No error-level entries appeared in the checked startup windows. No actual Google listing selection, booking/customer mutation, charge or outgoing email was performed for QA. Retired service was not resumed.

UI Kit activation remains PENDING: GOOGLE_PLACES_UI_KIT_BROWSER_KEY is absent, and Google Cloud API/key setup must be completed using docs/GOOGLE_PLACES_UI_KIT_SETUP.md. Existing server-key Places display continues until then. Actual authenticated admin UI selection and real Google UI Kit rendering have not been verified. New admin authorization, provider search/exact-match validation, tenant isolation, OAuth preservation, audit/removal, public credential separation and standard Essentials widget behavior passed synthetic/provider regression tests. Final live workflow initially ran before staging was ready and was rerun after both deployments became live. Staging read-only endpoint checks also passed. Final live workflow 40618973028/job 122590757527 passed deployment, assistant, synthetic status and commission checks after both rollouts.

# v1.3.158 release handoff — Compact help button

The floating client guide is a 44-pixel question-mark circle centered above the SelahFlow assistant. Accessible PDF labels and the assistant instructions link remain. Transparent wrapper areas pass clicks through, and the owner workspace hides both floating controls while the mobile menu or booking modal is open. Existing guide availability remains business-specific. No migration/provider/payment changes.

Verified LIVE in canonical production: PR #87, merge 573233393d1c85ce17e1938af20401a6f1777412, deploy dep-dbgk1cm7bikc73dkabl0 at 2026-10-28T00:26:02.297537Z (October 27, 8:26 p.m. EDT). Staging a1b0b7fbb06a10a53113bb7ba5de25a0c55bc730, deploy dep-dbgk0jg8v5cc73ft6llg LIVE 00:29:58.902617Z. Identical application tree 2a3bbe39a5be0e4bd71dd8c40c542ce8f4283e91. Local, GitHub validation 40608362159/job 122553450540 and Render staging passed all 434 tests, typecheck and build.

Actual production browser checks verify visible help text is only ?, 44x44 dimensions, circular shape, exact horizontal center alignment with the assistant, 12-pixel gap, wrapper pointer-events none and link pointer-events auto. The help link opens the existing PDF in a new tab; assistant open hides it and retains Booking instructions (PDF), close restores it. Public home, booking and membership navigation/control presence passed. Actual assistant SSR confirms native hidden/inert suppression; owner menu/modal wiring and mobile styles are checked in source/regression tests. No authenticated owner menu interaction or physical iPhone acceptance was performed.

Live health/version, discovery/logo delivery, booking/membership shells and protected owner endpoint checks passed; no error-level startup entries were found in checked deployment windows. The initial live workflow ran before staging was ready and correctly reported the expected version unavailable; it was rerun after both environments were live. No real booking, customer/logo update, charge, email, provider credentials or customer records were changed for QA. Old service remains retired; no service configuration changes were made.

# v1.3.157 release handoff — Discovery business logos

Discovery cards use saved Branding logos and the official SelahFlow symbol for missing/failed images. Versioned image URLs follow logo updates; full images fit within the 50-pixel card frame. Shared by every business. No migrations, provider/environment changes or customer mutations.

Verified LIVE in canonical production (PR #86, merge 1cf3ddfa8524247d7e37581b8ce86524891fa442, deploy dep-dbgg5m0kv17s73ale5pg at 2026-10-27T20:02:54.239076Z) and staging (66b5bd2dee1848f3bc5dd654f1cff8ba28a3f5e8, deploy dep-dbgg3qb4338s73cc48bg at 20:04:32.386296Z). Identical application tree 03135cec8898ec764c196dda72f3100be47cb0d8. Local and GitHub validation 40573565119/job 122433876167 passed all 433 tests, typecheck and build; Render staging also passed all 433 tests/typecheck/build. Initial local run found only the source-release documentation label mismatch, corrected before final validation. Superseded staging build dep-dbgg2tetlv9c73a6qb8g was canceled to run the corrected revision.

Production public browser verification confirms Arcila Training and Capstone logos, SelahFlow placeholders for Shekinah and Car Shine, all images loaded with contain sizing and correct business-scoped/versioned URLs. Live API checks verify logo metadata/bytes, placeholders, discovery, booking and membership shells and protected owner API; no error-level startup entries in checked deployment windows. Actual image-error/replacement/removal behavior is covered with synthetic regression tests. No actual logo/business/customer record was changed for QA. No phone-device acceptance or real payment/email-delivery test is claimed. Old service remains suspended with auto-deploy off. Google provider activation remains separate; this release does not change its configuration.

# v1.3.156 release handoff — Google business connection, reviews and photos

Adds tenant-scoped Google Business Profile OAuth under Branding → Google reviews & photos. Owners connect their own account, refresh managed locations, select the exact Google Place ID, control public reviews/photos and disconnect. Dedicated OAuth client configuration keeps platform Gmail authorization separate; encrypted tokens bind to business/purpose, state binds owner/business/session with PKCE and expiry. API actions only read Google data; publication settings affect SelahFlow.

Public Google Places displays exact-listing ratings/review counts, up to five original reviews with reviewer/source attribution, and up to ten photos. Discovery cards lazy-load rating/photo summaries; business, booking and membership pages share the complete display. No persistent Google review/photo cache. Legacy listing-link photo behavior remains, but reviews require explicit Place ID selection. New additive migration 062 stores only connection/publication configuration. Existing booking, payment, email and customer data are preserved. Old Render service remains suspended with auto-deploy off.

External setup remains required: Google Places API (New) and server key with billing, a dedicated Google Business OAuth client with business.manage scope, approved Business Profile API access, and Account Management / Business Information APIs. Production callback https://selahflow.onrender.com/api/business/google/callback; staging callback https://selahflow-staging.onrender.com/api/business/google/callback. Google Cloud Console remains unavailable to this browser; real owner authorization and real Google content are not yet verified. See docs/GOOGLE_BUSINESS_SETUP.md.

Verified LIVE in staging and canonical production. Staging commit fb5af672cca849b91d931354432aa8a1fc0174f9, deployment dep-dbgf6ic3tckc73dvbpn0 LIVE 2026-10-27T19:02:56.183112Z. PR #85 merged as fe612a805d236a137d0de030c41fd958909c8738; canonical deployment dep-dbgfb53ncjis73c3v2j0 LIVE 19:05:55.541627Z. Both use application tree bf0ad1f640a6ff1dccd9f08582df98692acc2029. Earlier superseded staging deployment dep-dbgf5hnb9u1s73c65ph0 was canceled before cutover.

Local and GitHub validation 40564206531/job 122400981911 passed all 431 tests, typecheck and builds; final Render staging also passed all 431 tests/typecheck/build. Live workflow 40564206564 rerun/job 122407510756 passed deployment, business assistant, ID-only synthetic status and commission read-only checks. Its initial attempt ran before deployment and reported the expected staging version not ready. Both environments passed new Google endpoint anonymous 401, foreign-origin 403, failed OAuth callback safe redirect/no-store, active-business safe public projection, photo index rejection, Google privacy disclosure and official logo asset checks. No actual business connection/display selection or customer data was changed for QA.

Migration 062 applied successfully in both environments. Startup preflights verified dedicated database/role, schema CREATE true and zero unowned tables. Canonical Gmail readiness remains configured/setupComplete true, needsReconnect false, authorization stored_connection_not_live_verified. No error-level entries in the checked canonical startup window. Retired service remains suspended with auto-deploy off.

Activation remains blocked by external setup: production Render key inventory confirms no Google Places server key or dedicated Google Business OAuth client credentials. Google Cloud Console is inaccessible in this browser. No real owner OAuth consent, Google location publication or live Google review/photo retrieval was verified; public content remains absent until the platform credentials/APIs and each owner's listing selection are configured. Booking/payment functionality degrades independently of Google. No actual charge or outgoing test email was created.

# v1.3.155 release handoff — legacy URL reference cleanup

User authorized retirement on October 27, 2026 after confirming the new Google callback and working integrations. Canonical production is https://selahflow.onrender.com (srv-dbgbiu0n74is73cglveg); staging is unchanged. Legacy service retirement is pending explicit approval after automatic approval review blocked the retirement controls. The old service remains running with its existing deployment setting. No database, customer record or credentials are deleted. Previously sent links remain available while the legacy service is retained. Historical URL examples in documentation now use the canonical address; historical deployment IDs remain evidence, not current deployment instructions.

Database preflight permissions are unchanged so the retained legacy service can continue starting safely. Staging rejects every non-staging Render hostname rather than naming the retired host. Sharing fixtures use the canonical origin. Stripe webhook already targets canonical production. Google callback configuration is user-confirmed, not directly inspected.

Verified LIVE: staging dep-dbgdbgui0phs73c6n7rg (c66e66a93022cf16aea5a0eba171871ddd6af407), 2026-10-27T16:57:13.235903Z; canonical production dep-dbgdg5mq1p3s739vhms0, 16:59:55.507930Z, application merge 100356229165dce3624ac17c91b80dbd0471601d. Both share source tree 3c14fd7f5b30a8b888cf3a731f47cba6bce7e95b. Legacy service also automatically deployed the compatible release as dep-dbgdg5uq1p3s739vhn60 at 17:00:05.728430Z; its retirement is still blocked pending approval. No suspension/deletion or auto-deploy change occurred.

Local, GitHub validation 40544366209/job 122330868733 and Render staging passed all 424 tests, typecheck and builds. Live workflow 40544366309 rerun/job 122338369953 passed after deployment, including first-customer-commission read-only checks; its initial pre-deployment attempt had correctly reported the expected staging version not ready. Staging and canonical production passed health/version, booking/payment-shell, protected-API, invalid invitation/no-store, exact PDF bytes, tenant-scoped assistant instructions/published knowledge and synthetic unknown-ID status checks. Startup preflights verify dedicated database/role, schema CREATE true and zero unowned tables; canonical Gmail readiness remains configured/setupComplete true, needsReconnect false, authorization stored_connection_not_live_verified. No error-level entries in the checked canonical startup window. APP_URL and live Stripe webhook were read back at the canonical origin. Google Cloud remains Site Unavailable in this browser; the new callback is user-confirmed, obsolete callbacks have not been inspected/removed. Saved historical messages/previously issued provider sessions were not rewritten. No real booking, charge or outbound test email was created for verification.

# v1.3.154 release handoff — canonical URL deployment verified LIVE

Primary production is https://selahflow.onrender.com, Render service selahflow (srv-dbgbiu0n74is73cglveg), workspace tea-da643qgu01pc73951gdg. It reuses the existing selahflow_production database and selahflow_production_user. No customer-data copy, reset or credential rotation. Original selahflow-studio (srv-db3tokqd0e5s73f31hfg) remains available at the old hostname for existing links/callbacks. No automatic redirect is installed.

PR #82 added canonical PDF/current-documentation links, a configurable message worker and staging-host protection. PR #83 added the exact new immutable Render service ID to database preflight without weakening database, role, schema or ownership checks. Application merge bca27a11a9a05e60dc020b3d981345256756528a; source tree 1acbab4fb9c019da67a17d04eb751daf52a87437. Staging commit 1ca857482b9f86c2130f7587a0e97070ce4ca055 has the identical tree.

Staging dep-dbgc4hg473hc73b2di70 LIVE 2026-10-27T15:33:36.645549Z. Old production dep-dbgc90ks728c73f7jpdg LIVE 15:36:15.075160Z. New production dep-dbgc9tnavr4c73dkc15g LIVE 15:38:03.475253Z. Normal npm run start is restored on the new service; APP_URL is the new origin, SELAHFLOW_MESSAGE_WORKER=true, and main auto-deploy is On Commit. Old worker flag is false, verified in Render. Do not set the old service APP_URL to the new origin: that would reject old-origin mutations.

Local, GitHub CI 40530704751/job 122282381795 and Render staging passed 424 tests, typecheck and builds. Both production services passed live version/booking/payment-shell/protected-API/no-store checks. New production preflight confirms intended database/role, schema CREATE true and zero unowned tables. Gmail readiness is configured/setupComplete true, needsReconnect false, missingConfiguration empty; authorization remains stored_connection_not_live_verified. No error-level entries in the checked successful cutover window.

New-host PDF exact-byte and business-scoped assistant checks passed; staging and new production passed public assistant and ID-only unknown-status checks. The older GitHub live-smoke run exposed a stale hardcoded four-session assertion after successful deployment checks. The verification script now compares the mixed answer against published weekly/monthly plan data and current price; its corrected live checks passed in both environments. This verification-only correction does not alter the deployed app.

Stripe live SelahFlow LLC endpoint we_1UTjvl3btxSEZmvTRMc6CG0l was updated and read back at https://selahflow.onrender.com/api/stripe/webhook. Its endpoint ID, API version and eight event subscriptions were retained; no secret rotation or charge. The unsigned endpoint rejects invalid signatures. Existing Gmail connection and credentials are retained. Still pending: Google OAuth allowlisting of https://selahflow.onrender.com/api/platform/gmail/callback for future reconnection, and authorized real payment/email-delivery verification. No real client booking, signature, payment, test email or customer-data retrieval was used for QA.

The 20-page Arcila guide revision 1.1 has eight new-host links, SHA-256 d3132806a98f0c1610e965323181bda22bde0a85ab67e172ceb3b94f4b731035, 1,388,112 bytes. Rendered pages were visually checked. Public Arcila navigation and Request help were verified in the browser at the new host. New-origin sign-in/notification permission is separate from the old origin. See docs/URL_MIGRATION_2026_10_27.md for operational details.

## v1.3.152 — Arcila client guide and help

- Publish a 20-page client PDF with live screenshots and detailed booking, payment, membership, autofill, status and email instructions.
- Add a right-side Request help link and contextual assistant PDF instructions, scoped to the matching business.
- Preserve ID-only live status checks and distinguish how-to instructions from an actual status request.

## v1.3.151 — Consolidated booking history

- Group each explicitly linked booking lifecycle into one expandable entry in client/business history with distinct acceptance and payment status.
- Keep lifecycle search, dates, counts, pagination and source-selection safeguards consistent; retain individual financial/message tabs.
- Add shared Expand all / Collapse all arrows to history, Booking Status and client session details.

## 1.3.150

- Recover saved registration fields using only the business-specific Membership ID in booking, membership signup and owner assignment.
- Include service name and category/type in ID-only appointment status cards and assistant subsections.
- Preserve business isolation, throttling, no-store responses and payment/booking safeguards.

## 1.3.149

- Keep membership classifications visible with explicit payment/credit status; preserve credit eligibility rules.
- Verify and expire unpaid Stripe checkouts during confirmed owner deletion, preserving active-payment/subscription safeguards and retained financial facts.
- Repair membership-only deletion dependencies while preserving unrelated bookings.

## 1.3.148

- Optional 1, 2 or 3 membership sessions per week under Memberships, within anniversary-based calendar months including a partial fifth week.
- Enforce weekly reservations on submission/approval/attendance and session moves; preserve existing fixed monthly plans and all history.
- Explain usage rules in owner/customer plans, payment invitations/confirmations and assistant knowledge.

## 1.3.147
- Centralize business identity, design, page editing, social links and booking QR sharing under Branding.
- Add owner-scoped QR downloads and safe top-right social buttons; synchronize page story, colors and supported wording.

## 1.3.146
- Add primary platform-admin controls to independently enable or disable each business’s first-booking and first-membership commissions.
- Preserve business terms, Stripe readiness, audit history and once-per-client eligibility; allow disabling during Stripe outages.

## 1.3.145
- Add separately activated first-booking and first-membership 10% Stripe commissions, privacy-preserving identity tracking, refunds and accounting views.
- Keep recurring membership application fees at 0% after the initial paid period.

## 1.3.144
- Organize all shared assistant knowledge/status answers into topic headings and collapsed subsections with source links.

## 1.3.143
- Add assistant Membership status and Booking status flows requiring only a unique ID, including direct-ID questions and current summaries.
- Reuse existing scoped/rate-limited lookup; mask IDs in chat and exclude private contacts, amounts and payment access.

## 1.3.142
- Expand the shared assistant to current business descriptions, services/prices, memberships/credit eligibility, schedules, page wording, question definitions, public team and reviewed waiver text.
- Add source-linked, readable assistant on business home, booking and membership pages; preserve tenant privacy and owner handoff.

## 1.3.141
- Validate business Stripe onboarding destinations and show a secure continuation link when automatic navigation is interrupted.

## 1.3.140
- Add a public Privacy Policy page with desktop/mobile navigation and footer links across the platform site.

## 1.3.139
- Add Help: set up Stripe with an in-app owner guide and troubleshooting, available even before Stripe is configured.
- Move business Stripe onboarding, connection status and verification into Settings → Stripe payments for all businesses. Membership billing stays in Memberships; onboarding returns to payment settings.

## 1.3.138

- Remove the remembered-name Welcome back banner from shared booking forms across all businesses.

## 1.3.137

- Standardize shared question inputs to white backgrounds and dark text across themes.
- Add a reviewed, versioned numbered media-release clause and preserve prior signatures/media choices.
- Allow owners to permanently delete active or previously deleted signed waivers; invalidate consent immediately.

## 1.3.136

- Fix owner Add Client rejecting the automatically suggested eight-character ID as an existing membership ID.
- Preserve server allocation, business-scoped uniqueness, required questions and transaction rollback.
- Show actionable validation for mismatched supplied IDs and invalid dropdown answers.

## 1.3.135

- Confirming Send automatically approves exact, current client recipients for that staging campaign without Render configuration edits.
- Persist per-recipient provider message IDs and expose all recipient results; never claim inbox delivery from provider acceptance.
- Keep global staging enablement, business scoping, contact rechecks, opt-outs and non-replay of submitted/unknown outcomes.

## 1.3.134

- Reopen saved email drafts with Review & send, including original recipients, message and business-branded preview.
- Move Send now above the preview, scroll to review and keep its toolbar visible; stack communication history into readable mobile cards.
- Explain draft status, require fresh previews for changed/expired drafts and display staging recipient restrictions before sending.

## 1.3.133

- Edit all current client profile fields with stale-write, business scope and Unique ID collision protection; synchronize linked memberships and booking identities while preserving original evidence.
- Membership views refresh current contact/profile data.
- Show email delivery details, check staging recipient restrictions before queueing and allow safe rejected-only retries. Recover the blocked staging test message using an additional communication-only approved-address setting.
- Returning booking forms use current owner profile answers and intentional clears while preserving historical submissions.

## 1.3.132

- Add Settings → Client communications with live client contact sync, deduplicated recipient selection, personalized subject/message/HTTPS button, business-logo/color preview and explicit Send confirmation.
- Durable private email queues, campaign history/cancellation and business-scoped unsubscribe; preserve existing transactional emails and staging delivery safeguards.
- Recheck current contacts before sending, clean eligible communication recipient data on permanent client deletion and prevent duplicate/ambiguous replay.

## 1.3.131

- Owners can uncheck service approval, standard identity question requirements and session tracking defaults; saved server behavior honors explicit choices.
- Explicitly unchecked services confirm new bookings immediately with atomic waiver/capacity/coupon checks and secure payment email queues. Existing pending requests remain subject to review.
- Optional incomplete booking identity receives no fabricated Unique ID; configured waivers still require a verified identity. Green enabled checkboxes across themes; temporary saving/security restrictions retained.

## 1.3.130

- Brand business-related transactional and owner-alert emails with the current business theme and uploaded inline logo, retaining the shared sender address.
- Apply branding at delivery time across booking, approval, payment, membership and registration verification flows, including queued unsent messages.
- Support PNG/JPG/WebP uploads, readable theme contrast, safe business-name fallback, and tenant-isolated lookup for Gmail and Resend.

## 1.3.129

- Remove recurring session overrides with their parent definition so Save business settings succeeds.
- Clean removed session question targets without turning them into global booking questions.
- Allow removal of booked definitions while preserving customer reservations/history; show retained appointments on the owner calendar and keep their time blocked.

## 1.3.128

- Move private team accountability from Overview into Team calendar, synchronized with the selected calendar date.
- Assign internal team members to individual service appointments as well as dated recurring session occurrences, without changing public hosts or capacity.
- Add sortable accountability list with session/service names, date, time, team names, saved/default source and private notes, with date-range browsing.

## 1.3.127

- Add Clients → Booking Status for all business bookings, including pending/declined requests and confirmed appointments, independent of the selected client or directory filters.
- Show client identity/contact, date/time, service/type, session, team, answers, timeline, dynamic payment state and quote; add search/status/payment/date/attendance filters.
- Preserve owner-only business scoping and existing histories; record declined review timestamps in request timelines.

## 1.3.126

- Per-team-member Hide from client booking excludes that member entirely from public team choices and masks client receipts while retaining private owner records.
- Owners can edit qualified default hosts per service and automatic hosts/default tracking teams per session; choosing a session takes precedence over service defaults.
- Server resolves assigned hosts from the business configuration and exact occurrence, rejects forged hidden-member selection, and snapshots private booking host history for owner accountability.

## 1.3.125

- Centralize standard/custom booking and membership question management under Settings → Questions, including service/session scope, ordering, Required and notification display choices.
- Remove embedded catalog/session editors and redundant membership editing shortcuts; move question/review display preferences into the single manager. Add Save questions in that location.
- Preserve existing identity requirements, field IDs, answers, quota and tenant isolation; clean obsolete references when moving a question to a different form.

## 1.3.124

- Validate persistent Web Push key pairs and report missing, invalid or staging-disabled setup without disclosing credentials.
- Repair obsolete browser subscriptions, wait for service-worker activation, refresh device state after returning to the app, and add an authenticated, business-scoped device test.
- Clarify iPhone Home Screen installation and mandatory booking approval; preserve independent email/SMS settings.

## 1.3.123

- Apply business coupons to any service at final booking review; server-validated discounts and cent-exact service lines persist through owner approval, Stripe payment and receipt emails.
- Keep submission receipts and approval/payment emails independent, with complete appointment details and discount totals; owner review links honor mandatory approval even when older optional approval settings were disabled.
- Add owner-only assignments to a specific recurring occurrence date and Eastern time, preserving prior series assignments and all public capacity/privacy rules.

## 1.3.122

- Member-specific payment invitation emails and secure Stripe enrollment with recurring authorization.
- Monthly credit periods anchored to the first paid or owner-overridden date; unused credits do not roll over. Owners can configure future plan recurrence and schedule member recurrence changes in Stripe.
- Business membership coupons with description, fixed or percentage discounts and checkout previews.
- Require owner approval before session checkout; payment instructions explain participation conditions.
- Group booking status timelines and dynamic payment tracking in Clients; show monthly attended services under membership IDs.
- Optional media permission stored separately with the signed waiver; private session team assignments and public staff-name privacy controls.

## 1.3.121

- Align booking waiver and appointment-policy checkboxes with equal 20px dimensions and shared text columns, including wrapped text on mobile. Consent requirements and stored signatures remain unchanged.

## 1.3.120

- Per-plan membership credit eligibility: all eligible services/sessions or selected services and session series.
- Enforce scope in booking quotes, confirmation, attendance deductions and manual session recording; display coverage during enrollment.
- Existing plans default to all eligible services and sessions. Financial records and past deductions are preserved.

## 1.3.119

- White registration lookup and payment text on the black panel, with readable inputs and result cards.
- Owners can delete active waivers from Service catalog; signed evidence stays retrievable in Deleted waivers, and fresh consent is required for future waiver-required bookings. Owner/origin checks and repeat-safe deletion are enforced server-side.

## 1.3.118

- Confirmed owner client deletion no longer requires an operator-only maintenance authorization. Retain transactional deletion, owner scope, financial/waiver evidence and active-provider guards.
- Retrying a completed deletion returns success; errors are visible inside the confirmation dialog.

## 1.3.117

- Issue eight-character initials/MMDDYY IDs for new registrations and released-ID reuse.
- Require identity inputs, reject active collisions and support eight-character IDs across booking, membership, owner tools and payment lookup. Preserve existing identifiers, financial history and consent evidence.

# v1.3.116 — Optional membership identity fields (candidate)

Respect Required on public enrollment and owner assignment. Incomplete identities use separate registration references, receive six-character IDs, and remain distinct across retries and deletions. No fabricated name, birth date or email. Waiver and birth-date lookup still require sufficient participant identity. Production waiver use requires legal review.

## 1.3.115 — Issue 46 implementation checkpoint (not deployed)

- Version-specific business participation signatures and audit evidence, retained after client removal; booking and checkout checks and a production legal-review gate.
- Independently configurable form Required/Notify flags and filtered owner notifications; optional membership identity fields remain an open acceptance item.
- Approval/payment notification safeguards, including zero-balance confirmation without a payment link.
- Strict six-character issuance/import guards, retained ID history aliases, deletion tombstones, minimal financial retention and preserved Stripe reconciliation references.
- Destructive maintenance removed from startup. Client deletion requires recent, exact-target, database-specific backup/restore authorization.
- See docs/ISSUE_46_ACCEPTANCE_EVIDENCE.md for verification and remaining deployment gates.

# v1.3.114 — Owner and booking usability

- Group and search all owner workspace tools; add mobile menu close, backdrop, keyboard handling and focus restoration.
- Protect unsaved Settings and public page drafts from navigation and polling; show saved state and discard controls.
- Clarify public-page editing, booking progress, service summaries, registration lookup and approval-aware confirmation labels.
- Improve mobile booking order, shared form autofill, required-field labels and public navigation.
- No database migrations or changes to prices, payments, capacity, tenant data or account permissions.

## 1.3.113 — Financial stages and business-owner benefits

- Reports account for submitted booking/membership requests, approved unpaid quotes, pending payments and paid transactions. Linked conversions and existing payment evidence prevent duplicate unpaid obligations; unknown amounts stay visible for review. Existing revenue resets remain respected.
- Cash sales can explicitly settle the matching full-price booking. Linked receipts and appointment state commit together, reject existing card checkouts and protect against repeat recording. Public payment pages recognize cash settlement.
- The business landing page explains branding, page customization, booking rules, team rosters, memberships, financial reports, portable records and the proposed 10% first-visit fee (not currently collected).

## 1.3.112 — Preserve removal of the legacy Crawford business

- Startup initializes administrator access without recreating or renaming a business, inserting tenant memberships, or creating tenant subscriptions. Existing administrator credentials and other tenants are preserved.
- Migration 045 permanently removes only the verified archived Crawford business and its tenant records in each database; connected billing obligations stop the operation. Other tenants and administrator accounts are preserved.

## 1.3.111 — Phase 1 performance/architecture candidate (staging validation required)
- Split 14 secondary owner-dashboard components into on-demand Next.js chunks without changing their screens, workflows, appearance, or server operations.
- Skip full owner-dashboard data polling while hidden, refreshing on return to visible; preserve foreground 30-second cadence.
- Parallelize independent business-name query with owner activity/roster requests; preserve data contract and tenant isolation.
- Add reproducible static asset measurement after CI build plus three regression tests; source assets increased globally while owner dashboard root referenced chunk bytes decreased.
- No database/index migration or payment/membership behavior changes. Production must remain v1.3.110 pending explicit approval after staging validation and verified database recovery.

## 1.3.110 — Shared customer Unique ID and per-service questions
- Both no-payment membership registrations and Stripe membership checkouts persist the same business-scoped 6-character customer ID and directory identity as first-time booking. Repeat registrations and return visits reuse the ID without granting unpaid credits.
- Membership registration displays the new Unique ID like booking confirmation and supports secure returning ID+DOB lookup; Stripe status shows the assigned ID pending or paid.
- Owners can create, edit and scope registration questions per existing or newly created service, as well as sessions and membership forms; select multiple services to show the union of applicable questions only once.
- Service-specific required answers are checked on the server, including manual booking. Removing a service prunes its associated questions, preserving historical booking answers. Separate Render databases, Stripe/Gmail connections and credentials remain untouched.

## 1.3.109 — Membership signup, payment, editable questions and reporting
- Customer enrollment requires no approval and saves a pending-payment membership with its unique ID, captured questions and no usable credits until payment.
- Previously unpaid enrollments can continue through existing Stripe Connect checkout with strict plan, identity, price and merchant checks. Verified membership payments queue one descriptive email; the sender must be connected independently in each Render environment.
- Settings shows Booking & membership questions and allows adding/editing/reordering them; Memberships has a shortcut. Removed the redundant Booking page content tab while retaining Page editor.
- Reports include separate booked/scheduled, checked-in, paid appointment, completed, canceled and no-show detail views, avoid projecting already-paid/member-covered visits, and reconcile paid Stripe bookings without duplicate revenue.
- Separate staging and production databases, keys, notification policies and connected Stripe accounts remain independent.

## 1.3.108 — Report controls and membership payment receipts

- Add selected-period detail dialogs to all Reports cards, including membership payments and email outcomes.
- Add a typed-confirmation reset of reported paid revenue while retaining payment safeguards and membership balances.
- Queue plan-specific durable email receipts for verified Stripe membership payments and owner-recorded purchases/renewals.

## 1.3.107 — Full-session booking and payment guards

- Show “Session is now full” and disable full booking times and stale review actions.
- Reject new approval requests and pending checkout for full sessions server-side; preserve payment for existing reserved attendees.
- Refresh session availability and allow clients to retry when cancelled seats reopen.

## 1.3.106 — Sortable/selectable history and automatic session approval

- Sort every History column across all filtered pages; select individual entries or a page for activity-view deletion.
- Automatically reconcile eligible pending requests when catalog approval is unchecked, preserving atomic booking validation and payment-link email flow.
- Recheck verified paid state before sending payment-confirmation emails.

## 1.3.105 — Catalog approval and direct payment

- Unchecked service approval confirms new bookings immediately and exposes Stripe payment even when business approval notifications are enabled. Mixed bookings still require approval when any service is checked.
- Existing pending requests for unchecked services can confirm on an authenticated payment click, with atomic capacity, current service/price/hours checks and idempotent Checkout reuse. Previews remain read-only and never reserve seats or charge.
- Checked, declined, expired-access, cross-business and unavailable bookings cannot bypass review or availability safeguards. Verified Stripe payment queues the existing branded client confirmation email.

## 1.3.104 — Final staging deletion isolation and email verification

- Client deletion with missing birth dates uses exact booking history or matching name/contact, preventing same-name or unnamed guests from being deleted together. Archived profiles retain their original history anchors during permanent deletion.
- Explicit staging receipt verification can queue a missing approval receipt for a real saved appointment and the exact registered recipient, without creating a booking or charge or releasing other payment emails.

## 1.3.103 — Staging client reset, session controls and payment emails

- Permanent tenant-scoped member deletion removes linked registration, booking, membership, payment and saved email records; IDs retain only anonymous retired reservations. Explicit staging reset is one-shot and stores counts only.
- History can be cleared from its tab with confirmation; operational bookings, balances and billing/delivery source records remain saved. New activity appears normally.
- All session questions have required/optional controls; existing/new sessions default to scheduled start times only, with an owner opt-out.
- Direct bookings enter the private payment flow and queue confirmations only after verified Stripe payment. Shorter emails use labeled payment, membership and booking buttons.
- Targeted staging email verification retries at most one saved email per event for one configured recipient. No bulk release, automatic charges or production deployment.

## v1.3.102 — Client email rollout and legacy registration replacement (staging)

- Explicit prospective client-email cutoff permits new booking, approval/payment-link and verified-payment confirmation emails to their submitted addresses. Historical queue jobs stay restricted unless an owner explicitly retries that booking; owner alerts and SMS retain existing restrictions.
- Owner-confirmed replacement of legacy registration IDs issues six characters, updates current registration/membership references and retains the old reserved ID, historical bookings, payments and session ledgers. Returning registration prefers the new valid ID. Tenant identity and stale-record checks remain enforced.
- No production changes. Verify exact staging deployment and provider acceptance separately from inbox delivery.

## v1.3.101 — Organized history tabs (staging)

- Dedicated owner History view with All activity, Bookings, Sessions & attendance, Payments, Memberships and Email & SMS tabs; searchable clients/IDs, date range, stable pagination and collapsed details.
- Client profiles separate History, Details, Membership and Sessions. Long message history no longer clutters Overview and Calendar; pending approvals remain there. Safe message retries remain in history details.
- Owner-scoped retained source data separates quotes from verified/recorded payments, reconciles membership audit/ledger copies and masks message destinations. No fabricated delivery attempts, private email bodies, payment URLs or provider secrets returned. No data rewriting or billing changes.

## v1.3.100 — Booking lifecycle email and attendance choices (staging)

- Remove Complete from owner calendars; owner status API accepts check-in, no-show and cancellation. Only check-in/no-show debit membership sessions, once per appointment; legacy history retained.
- Durable submission email committed with pending and immediate client bookings. Friendly next steps match page copy, with stable Membership ID, booking details, active membership sessions left/used and tenant booking/membership links.
- Approved paid bookings retain private payment links and verified-paid confirmations, enriched with the same booking/membership detail. Free and covered approvals receive their own no-payment-due email.

## v1.3.99 — SelahFlow logo artwork and branded email (staging)

- Supplied flowing S, sage ribbon and gold pause identity replaces platform marks across shared headers, footers, homepage, owner/admin/login/review pages and app/push icons. Business-owned logos preserved.
- Shared HTML email branding covers approval, membership, payment and verification messages. Plain text, private links, staging recipient restrictions and delivery state retained. Gmail MIME embeds PNG; Resend uses HTML and a CID attachment. No actual client messages or charges performed.

## v1.3.98 — Separate customer and business pages (staging)

- Clear two-audience homepage. Customer search and registration help at /customers; partner benefits, plans and revenue at /businesses.
- Shared desktop/mobile links across discovery and pricing. New route slugs reserved. No billing, tenant data or payment behavior changes.

## v1.3.97 — Clear partner benefits and transparent revenue copy (staging only)

- Homepage replaces redundant journey cards with three practical partner outcomes and expandable business examples. Existing search and client booking journeys are retained.
- Plan cards use the unchanged entitlement catalog, with key limits visible and all benefits/limits expandable. Proposed paid billing remains clearly labeled.
- Revenue section explains subscriptions, the proposed business-paid 10% first eligible completed/paid booking fee across all channels, repeat-visit exemption, a $100 example, future optional extras and separate processing costs. Explicitly states the commission is not being collected. Terms/refund/existing-client questions sit in optional details. No charging, entitlement, tenant or payment changes.

## v1.3.96 — Consistent business navigation and status payments (staging only)

- One responsive business header connects overview, booking, memberships, registration status and owner sign-in across every existing and future business. Each tenant retains its name, branding and saved booking header note.
- ID-only status lookup keeps membership type/package/status, credits and appointment details. Payment status distinguishes pending approval, due, paid, covered and unavailable online payment. Approved payable bookings show Make Payment; DOB verification protects checkout without exposing registration contact details or private payment-link tokens in the ID-only response.
- Existing server-priced, business-scoped Stripe checkout enforces approval, coverage and duplicate-payment checks. Six verification attempts per recipient/IP window; temporary access is deleted after use. Regression covers tenant isolation, incorrect DOB, pending approval, coverage, cancellation and checkout reuse. No migrations or production changes.

## v1.3.95 — Easier discovery with SelahFlow identity (staging only)

- Search directly from the homepage by business keyword and city, or browse category shortcuts. Separate customer and owner journeys, responsive menu, keyboard skip link and clearer next-step explanations.
- Discovery carries URL filters from home, supports browser back/forward and clear filters, cancels superseded searches, announces results and offers recoverable error/empty states. Business cards use actual marketplace data and direct booking links; no invented reviews, metrics or availability.
- Preserve platform colors, individual business branding and all payment, membership, booking, history and authentication behavior. No migrations or production changes.

## v1.3.94 — Shared database pool and staging rollout headroom (staging only)

- PostgreSQL logs confirmed too many connections for the dedicated staging role during the email-enabled rollout. Share one process-global pool across independently bundled instrumentation/routes and cap staging at two connections per process, leaving capacity for old/new instances and diagnostics under the existing five-connection limit. No database permissions, role limits, history or production configuration changes.
- Regression verifies independently loaded modules reuse the same pool and staging safety guards still run on cached access. Reuse the existing approved synthetic booking for email verification; never duplicate its payment or claim inbox delivery from queue status alone.

## v1.3.93 — Legacy client booking compatibility and payment SMS (staging only)

- Fixes the business_client_profiles_member_number_six error observed in staging database logs during Arcila booking confirmation. Migration 040 reserves only pre-existing legacy IDs in their original business, preserving history and cross-client ID protection. New IDs retain six-character enforcement. Reviewed snapshot import captures its historical IDs under its existing transaction locks.
- Payment SMS accepts US registration phone numbers with omitted +1; explicit international numbers are preserved. Existing owner-approval links and Stripe-verified confirmations use the saved registration contacts, per-channel idempotency and staging test-recipient guards.
- Sanitized staging startup readiness lists missing provider variable names and connection/allowlist status without secrets or contacts. Delivery still requires Gmail authorization, Twilio setup and approved test recipients.

## v1.3.92 — Consistent six-character password minimum (staging only)

- Mandatory password replacement now accepts six or more characters, matching existing signup, sign-in, owner settings, administrator creation and server validation. Confirmation and different-password requirements remain. Existing credentials are unchanged.

## v1.3.91 — Owner reset sign-in recovery (staging only)

- Resetting an owner password now clears only that owner’s sign-in and password-change throttles inside the reset transaction, retaining forced rotation and session revocation.
- One-time credential display offers Copy password only separately from Copy full sign-in message, links to the same environment, and explains that later resets invalidate earlier passwords. No existing passwords or hashes are displayed.
- User screenshot showed a rejected Arcila login; full-message paste is a possible cause, not confirmed. No real owner password was collected or reset during development. Owner login requires user verification after a fresh reset.

## v1.3.90 — All-business Stripe setup and synchronization (staging only)

- The primary platform administrator can view every business's Stripe setup, prepare missing sandbox accounts, open business-specific Stripe onboarding and synchronize payment readiness directly from Stripe. Archived/inactive businesses stay disabled. Each business keeps its own connected account.
- A staging-only startup switch prepares accounts for active businesses, reusing existing connections and idempotent account creation. Uses synthetic sandbox contact emails; it does not submit business agreements, charge clients, modify existing memberships or grant fake readiness. Owner onboarding remains required where Stripe requests it.
- Existing shared booking and membership Make Payment flows remain in place for every business, including approval and $0 membership-credit checks. No production deployment or credentials change.

## v1.3.89 — Production business replicas (staging only)

- A deliberate, checksum-verified startup snapshot imports all production businesses, settings, branding, client and membership history into staging. Each row retains its source tenant ID. Existing synthetic staging data and its sandbox merchant connection remain; its conflicting Crawford slug moves to staging-test-studio.
- Import requires the dedicated staging database/user and disabled outbound notifications. It backs up affected tables inside staging in the same transaction, rejects conflicts, rolls back on failure and never replays a completed snapshot. Production passwords, sessions, device subscriptions, action links and Stripe connections are excluded. Copied owner logins receive unknown independent credentials and require staging-only reset; an email collision uses a staging.invalid alias.
- This is a point-in-time copy, not continuous replication. Refreshing another snapshot requires a reviewed migration. Production source and data remain unchanged.

## v1.3.88 — Shared Gmail transactional email (staging only)

- New Gmail HTTPS API transport and primary-admin-only Connect/Reconnect/Disconnect panel. One sending account serves business-scoped notifications. Gmail.send plus OpenID email identifies the verified sender; no inbox read/delete scope.
- Migration 038 stores AES-256-GCM encrypted refresh credentials and ten-minute, one-time, session-bound PKCE states. Expired authorization needs reconnection; ambiguous sends are not blindly retried. Staging recipient guards and Stripe/payment/history paths are preserved.
- Gmail is selected explicitly with EMAIL_PROVIDER=gmail, or by default if no legacy Resend key exists. Existing Resend configurations stay compatible. Google Cloud Console was unavailable in the task browser; application credentials/account consent and actual delivery remain pending. See docs/GMAIL_EMAIL_SETUP.md. Verify exact Render LIVE status before claiming deployment. Production remains v1.3.81.

## v1.3.87 — Approval payment links and client confirmations (staging only)

- Additive migration 037 commits one email and SMS message with each payable booking approval; a private 30-day fragment-token link opens existing connected Stripe Checkout. Free/covered bookings skip payment. Registration identity/payment snapshots are retained on acceptance.
- Verified connected-account receipt commits confirmation messages with the financial writes. Duplicate callbacks do not duplicate messages or revenue. A startup worker uses the existing process/pool, durable claims and bounded retries; ambiguous outcomes require a provider check. No paid worker or resources.
- Owner approval inbox shows masked destinations, channel/provider status and retries for unsent failed/unconfigured messages. Submitted means provider-accepted, not delivered. Phone requires an explicit country code. Email security scanners cannot start checkout.
- Staging UI on 2026-10-15 reports Resend and Twilio not configured. Keep external delivery disabled until test provider credentials and explicit recipient allowlists are supplied. Never claim actual SMS/email delivery or independent live webhook delivery without evidence.
- Run typecheck, all tests and build, then verify exact staging LIVE release/health before claiming deployment. Production remains v1.3.81; do not merge to main without authorization.

## v1.3.83 — Stripe managed-risk Connect onboarding (staging only)

- New merchants use Accounts v2 JSON requests with Stripe as fee/loss collector and full Stripe dashboard access. Removes the rejected legacy Express type request; no platform liability acknowledgement or Stripe settings change is required.
- Existing connected accounts, v1 hosted onboarding links, readiness checks and direct Checkout remain preserved. No migrations, payment transactions or production changes.
- Sandbox checkout UI and invoice session/revenue credit integration remain separate pending work.

## v1.3.82 — Isolated staging environment

- Staging-only database/user/host/branch/origin checks run before startup migrations.
- Stripe test-key enforcement and sandbox-only webhooks; outbound notifications default off, with explicit test-recipient allowlists for email/SMS.
- Separate staging banner, search-engine exclusion, and a three-connection pool. Production main and its deployment are unchanged.

## v1.3.81 — Configurable unique membership IDs

- Membership ID settings offers initials + birth month/day with collision fallback, initials + sequential digits, or random two letters/four digits.
- Shared transactional allocation covers owner clients, membership assignment, request approval, public booking and payment checkout.
- Migration 035 reserves existing IDs per business and guards cross-table identity collisions. Existing IDs are preserved and reservations survive deletion; separate businesses can reuse a number.

## v1.3.80 — Exclude deleted memberships and services from paid revenue

- Exclude payments whose membership no longer exists in the same business; preserve the audit history.
- Remove deleted service lines from report sales and recompute totals using original prices; retain other service and retail lines.
- Inactive/exhausted memberships remain eligible until deleted. No data migration or historical payment mutation.

## v1.3.79 — Correct membership revenue totals

- Normalize membership amounts from cents and reconcile audit/ledger copies once per payment. Preserve audit-only history and distinct renewals.
- Show membership revenue and recorded membership transactions alongside paid service/retail sales; include all historical payments beyond the former 500-row cap.
- New manual payments include explicit amountCents and requestId fields. Pending requests and membership-credit visits do not create additional paid revenue.

## v1.3.78 — Membership details from ID-only registration check

- Check My Registration now retrieves the real membership package, membership type, status and available sessions using the unique ID alone, alongside the existing latest appointment status/date.
- Queries are business-scoped and use the current linked plan/group names and membership credit counters. Exhausted/inactive packages show zero usable sessions; renewal changes are reflected on the next lookup.
- Membership-only and booking-only records have clear result messages, and editing the ID clears the previous result. Existing ID validation and throttling remain in place. No personal contact data is added to the response and no booking, credit or historical records are modified.

## v1.3.77 — Editable membership type and plan badges

- Owners can customize badge label, background, icon and pill/rounded shape with a live preview for each membership type and individual plan. Plan badges inherit type settings unless overridden, and can revert to inherited/automatic styling.
- Saved badges appear consistently in membership enrollments, client cards/details, Overview appointments and customer membership selection. Owner badge edits refresh related dashboard views immediately.
- Automatic text contrast preserves pure white on dark badges without restoring removed text-color controls. Exhausted/inactive members retain neutral IDs; active credit renewal restores the saved badge with the same member ID.
- Migration 034 adds nullable badge presentation settings only; balances, membership/request history and financial records remain unchanged. Badge input is validated server-side and settings remain business-scoped.

## v1.3.76 — Membership type tabs and cleaner owner management

- Owners can add, rename, reorder and remove membership types from Memberships, and choose a type when creating or editing each plan.
- Customer membership pages show type tabs with keyboard navigation, an All memberships view, and access to ungrouped plans. Empty types stay hidden and switching tabs clears a selected plan when it is no longer visible.
- Plan creation/editing and member assignment now open in separate accessible dialogs with focus containment, Escape/Cancel controls and focus restoration, leaving the main page for plans and enrollments.
- Migration 033 adds business-scoped groups and an optional plan group link with a composite foreign key preventing cross-business assignments. Removing a type preserves its plans, memberships, credits and history. Existing plan limits remain enforced.

## v1.3.75 — White membership labels and automatic text contrast

- Fixed the shared membership-ID label cascade so public booking and owner form rules cannot override white text on the black panel, including optional/help/status text.
- Preserved readable dark values and placeholders in white response fields, including browser autofill.
- Removed remaining text-color controls from the visual page editor. Legacy text-color overrides are ignored by shared theme rendering and normalized by all owner theme/settings save paths; dark theme surfaces use pure white text automatically.
- Applies to every existing and future business without changing bookings, memberships, credits or history.

## v1.3.74 — Editable booking header phrase

- Added a dedicated owner setting and visual-editor field for the booking header phrase, including the circled “Your time. Your style.” text.
- The saved phrase now renders on the live public booking page for each business.

## v1.3.73 — Visual page editing

- Replaced the field-list page editor flow with an actual page-style editor opened by **Edit this page**.
- Owners can switch between business, booking and membership pages, edit visible copy inline, change page colors directly, preview the live page and save once.

## v1.3.72 — Owner page editor

- Added a Settings → Page editor workspace with an Edit this page control on owner dashboard pages.
- Consolidated supported page wording, booking copy, colors, fonts, logo and imagery controls while preserving business-scoped settings and records.

## v1.3.71 — Collapsed blockout schedules

- Blockout schedules in owner settings now appear collapsed by default with an expandable summary for editing.

## v1.3.70 — Remove pre-tax wording

- Removed “before applicable tax” and related pre-tax wording from public and owner booking summaries and confirmations.
## v1.3.69 — Membership-credit booking price

- A verified member ID with an active membership and sessions remaining now displays `$0.00` on the final booking confirmation.
- The server still validates the original service price and independently applies the membership credit, including session-level credit eligibility rules.
- Lookup responses now include membership status and sessions remaining so the confirmation UI reflects the actual benefit.

## v1.3.68 — Precise white text enforcement

- Fixed the membership-ID booking panel to a black surface with white text for every label, helper/status message, optional marker, and placeholder.
- Removed remaining text-color wording from the owner theme editor so text color cannot be customized or reintroduced through that screen.

## v1.3.67 — Fixed white text on dark surfaces

- Removed the Typography & details text-color settings box from the owner theme editor.
- Text colors on dark booking/registration surfaces remain fixed to readable white; owners can still customize page-area, interactive, border, and accent colors.

## v1.3.66 — Dark-surface text contrast

- Ensured themed dark cards and booking identity panels use readable foreground text for labels, helper copy, optional markers, status text, and placeholders.
- Removed the low-contrast opacity treatment from optional markers inside dark registration panels while preserving intentional placeholder hierarchy.

## v1.3.64 — Reliable member deletion

- Deleting a member now detaches linked membership-request audit records before the membership row is removed, resolving the foreign-key error shown for Noah Alves.
- The matching membership-only client profile is hidden as part of the same transaction, so a deleted member cannot reappear in the directory.

## v1.3.63 — Membership client removal

- Membership-only client cards, including Noah Alves, can be removed from the owner directory and restored later without deleting membership, bookings, or attendance history.
- Replaced the browser-native removal prompt with an accessible in-app confirmation dialog.

## v1.3.62 — Membership-credit eligibility and session-specific controls
- Enforces the six-character member format (first initial, last initial, birth month and day) for new and changed member records across booking, memberships and clients.
- Eligible active members with available credits receive a $0 quote for services/sessions that allow membership credit; those bookings are excluded from appointment revenue and do not consume a credit when marked attended if credit use is disabled.
- Membership payments and renewals are included in owner paid-revenue reporting from the immutable membership ledger.
- Bookable sessions can independently allow or disallow membership credits and now host their own required, notification-enabled questions. The standalone Booking questions settings tab is removed.
- Strengthens themed black-background text contrast for Arcila Training and every other business theme.
- Migration 030 adds future-facing six-character ID constraints without rewriting historical records.

## v1.3.61 — Owner controls, attendance corrections and membership requests
- Sort owner dashboard data columns ascending or descending; show all appointment dates on Overview and change attendance from calendar details and session rosters.
- Correct Check in ↔ No-show without a second membership debit. Reinstating attendance safely checks capacity and restores reserved time.
- Add visible response-field borders and repair themed autofill contrast.
- Automatically select the date/time when choosing a scheduled session.
- Edit public booking/membership wording, standard labels/help/placeholders, and independent question ordering in Settings.
- Scope custom questions to booking, membership, both, or specific bookable sessions (including recurring dates). One shared catalog enforces the business plan question allowance, including owner front-desk bookings.
- Add staff-specific or whole-business date/time blockouts, enforced on availability and final confirmation.
- Keep membership/attendance history within the member row and reorder public membership packages.
- Public membership requests use the same registration fields as owner assignment. Explicit MEMBERSHIP REQUEST alerts and an owner-only approval queue add approved players to Clients and Memberships. Payment confirmation remains separate; existing IDs, credits and history are preserved.
- Migration 029 adds membership request storage and package ordering. Existing customer records are not rewritten.

## v1.3.60 — Verified member ID, attendance credits and badge lifecycle
- Carries forward the live Overview member ID and package badge implementation.
- Check in and No-show consume one available session per appointment; repeat transitions cannot charge twice.
- Exhausted memberships use the neutral permanent ID badge. Confirmed renewal adds purchased credits and restores the package color while preserving usage and payment history.
- Health endpoint and visible release labels now derive their version from package.json.
- No database migration or customer data rewrite is required.
- Refreshed stale test fixtures for required booking identity fields, plan overrides, approval rules and archive-only retention checks; all 169 tests, TypeScript and production build pass.

## v1.3.50 — Client Excel import and booking share
- Import .xlsx and .csv clients per business; preserve arbitrary source columns and display them on client details.
- Match existing contacts, prevent duplicates within imported batch, and restrict import to active owner workspace.
- Share booking page via native share sheet or copied URL.

## v1.3.48 — Calendar appointment list and guarded deletion
- All-dates appointment list with individual and multi-select deletion.
- Secure delete-all requires exact business name and explicit DELETE ALL APPOINTMENTS phrase.
- Tenant-scoped transactional removal of appointments, reserved slots and linked approval requests.

## v1.3.47 — 82 distinct signup presets
- Every signup business category has its own six sample catalog entries (3 services, 2 products, 1 session suggestion).
- Category-specific booking heading and descriptions, team placeholder and rotating palette.
- Applies to new signups without overwriting existing business configurations.

## v1.3.46 — Category-aware signup defaults
- Industry-specific example service and product entries, generic team placeholder, suggested session template, and varied palette.
- Booking copy adapts to selected industry; owners may edit content after signup.
- Neutral booking confirmation terminology across business categories.

## v1.3.41 — Minimal appointment status lookup
- Customers enter their full name and booking email, without OTP or reference.
- Display only the latest matching appointment date and status; rate limited per IP and email.
- Existing verified lookup endpoints remain unchanged for compatibility.

## v1.3.40 — Email-only registration lookup
- Customers enter their booking email and verify ownership using a six-digit single-use code, rather than a booking reference.
- Verified customers can review their registrations and navigate the booking calendar to each session.
- Requires Resend transactional email configuration; code expiry and attempt limits protect privacy.
- Migration 019 adds verification code storage.

## v1.3.39 — Permanent deletion of archived businesses
- Primary platform administrators can permanently delete archived businesses with exact-name and PERMANENTLY DELETE confirmation.
- Transactional cleanup removes tenant-scoped appointments, booking requests, clients, configuration and dependent records from the active database.
- Delete owner login only when it is not shared with another business and is not a platform administrator.
- Block deletion for connected Stripe merchant accounts or subscription history requiring reconciliation; external providers and backups have separate retention.

## v1.3.38 — Private session registration verification
- Customers can verify their own booking using reference and matching email in the existing day/week/month booking calendar.
- Display booking status and jump to the verified session date without revealing other participants.
- Limit verification attempts and scope queries to the current business.

## v1.3.37 — Owner email update form validation guidance
- Explain exactly why the administrator email-change button is disabled, with live per-field requirements.
- Accept surrounding whitespace in the business-name confirmation while preserving account verification safeguards.

## v1.3.36 — Pending session approval verification guidance (October 11, 2026)
- Show guidance on pending booking confirmation pages to check the session participant list when available, and contact the business if no confirmation is visible.
- Explain that calendar reminders do not constitute approval or hold a seat.

## v1.3.35 — Calendar sync for pending booking requests (October 11, 2026)
- Allow iPhone and Android calendar actions on both pending and confirmed booking confirmation screens.
- Pending events are explicitly tentative and marked not confirmed; saving a reminder never reserves a seat or bypasses business approval.
- Preserve all approval workflows and capacity enforcement.

## v1.3.34 — Manage session roster from business calendar (October 11, 2026)
- Business owners can add a customer to an available session from its calendar roster using name, email and optional phone.
- Business owners can remove a customer after confirmation, cancelling their booking and releasing the seat.
- Existing owner authentication, server-side capacity checks and booking records remain authoritative.

## v1.3.33 — Mobile Settings navigation fix (October 11, 2026)
- Make mobile owner sidebar independently scrollable with iOS safe-area spacing so Settings and all menu items remain tappable.
- Improve touch targets and reset content scroll when switching owner sections.
- Preserve all existing bookings, subscriptions, and session capacity functionality.

## v1.3.32 — Remaining seats displayed on custom-session booking times (October 11, 2026)
- Show clear remaining-seat counts on available session time buttons, with total capacity and an almost-full warning at two or fewer seats.
- Preserve existing server-calculated session capacity, booking validation, and business session roster.

## v1.3.31 — Calendar export and owner appointment details (October 11, 2026)
- Confirmed customers can export an Apple/Outlook-compatible ICS calendar event or open a Google Calendar event with service, staff, date, time and business address.
- Pending approval requests do not show calendar actions.
- Owner daily calendar appointments open a private details dialog with contact, status, price, duration and booking answers.
- Group session roster functionality from v1.3.30 remains unchanged.

## v1.3.30 — Private enrolled-client roster from owner calendars (October 11, 2026)
- Owners select sessions in daily, weekly or monthly business calendars to view private enrolled client information, booking status and session availability.
- Retains the business-scoped entitlement and pricing changes from v1.3.29. Does not reveal customer details to public booking visitors.
- Delivered on Render deployment `dep-db5eurou01pc73ek74qg` (snapshot; check LIVE deployment status again for future versions).

## v1.3.29 — Plan comparisons and enforced entitlements (October 11, 2026)
- Replaced Crawford-specific promotion on the SelahFlow homepage with expandable Free/Professional/Business plan details.
- Centralized enforceable service, staff, booking-question, session-template and membership-offer limits per business subscription, retaining existing records on downgrade.
- Authorized platform admins can assign plan entitlements manually with audit history; paid subscription checkout is **not** active and manual plan assignment does not collect payment.

## v1.3.28 — Business identity card homepage link (October 10, 2026)
- Clicking the business workspace card in the owner's sidebar opens that specific business's public homepage on mobile or desktop.

## v1.3.27 — Group session capacity preserved across coach transfers (October 10, 2026)
- Transferring a session to a different team member preserves session ID, registered customers, total capacity and remaining seats unless the owner explicitly changes capacity.

**Important:** Older entries below are retained as historical release notes. Current project and deployment guidance lives in `AGENTS.md` and `docs/CHATGPT_PROJECT_CONTINUITY.md`. The current version must be verified from LIVE Render + `package.json` `main`.

---

## v1.3.14 — Universal business-neutral service icon
- Replaces hair-salon-specific scissors in the Services navigation and Checkout service cards with Lucide Shapes, a neutral symbol for services across all supported industries.
- Replaces scissors on the public booking loading state with the same universal service symbol.
- Preserves uploaded business logos, SelahFlow brand identity, custom color palettes, appointments, booking approvals and payment workflows.
- Adds automated regression checks to prevent scissors returning in shared business UI.

## v1.3.12 — Platform administrator 404 routing hotfix
- Platform admin page is still present and restricted; when a signed-in business owner does not have an administrator role, it now redirects to an explicit access-denied screen rather than returning a misleading 404.
- Expired/absent sessions redirect to login with the intended admin destination.
- Admin login checks the platform role BEFORE choosing the business dashboard, so the original Crawford business owner, if also an authorized administrator, lands in /admin/platform after signing in.
- Authorized administrators have a direct "Platform admin" navigation link on their business dashboard.
- One-click account switch signs out a non-admin session and opens the login page. Access to admin metrics, other businesses and approvals is still enforced server-side; no ordinary business owner can bypass roles.
- No migrations or changes to bookings, notification subscriptions, platform administrator roles, or existing business records.

## v1.3.11 — Secure business-specific device push notifications — October 9, 2026
- Native Web Push from the owner/team's authenticated device; opt-in with notification permission, no email/SMS provider account required.
- Adds owner dashboard notification bell with unread counts and per-reviewer read receipts; team reviewers get their own bell and push enrollment.
- Web Push delivered only to the relevant business owner and designated team reviewer. Push uses VAPID and RFC8291 AES-128-GCM; no third-party npm packages needed.
- Each pushed notification links to the correct business. Team notifications receive a short-lived, single-request review link. Opening alerts does not approve appointments.
- Push subscriptions are stored under business_id and reviewer ID; team access is verified using the existing revocable staff link.
- iPhone Home Screen progressive web app metadata and service worker; Android and desktop browser push support.
- Additive migration 009. Existing bookings, branding, subscriptions, email, and SMS settings preserved.

## v1.3.10 — Email and SMS booking review notifications (2026-10-09)
- Opt-in owner Settings checkboxes choose email, SMS, or both for booking approval messages to either owner or designated team member.
- Owner may use signed-in email or override it and store a dedicated phone. Staff members can have individual email and mobile notification contact details.
- A pending request dispatches appointment details with a unique, 72-hour Accept/Decline review link via Resend (email) or Twilio (SMS), when the provider credentials are configured.
- Review link GET never modifies state; authenticated one-time request-specific token permits POST Accept or Decline only after explicit confirmation.
- Accept still transactionally validates staff calendar and service capacity, declining leaves calendar untouched; open pending request cannot reserve a slot.
- Delivery attempts record submitted, failed, not-configured, invalid-destination; owner dashboard displays per-channel outcomes and allows rate-limited retries of unsent channels.
- Existing in-app owner and team review workflows remain; no credential values or recipient details are published in customer booking responses.
- Migration 008 is additive and preserves all previous appointments.

## v1.3.9 — Optional booking approvals and service capacity (2026-10-09)
- Business owners can enable booking approval notifications, choose the owner or an assigned staff member as reviewer, and view live in-app pending requests.
- Team reviewers can use revocable, private, 30-day access links, with dedicated in-app request inbox and accept/decline actions; do not share owner credentials.
- Online booking optionally creates a pending request; no calendar appointment or staff reservation is created until it is accepted. Declines leave the calendar unchanged; accepted requests are committed atomically with staff slots and service capacity checks.
- Service catalog now supports 1–20 maximum simultaneous confirmed appointments per service. Staff cannot be double-booked even if service capacity is greater than 1.
- Business categories are displayed alphabetically on registration.
- New database migration 007 adds booking_requests and expiring team reviewer links, without changing existing appointments.
- Customer confirmation displays a clear Pending Approval message where configured. Email, SMS and push delivery are not part of this release.

## SelahFlow v1.3.8 — Marketplace backfill and platform business drilldown (2026-10-09)
- Existing approved active businesses, including previously non-listed businesses, are published to the marketplace by one-time additive migration 006.
- The public marketplace returns all active businesses, independent of stale preexisting is_listed flags; pending, rejected and suspended businesses remain hidden.
- Platform admin dashboard now includes a clickable, responsive directory of all registered businesses, with industry, city, owner, plan, status and appointment totals.
- Protected administrator-only detail endpoint returns business profile, services, team, aggregate client counts, and the latest 200 customer appointments with status and quoted prices. No customer history is exposed in the public marketplace.
- Monthly/yearly service tracking panels are hidden for businesses with no term-service catalog or historical enrollments; no empty tracking sections are shown in the platform dashboard.
- Active business listings cannot be manually disabled through the legacy listing-approval API.
- Existing bookings, tenants, branding and database records are preserved. Recurring billing remains inactive.

## v1.3.7 — Business approval, duration units and service-term tracking — October 9, 2026

- New business registrations enter 'pending'; primary platform administrator approves/declines from the protected dashboard.
- Approval activates the owner dashboard, public booking and marketplace listing in one server-side update. Declined accounts are not publicly listed.
- Existing active Crawford and other historical businesses retain their status, appointments and data.
- Registration and marketplace dropdowns offer broad categories across beauty, health, education, trades, professional services, events and others.
- State dropdowns for all 50 U.S. states plus Washington, DC in signup, Business Profile and owner Settings.
- Services offer duration units minutes, hours, days, weeks, months and years. Minutes/hours book slots as before; longer services are recorded as term enrollments.
- Owners can record and complete/cancel client enrollments. Monthly and annual active enrollment counts are visible on owner and platform administrator dashboards; no subscription charges or renewals are automated.
- PostgreSQL migration 005 adds pending/rejected business statuses and owner-scoped service_enrollments, without modifying existing appointments.
- The 6-character minimum password policy remains unchanged.

## v1.3.6 — Consistent business branding, address autocomplete & Google Maps — 2026-10-09
- Applied every business theme to every dedicated business screen: owner dashboard pages, dashboard dialogs, public booking, public business profile, and private Business Profile editor.
- Fixed text/background contrast and font propagation in previously hardcoded dashboard, booking, and service card sections; semantic success/error messages remain distinguishable.
- Added OpenStreetMap Photon-powered street address suggestions to dashboard Settings and Business Profile, with server-side validation, cache, request throttling, graceful manual entry fallback, and OpenStreetMap attribution.
- Added universal Google Maps directions links to booking page, confirmation, public business pages, marketplace listings, owner settings, and private Business Profile.
- Synchronizes the selected street address with business settings and city/region, preserving independent business ownership and existing appointments.
- Fixed brand/header and rebooking links to retain the current business slug instead of redirecting other tenants to Crawford.
- No new migrations, changes to booking business logic, service catalog, subscriptions, roles, or passwords.
- Public Photon geocoding demo is intended for modest traffic. Switch to a dedicated/commercial geocoding service for production scale.

## Version 1.3.5 — Business-wide palette and typography customization — 2026-10-09
- 20 coordinated color palettes and 12 font choices with separate heading/body typography.
- 19 editable HEX color roles covering booking header, page, cards, policy, forms, steps, selections, buttons, links, and footer.
- Browser and server validate saved themes; automatically choose readable text colors for contrasting backgrounds.
- Applied themes to individual owners' workspaces, public business profiles and customer booking pages.
- Theme saved per owner in the existing PostgreSQL settings record (no new migration or database reset).
- Existing logos, service/staff catalog, passwords and v1.3.4 six-character password policy preserved.

## Version 1.3.4 — October 9, 2026
- Unified six-character minimum for new owner passwords, password changes, administrator invites, sign-in and startup.
- Matched server validation, browser form limits, user-visible messages and tests.
- No database migrations or existing account password resets.

## Version 1.3.3 — October 9, 2026
- Customizable business logo, brand colors, and business model.
- Add/remove service types and staff, with server-side plan enforcement.
- Secure owner password changes; invited administrators managed by primary account.
- Role-based platform admin route, preserving original appointments and business data.

## Version 1.3.2 — October 9, 2026
- Separate public platform home from per-business dashboards.
- Add Crawford public profile and private workspace.
- Route login and signup to each business workspace.
- Preserve all business and appointment records, and reserve platform slugs.

# SelahFlow release history

## Version 1.3.1 — Branding and favicon patch — 2026-10-09
- Applied SelahFlow Pause & Flow logos, palette and display name to the v1.3 platform.
- Added the deep-teal browser icon with a versioned URL to refresh cached icons.
- Corrected earlier branding release labels; this is a v1.3 patch, not a new feature milestone.
- Preserved business data, Crawford booking, permissions, authentication, workflows and the approved roadmap.

## Version 1.3 (development branch) — 2026-10-08
- Added additive multi-business schema, customer-facing signup, per-business booking slugs, platform admin role, business profile editor, discovery marketplace and listing approval.
- Preserved original /book, owner data and existing calendar/checkout; owner dashboard now resolves its branded booking URL.
- Protected the platform administrator during startup migrations instead of rewriting the oldest owner indiscriminately.
- Added a static proposed price catalog, referral fee calculation and storage tables. Paid checkout, Connect merchant payments, fee assessment, AI, SMS and voice are NOT implemented or live.
- Added platform foundation tests, CI workflow and phased development roadmap in docs/RELEASE_v1.3_ROADMAP.md.
- Requires backup and staging validation. Public self-registration must undergo further email verification, security and abuse testing before unrestricted commercial launch.

# Release history

## Version 1.2 — 2026-10-08
- Added public customer booking at /book, with no customer login required.
- Added a restricted public catalog/availability/booking API using the existing transactional scheduling engine.
- Added public request limits, policy consent, stale-quote protection, idempotent submissions and a hidden anti-bot field.
- Added owner dashboard booking-link copy/open actions and 30-second refresh outside Settings.
- Changed the theme to charcoal, navy and steel blue.
- Preserved existing records, owner authentication and the 6-character admin password minimum.

## Version 1.1 — 2026-10-08
- Reduced ADMIN_PASSWORD minimum length from 16 to 6 characters.
- Updated setup instructions and environment example.
- Existing passwords continue to work; change ADMIN_PASSWORD in Render and restart to set a new password.

## Version 1 — 2026-10-08
- Standalone GitHub + Render distribution.
- Standard Next.js Node server and PostgreSQL persistence.
- Independent owner email/password login and secure session cookies.
- Removed ChatGPT login, Sites, Cloudflare runtime, and OpenAI dependencies.
- Preserved appointment booking, calendar, clients, catalog settings, check-in, cancellation, manual cash checkout, reporting, and guided FAQ assistant.
- Added Render Blueprint, database migrations, startup account provisioning and deployment instructions.

## Version convention
Current release: 1.3.1. Branding/fix patches remain in the 1.3.x series; feature milestones follow the approved roadmap.
ZIP filenames: SelahFlow_Studio_v1.zip, SelahFlow_Studio_v1.1.zip, …
The package.json machine version for version 1 is 1.0.0; version 1.1 uses 1.1.0.
Do not create an empty new version without actual changes.
## v1.3.65 — Owner registration parity and session question editing

- Client Directory **Add client** and **Edit client** now use the same standard and global booking registration fields that customers see, including owner-configured labels, required fields, and custom questions.
- Owner-entered registration answers are stored with the client profile separately from spreadsheet imports and remain available when the profile is edited.
- Every Bookable Session now has an **Edit session questions** button. Its editor shows standard fields as well as the global and session-specific questions that apply to that session; standard-field changes remain consistently applied across booking forms.
- Migration 032 adds dedicated client-profile registration-answer and original-label storage without changing existing client, membership, appointment, or import history.
## v1.3.70 — Remove pre-tax wording

- Removed “before applicable tax” and related pre-tax wording from public and owner booking summaries and confirmations.
## v1.3.84 — Booking and membership Stripe checkout (staging only)

- Make Payment opens hosted Stripe Checkout on the business's existing connected account, for confirmed paid bookings and recurring membership signup. Pay-at-business and manual membership requests remain available. Approval-required bookings cannot be charged before acceptance; membership-covered bookings remain free.
- Server-saved booking prices, membership price/credit snapshots, account/tenant checks, verified webhook fulfillment and server-verified return pages. Provider receipts prevent duplicate revenue or session credits, including recurring invoices and repeated clicks.
- Additive migration 036 stores checkout/receipt references without card details or changes to historical payments. Stripe-linked memberships cannot be manually double-credited. Production remains unchanged.

## v1.3.85 — Current Stripe Checkout payment-method filter (staging only)

- Replaces removed payment_method_types with the documented allowed_payment_method_types card filter in booking and membership Checkout; found through the real sandbox smoke test.
- Booking footer actions wrap on narrow mobile screens. Existing records and production are unchanged.

## v1.3.86 — Current invoice verification (staging only)

- Accepts the current paid-invoice schema without the removed paid boolean, while retaining explicit-false and amount checks.
- Retrieves off-Stripe payment totals so manually marked invoices cannot activate online memberships. Existing provider receipts reconcile without charging again or duplicating credits.
