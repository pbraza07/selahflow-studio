# Production promotion — v1.3.97 VERIFIED LIVE (2026-10-17)

The owner explicitly authorized promoting all tested staging implementation to production. PR #37 merged staging head 383eadd495a2073895b80b2b24be029e5f1ff7a9 into main as 255b934aa848a5b135dfc2ac0438ce6133d32718. Render production srv-db3tokqd0e5s73f31hfg auto-deployed dep-db9l64rrjlhs73bq2ih0, LIVE at 10:52:36 UTC. Health and public footer show 1.3.97. Startup logged database migrations/owner account ready at 10:52:27 UTC; no post-deploy error logs observed during checks. The unchanged application source passed TypeScript, all 229 tests and production build before staging deployment. No production customer bookings, charges, credential resets or provider messages were used for testing.

Live public checks passed for the homepage, health endpoint, and overview/booking/membership navigation across Arcila, Shekinah, Capstone and Car Shine. Membership navigation links were verified after client data finished loading. Production retains its own database, credentials and merchant records; no staging snapshot, synthetic records, sandbox accounts or secrets were copied. Staging import/sandbox preparation remain opt-in and were not enabled in production. Migrations 036–040 were reviewed for promotion. Paid platform subscriptions, the proposed 10% fee and Twilio remain inactive/deferred.

IMPORTANT REMAINING PROVIDER SETUP: public booking config reports canPay=false for all four active production businesses. Do not claim production payment collection or Gmail delivery is ready from the code promotion. The production administrator route redirected to login; its provider settings and Gmail authorization could not be inspected without owner sign-in. Production live Stripe credentials/merchant onboarding and Gmail OAuth redirect/authorization must be configured or verified separately. Do not copy staging encrypted refresh tokens or sandbox merchant IDs. Documentation-only commits after the LIVE merge use [skip render] and are not new app deployments.

# v1.3.97 release handoff — Partner benefits and revenue transparency (staging only)

VERIFIED LIVE 2026-10-17 02:52 UTC: code 4fc73e78395493feaf2ac8b962ba8e52f1ed4e94, Render dep-db9e4cm1egvs73etqcsg, visible homepage footer 1.3.97. TypeScript, all 229 tests and production build passed locally and on Render. Live desktop inspection verified partner section, all three plan expanders (eight included benefits each), business examples and revenue FAQ. Screenshots reviewed for legibility/spacing; no new phone-device visual check. Explicit inactive/proposed billing and commission labels visible. Production remains on its existing deployment. Documentation commits after the LIVE code are not new app deployments.

The attached revenue/business-benefits PDF informed concise homepage partner outcomes, respectful business-model examples and an explicit revenue explainer. Current plan prices/limits/benefits come from unchanged PLAN_CATALOG, not unverified PDF assumptions. Three primary plan limits remain visible; full included benefits and other limits expand. Proposed paid billing and 10% first-customer commission are labeled inactive; commission proposal explicitly includes direct links/referrals/social/marketplace, excludes repeat visits at the same business, and requires published accepted terms before activation. Optional extras and processing fees are separate. No billing, entitlement, business data or payment-path changes. Verify checks and exact staging LIVE release before claiming deployment. Production remains v1.3.81.

# v1.3.96 release handoff — Consistent tenant navigation and status checkout (staging only)

VERIFIED LIVE 2026-10-17 02:01 UTC: code 5d95e974d8af150ed55050382b38790c3857cb82, deployment dep-db9dcd7avr4c73dl475g. TypeScript, all 229 tests and production build passed locally and on Render. Shared navigation verified on all five active staging business overview, booking and membership pages. Existing synthetic SG0203 shows approved/$25 due and Make Payment; click opens DOB verification. SB0405 shows Stripe payment received with no payment button; SM0102 retains active membership type/package/five sessions and No payment due. No new booking, charge or actual DOB checkout submission was performed in this release; checkout identity/tenant/approval/reuse were tested against PostgreSQL with a simulated Stripe transport. No post-deploy error logs observed. Production remains on dep-db8ao7rrjlhs73cvrf3g. Documentation commits after this code are not new app deployments.

Shared BusinessNavigation now serves all business overview, booking and membership routes, with responsive customer actions and preserved per-tenant theme/name/header note. Check My Registration keeps existing membership and latest appointment fields and adds payment state. An approved, unpaid, non-covered booking for a ready Stripe merchant offers Make Payment. ID-only responses never contain private tokens, DOB or contacts; opening checkout requires the saved registration DOB and is throttled. Temporary checkout access is removed after the existing checkout helper returns; its approval, business, price, coverage and payment-idempotency checks remain authoritative. No migrations. Verify tests, exact Render LIVE commit and public UI before reporting deployed.

Prior v1.3.95 verified LIVE: commit 68dda41faa9ffe4b806532c429a0b23238fb19d7, deploy dep-db98pgjncjis73d2obp0. Homepage Arcila search returned its business and clearing filters restored all five staging listings. Production remains v1.3.81; no promotion authorized.

# v1.3.95 release handoff — Search-first public experience (staging only)

The user's reference video inspired search-first navigation and distinct customer/owner paths, not copied branding. Homepage GET search and category links feed discovery URL filters. Shared responsive navigation, labeled inputs, result feedback, request cancellation, back/forward restoration, retry/clear actions and direct booking cards improve the existing marketplace. Retain SelahFlow forest/sage/cream and all tenant branding. No backend, database or payment changes. Verify checks and exact Render LIVE commit before reporting deployed.

Confirmed before this release: v1.3.94 LIVE at da0313491a4b7ee46395d0345bc08623348b9fba, dep-db95b9bs0pts7395hj00. After the user enabled Gmail API, the existing synthetic booking 170b3e46 payment-link email was submitted. The user completed sandbox payment; owner UI verified Payment received and confirmation email submitted on 2026-10-16. Provider acceptance is not independent inbox proof. SMS stays paused; external staging email remains restricted to the approved test recipient. Production unchanged.

# v1.3.94 release handoff — Gmail delivery rollout recovery (staging only)

The primary administrator connected the shared Gmail sender, verified in the authenticated staging UI. Only the explicitly approved test email is allowlisted; no phone destinations are allowed and Twilio remains paused. Temporary snapshot-import payload settings were cleared after the import guard blocked enabling notifications. A subsequent startup confirmed Gmail connected, delivery enabled, one approved email and zero phones, but deployment timed out. PostgreSQL logs prove the dedicated staging role exhausted its five-connection limit. v1.3.94 shares the pool across instrumentation and route module graphs, with max two staging connections per process; role permissions/limits and production remain unchanged. Verify tests, exact Render LIVE commit, current provider status and actual Gmail submission before claiming the fix complete.

One synthetic booking was submitted with policy consent and approved in staging-test-studio: request 68171cd7-ab89-4a28-9535-39f5cb84cca7, appointment prefix 170b3e46, member ID SE0204, October 23 at 9 AM Eastern, $25. Its existing Stripe sandbox Checkout is prepared but NOT paid. Preserve and reuse this booking, do not create another or perform final payment submission on the user's behalf. Do not record private payment URLs, credentials or recipient contacts here. Gmail acceptance and inbox receipt remain unverified at source preparation time.

# v1.3.88 release handoff — Shared Gmail sender

VERIFIED LIVE staging: code `44fb0a17301faa05eefee32491a3d7f5a3652a2b`, Render `dep-db8nlmks728c73ad29k0`, health 1.3.88. All 220 tests, typecheck and build passed locally and on Render; migrations/startup succeeded. Staging EMAIL_PROVIDER is gmail and a fresh encryption key was securely provisioned in Render without exposing its value. Authenticated primary-admin UI verified that only GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET remain missing; Connect Gmail correctly stays disabled. Anonymous GET is 401; originless POST is 403. Google Cloud Console showed Site Unavailable after one reload; no Google application credentials, account authorization or real Gmail delivery could be completed. No sender account was assumed. See GMAIL_EMAIL_SETUP.md for the exact callback and safe completion steps. Production remains v1.3.81 on its existing LIVE deployment; no paid resources were created. Documentation commits after this code are not new app deployments.

- New Gmail HTTPS API transport and primary-admin-only Connect/Reconnect/Disconnect panel. One sending account serves business-scoped notifications. Gmail.send plus OpenID email identifies the verified sender; no inbox read/delete scope.
- Migration 038 stores AES-256-GCM encrypted refresh credentials and ten-minute, one-time, session-bound PKCE states. Expired authorization needs reconnection; ambiguous sends are not blindly retried. Staging recipient guards and Stripe/payment/history paths are preserved.
- Gmail is selected explicitly with EMAIL_PROVIDER=gmail, or by default if no legacy Resend key exists. Existing Resend configurations stay compatible. Google Cloud Console was unavailable in the task browser; application credentials/account consent and actual delivery remain pending. See docs/GMAIL_EMAIL_SETUP.md. Verify exact Render LIVE status before claiming deployment. Production remains v1.3.81.

# v1.3.87 release handoff — Approval payment notifications

VERIFIED LIVE staging: code `5bf2ceea7531e4718d67cec1337088c0050d331e`, Render `dep-db8l5467bikc73feaij0`, health 1.3.87. TypeScript, all 217 tests and build passed locally and on Render; startup migrations succeeded. Owner approval was enabled for the staging test business. A synthetic pending request refused payment until accepted; acceptance created two client payment-link jobs. An actual $25 connected sandbox Checkout then verified as paid and created two confirmation jobs. Repeated return verification retained four message records. The background worker changed both confirmation channels to not configured because external staging delivery is disabled. No actual email/SMS delivery or independent live webhook-only fulfillment was verified. Production remains LIVE v1.3.81, commit `806a87f23e211b1259af6415f7e54c1d27b4822d`. Documentation commits after the code do not imply another deployment.

- Additive migration 037 commits one email and SMS message with each payable booking approval; a private 30-day fragment-token link opens existing connected Stripe Checkout. Free/covered bookings skip payment. Registration identity/payment snapshots are retained on acceptance.
- Verified connected-account receipt commits confirmation messages with the financial writes. Duplicate callbacks do not duplicate messages or revenue. A startup worker uses the existing process/pool, durable claims and bounded retries; ambiguous outcomes require a provider check. No paid worker or resources.
- Owner approval inbox shows masked destinations, channel/provider status and retries for unsent failed/unconfigured messages. Submitted means provider-accepted, not delivered. Phone requires an explicit country code. Email security scanners cannot start checkout.
- Staging UI on 2026-10-15 reports Resend and Twilio not configured. Keep external delivery disabled until test provider credentials and explicit recipient allowlists are supplied. Never claim actual SMS/email delivery or independent live webhook delivery without evidence.
- Run typecheck, all tests and build, then verify exact staging LIVE release/health before claiming deployment. Production remains v1.3.81; do not merge to main without authorization.

# v1.3.86 release handoff — VERIFIED staging checkout

LIVE code `d4a42e93609eed3412a14502fcb11a37b84bc12d`, Render `dep-db8j358473hc73f49c90`; health 1.3.86. TypeScript, 215 tests and build passed locally and on Render. Both Make Payment buttons opened existing connected sandbox Checkout. Verified $25 booking payment, cancellation/retry session reuse, $20/month membership activation with three credits, refresh without duplicate credit, and once-only report entries. Current invoice verification handles the removed paid boolean and excludes off-Stripe totals. No real funds, new paid resources or production changes. Production stays v1.3.81 at its existing LIVE deploy. See STAGING_ENVIRONMENT.md for exact checks and webhook/recurring-cycle test limitations. Documentation commits after the LIVE code do not imply another app deployment.

# v1.3.83 release handoff — Stripe managed-risk onboarding (staging only)

New accounts use v2/core/accounts, JSON and pinned 2026-09-30.endive, with dashboard=full and Stripe fees/losses responsibility. Existing account IDs and v1 hosted account links/readiness remain compatible. This fixes the legacy Express type rejection without changing platform loss liability. Verified LIVE staging commit cafcfe1540c9c99fd71fedb105140943ed2409be, deployment dep-db8fhvs9v7es73bmd8s0. TypeScript, 211 tests and build passed locally and on Render. The authenticated Connect button created the sandbox account and redirected to Stripe hosted onboarding with the test-account banner. Onboarding was left incomplete for the owner; no payment was attempted. Production remains untouched. Do not infer LIVE from this source note.

# v1.3.82 release handoff — Staging setup (2026-10-15)

Verified staging: https://selahflow-staging.onrender.com/; LIVE code `304e8ed4decbbfffc453f1d643adc2a9528ba85e`, deploy `dep-db8egau89jmc73d74i80`. 208 automated tests and 47 live checks passed. Production remains v1.3.81 unchanged. Stripe sandbox credentials and real provider checkout testing remain pending. See `docs/STAGING_ENVIRONMENT.md` before changes.

- This release is confined to `staging`. Production main remains v1.3.81, commit `806a87f23e211b1259af6415f7e54c1d27b4822d`. Do not merge or deploy to production without the owner's explicit authorization.
- Shared-instance database/user isolation is separately provisioned; startup verifies staging database, username, host, branch and URL before migrations. No production records or payment credentials are copied.
- Stripe only accepts test keys and test webhook events. External email/SMS require staging enablement and recipient allowlists; push defaults disabled.
- See `docs/STAGING_ENVIRONMENT.md` for configuration, validation and promotion procedure. This handoff is source state, not a claim of a LIVE staging deployment.
- Staging acceptance exposed an existing profile-save SQL placeholder gap. The shared profile persistence helper removes the unused bound parameter and has a tenant-scope/branding regression test. Home footer now follows APP_VERSION. These corrections remain confined to staging.

# SelahFlow Booking App — ChatGPT Project Continuity

## v1.3.81 release handoff — Membership ID policy (2026-10-15)

- Baseline LIVE: v1.3.80, main `14995896bba4a589be4bed5f4f91802905a9a2d4`.
- Membership ID settings saves a business-scoped policy: initials_birthdate (default, sequential fallback on collisions), initials_sequence, random. All remain two letters/four digits.
- Migration 035 backfills a business/ID reservation table and adds triggers guarding membership, booking ID and directory writes. Shared allocator uses a transaction-level business lock and never reassigns a reserved number to another identity. Existing identity matching uses normalized name and DOB; no old IDs or attendance/payment records are rewritten.
- Applied to owner client creation, manual membership registration, request approval, public booking and Stripe checkout. Verify migration startup and exact Render LIVE version before handoff.

## v1.3.80 release handoff — Exclude deleted records from revenue (2026-10-15)

- Supersedes v1.3.79 inclusion of audit-only payments for removed memberships: paid revenue now requires a retained membership and plan within the owner business. Status/plan inactivity alone is not deletion.
- Paid service sales exclude lines whose service ID no longer exists in the catalog. Mixed sales retain other lines at original prices; raw events remain unchanged. Shared server filtering drives totals, breakdowns and transactions.
- Baseline LIVE main was `fc1318422ca78817b6daeb26f4edc7f4a47782bf` (v1.3.79). Verify exact v1.3.80 LIVE commit and health before handoff.

## v1.3.79 release handoff — Paid revenue reconciliation (2026-10-15)

- Prior LIVE baseline: v1.3.78, main `6b286be87d2b428572b5a1b4a55c673494e9ccb7`.
- Legacy membership audit totals are cents; normalize once and reconcile ledger copies by request ID, or one-to-one member/amount/timestamp matching for legacy writes. Audit-only history survives removed clients.
- Future manual payments explicitly store amountCents/requestId. Reports show memberships in breakdown and transaction list; no 500-row payment truncation. No migration or financial-history mutation. Verify exact Render LIVE commit and health before handoff.

## v1.3.78 release handoff — ID-only membership summary (2026-10-14)

- Prior verified LIVE baseline: v1.3.77, main `d111c7c7e076ac9da63791ec92d23814137163f5`, Render `dep-db7rbeugekts73eahrgg`.
- Fixed the missing membership payload in `registration_latest_status`. Check My Registration now shows membership type/group, package, status and usable sessions left, plus the existing latest appointment status/date, from the unique ID only.
- Lookup uses joined plan/group names and the membership counters within the requested business. Exhausted/inactive memberships show zero usable sessions; ID-only searches keep existing validation/throttling and do not return contact or birth-date details.
- No migration or mutation of memberships, bookings, credits, payments or history. The detailed booking auto-fill flow remains separate. Verify the exact v1.3.78 LIVE deployment and health before handoff.

## v1.3.77 release handoff — editable membership badges (2026-10-14)

- Prior verified LIVE baseline: v1.3.76, main `69e9432596437c1f70d6b44ce42107a75f060626`, Render `dep-db7qvllbedkc7390m88g`.
- Membership type forms and plan create/edit dialogs now include badge controls for label, background, curated icon and shape, plus a live preview. A plan-specific badge overrides the type badge; null restores inheritance/automatic styling.
- Badge settings flow to member enrollments, client cards/details, Overview appointments, customer plan cards and type tabs. Dashboard data refreshes on membership changes. Text contrast is automatic; no text-color settings were reintroduced.
- Migration 034 adds nullable JSON badge fields to membership groups and plans. Existing automatic badge colors remain the default. Exhausted/inactive members stay neutral ID-only; active renewal restores saved badge styling with unchanged IDs, credits and history.
- Source release v1.3.77 requires independent LIVE deployment/startup/health verification before handoff.

## v1.3.76 release handoff — membership type tabs and owner dialogs (2026-10-14)

- Prior verified LIVE baseline: v1.3.75, main `468b3615cd62d7939b8dfd2f5606ea7acaa48de1`, Render `dep-db7o3r942hec739erdpg`.
- Memberships now has Membership types, Create membership plan, and Assign a member buttons. Types can be created/renamed/reordered/removed; plan create/edit and member assignment are modal-only. Existing client-prefill opens the assignment modal.
- Customer membership pages show nonempty type tabs plus All memberships and an ungrouped fallback. No demo types or memberships are added automatically.
- Migration 033 adds groups and nullable plan group references constrained to the same business. Removing a type only clears plan grouping, preserving plans, member IDs, session balances, payment records and request/attendance history. Existing active-plan subscription quotas still apply.
- Release source is v1.3.76; verify the matching Render LIVE deployment, startup migration and health endpoint before reporting it deployed.

## v1.3.75 release handoff — white membership labels and no text-color controls (2026-10-14)

- Verified prior LIVE baseline: v1.3.74, GitHub main `6535de85245a7ef0e9b343e503bd0e108e6da48d`, Render `dep-db7npqm0tbcc73c3td4g`.
- Fixed CSS specificity overriding the membership-ID label on black shared registration panels. Labels/helpers/status are white; white input fields retain dark values and placeholders.
- Removed visual editor text-color controls and derive text colors from backgrounds in shared theme resolution and all owner theme/settings saves. Legacy color keys are retained only for schema compatibility, not customization.
- No data migration or customer/financial record changes. Release source is v1.3.75; verify its exact Render LIVE commit and health version before claiming deployment.

# v1.3.74 handoff — editable booking header phrase (2026-10-14)

- Added `bookingHeaderNote` as an owner-editable booking page setting and visual-editor field; the live booking header now uses the saved value.
- Release metadata is `1.3.74`; verify the matching Render deploy and `/api/health` before handoff.

# v1.3.73 handoff — visual page editing (2026-10-14)

- **Edit this page** now opens a page-style owner editor with inline editable copy, page switching, direct color controls, live-page preview and one save action.
- Release metadata is `1.3.73`; verify the matching Render deploy and `/api/health` before handoff.

# v1.3.72 handoff — owner page editor (2026-10-14)

- Added owner-only Page editor access from dashboard pages and Settings, consolidating supported wording, appearance, colors, fonts, logo and imagery controls.
- Release metadata is `1.3.72`; verify the matching Render deploy and `/api/health` before handoff.

# v1.3.71 handoff — collapsed blockout schedules (2026-10-14)

- Owner booking blockout schedules are collapsed by default and expand on demand for editing.
- Release metadata is `1.3.71`; verify the matching Render deploy and `/api/health` before handoff.

# v1.3.70 handoff — remove pre-tax wording (2026-10-14)

- Booking summaries and confirmation surfaces no longer display “before applicable tax” or related pre-tax wording.
- Release metadata is `1.3.70`; verify the matching Render deploy and `/api/health` before handoff.

This document is a durable **handoff** for new ChatGPT conversations in the **SelahFlow Booking App** Project. It is also mirrored in the GitHub repository. Its "latest" facts are only a dated snapshot; verify the actual live deployment at the beginning of every implementation or version-status request.

## One-time Project Instructions (copy this section into ChatGPT Project settings)

**Project:** SelahFlow Booking App. Continue work on the existing **SelahFlow** platform. Do not rebuild from scratch and do not confuse it with the separate ArcilaTrainingBooking service. Default all changes to **every existing and future business**, not just an example business, unless I explicitly request a business-only customization.

**GitHub production:** `pbraza07/selahflow-studio`, branch `main`. **Render production service:** `selahflow-studio` (`srv-db3tokqd0e5s73f31hfg`), public URL `https://salonflow-hf3w.onrender.com`. **Admin:** `/admin/platform`.

**At the start of every new conversation involving a version, implementation, bug or deployment:** consult `AGENTS.md` and `docs/CHATGPT_PROJECT_CONTINUITY.md` in that GitHub repository; then check **the latest Render LIVE deploy and commit SHA** against **`package.json` on the GitHub `main` branch**. Do not infer the live version from old chat messages, the README, stale feature branches, or a local `VERSION` file alone. Identify already shipped features, outstanding asks and unmerged PRs before making changes. As of 2026-10-11 the confirmed live version is **v1.3.30**, but **verify afresh**.

**Release numbering:** advance sequentially by one patch for each new functional release (after v1.3.30, v1.3.31), not v1.4 without my explicit instruction. Keep `package.json`, `package-lock.json`, `VERSION`, displayed version and changelog aligned.

**Nonnegotiable behavior:** maintain strict tenant isolation; preserve ALL customer, booking, attendance, service, team, notification, membership, financial and business history. Business removal is a reversible archive rather than deletion. Preserve each business's chosen color palette and mobile/desktop accessibility. Recurring/one-off session changes preserve booked customers, original bookings and seat availability; moving to a new coach does not reset session capacity. Apply plan entitlements server-side from actual subscription records, including approved ad hoc extra staff seats. Admin passwords are one-way hashed and not viewable.

**Verification:** implement in a branch, test TypeScript + automated tests + production build, merge only after passing, confirm **Render LIVE** for the actual SHA, then report what shipped, what remains pending, and what still requires manual verification. Never say deployed merely because code is written or CI passed. Do not expose API keys, owner passwords or customer private data in docs.

**Known distinctions:** Free/Professional/Business benefit limits were deployed in v1.3.29, but paid platform-subscription checkout is not configured. Owners' private session roster from daily/weekly/monthly calendar was deployed in v1.3.30. Google Places photos, merchant Stripe membership payments, provider SMS and generative AI require separately configured integrations. Historic roadmap text may be stale.

## Current production snapshot (2026-10-11)

| Field | Verified value |
|---|---|
| Application | SelahFlow (Pause & Flow), multi-business appointment SaaS |
| Live version | **1.3.30** |
| GitHub main commit | `0fa66cc10e38569e6b6cf6736de1cb152dfaa6a1` |
| Render live deployment | `dep-db5eurou01pc73ek74qg` |
| Render service ID | `srv-db3tokqd0e5s73f31hfg` |
| Render workspace ID | `tea-da643qgu01pc73951gdg` |
| Production URL | https://salonflow-hf3w.onrender.com |
| GitHub | https://github.com/pbraza07/selahflow-studio |
| Next functional release | v1.3.31, **if production still 1.3.30** |
| Open PR #34 | Open at snapshot; review against newer main before any merge |

### Already implemented through v1.3.30

- Multi-business onboarding, owners, business listing/discovery and private dashboards.
- Per-business branding and color customization; booking, service and staff management, capacity tracking and booking approval.
- Push notification/review support, custom booking questions, recurring sessions, daily/weekly/monthly calendars and next-quarter-hour availability rules.
- Registered customers preserved through session rescheduling; team transfers preserve booked customers and remaining slots, e.g. 9/10 remains 9/10.
- Client cards with submitted booking information, attendance/service history, and Excel export.
- Owner-managed business membership plans; payment processing depends on Stripe integration/merchant onboarding.
- Google Maps listing/gallery integration depends on Google Places API setup.
- Platform administrator business management, secure credential recovery, owner email changes, reversible archives, plan entitlements and ad hoc extra staff approvals.
- Sidebar business-workspace card navigates back to the correct business homepage.
- Free, Professional and Business tier comparison cards and backend entitlements deployed in v1.3.29; paid tier subscription checkout still proposed.
- Owner daily/weekly/monthly calendar private session roster showing enrolled client details deployed in v1.3.30.

### Carry-forward feature requirements

1. **Tenant-wide as default:** any new user request applies across existing and future businesses unless explicitly restricted.
2. **Booking integrity:** 15-minute increments, safe atomic group capacity; show accurate remaining seats across customer and owner calendars; never invalidate confirmed customers while editing or transferring sessions.
3. **Client integrity:** retain each client's booking answers and history, track services/days attended, preserve data through edits, archiving or plan changes.
4. **Brand/UI:** owner-configured palettes throughout app, responsive polished Settings and calendar layouts on phone/tablet/desktop.
5. **Admin:** permissioned management, secure credentials, non-destructive business archive, manual plan and extra staff approvals; no fake payment events.
6. **Truthfulness:** distinguish deployed from in-progress and optional configurations; existing repo docs may be older than actual production.

## How to activate continuity in ChatGPT itself

This repository documentation helps when ChatGPT inspects connected GitHub, but repository files are **not automatically injected into every ChatGPT conversation**. For automatic carry-over inside this ChatGPT Project:

1. Open the **SelahFlow Booking App** Project.
2. Open its **Project settings / Project instructions**.
3. Copy the **One-time Project Instructions** section above into the project's instructions and save.
4. Optionally upload this Markdown file to the Project's files/knowledge so new chats can find the detailed handoff.

The ChatGPT assistant cannot directly edit the Project's settings from a conversation. After these steps, new chats in this Project can use these rules; still re-check the LIVE deploy each time.

## 2026-10-13 — v1.3.60 release handoff

Verified prior LIVE baseline: v1.3.59, commit `85601176bb5a0acdb430c18753965110f5f4f150`, Render `dep-db724u2bt3mc73dvl0m0`. The requested Overview IDs, once-only attendance deductions, neutral exhausted badges, and additive renewal with preserved history are present in that baseline. v1.3.60 carries these forward and makes health and visible version labels follow package.json. No data migrations or rewrites. Verify the v1.3.60 deployment independently; this source note is not a LIVE claim.

## 2026-10-13 — v1.3.61 release handoff

Verified prior LIVE baseline: v1.3.60, commit `c6f8d0f8212561c5979e6fade4a5d0f9711d7f4c`, Render `dep-db73bt67bikc73fqrb0g`. Release 1.3.61 includes sortable owner tables, all-appointments Overview, calendar attendance actions and reversible Check in/No-show with once-only credits, bordered inputs, scheduled-session selection, editable public page wording, editable/ordered booking and membership fields, per-session questions, blockout dates/times, member-scoped history, ordered packages and public membership approval requests. See CHANGELOG for detail. Migration 029 adds request storage and package ordering. Approval creates/links the same member and client; payment confirmation still activates/renews credits separately. Request push/email/SMS depends on configured providers; in-app alerts are independent. The release source is not proof of deployment: verify exact Render LIVE commit and health version.

Validation: all 178 automated tests and TypeScript pass. Production build passes. Local browser installation failed, so visual browser QA remains unverified; no production customer bookings, attendance, requests, or payment records were changed for testing.

## 2026-10-13 — v1.3.62 release handoff

The next release adds a future-facing six-character member-ID constraint, service/session membership-credit eligibility, ledger-backed membership payment revenue, and session-local required/push questions. Existing history is preserved. The Arcila Training Noah Alves deletion must be verified against the exact member record and performed through the authenticated owner interface; do not delete similarly named records. Verify Render LIVE commit and health version before describing this source as deployed.
# v1.3.66 handoff — dark-surface text contrast (2026-10-14)

- `app/globals.css` now explicitly preserves readable text and placeholder contrast in themed dark registration/booking surfaces, including optional markers and helper/status copy.
- Release metadata is `1.3.66`; verify the matching Render deploy and `/api/health` before handoff.
# v1.3.67 handoff — fixed white dark-surface text (2026-10-14)

- Owner theme settings no longer render Typography & details text-color controls; text on dark booking/registration surfaces remains readable white.
- Release metadata is `1.3.67`; verify the matching Render deploy and `/api/health` before handoff.
# v1.3.68 handoff — precise white membership-panel text (2026-10-14)

- The membership-ID booking panel is explicitly black with white text, including optional/helper/status content and placeholders; the owner theme editor has no text-color control.
- Release metadata is `1.3.68`; verify the matching Render deploy and `/api/health` before handoff.
# v1.3.69 handoff — membership-credit booking price (2026-10-14)

- Verified active members with remaining sessions see `$0.00` on the final booking confirmation; regular-price validation remains server-side and session credit eligibility is respected.
- Release metadata is `1.3.69`; verify the matching Render deploy and `/api/health` before handoff.
## 2026-10-15 — v1.3.84 release handoff

Staging-only source adds booking and recurring membership Make Payment through the existing connected Stripe sandbox. Checkout prices and session credits are server-snapshotted; tenant checks and provider-reference receipts protect against duplicate charges, revenue or credits. Membership-covered bookings remain $0, approval-required bookings must be accepted first, manual requests/pay-at-business remain. Additive migration 036. Do not promote to main or production without explicit owner authorization. This source note is not proof of a LIVE deploy; verify Render and health and record provider-test limitations in STAGING_ENVIRONMENT.md.

# v1.3.85 release handoff — Stripe Checkout API compatibility (staging only)

Provider testing on LIVE v1.3.84 exposed rejection of the removed payment_method_types creation parameter. Both checkout flows now use the current allowed_payment_method_types card filter. Public booking footer actions wrap on narrow screens. Preserve receipts, snapshots and all v1.3.84 safeguards. Verify the new LIVE deploy and actual sandbox checkouts before claiming success. Production remains v1.3.81 and must not be deployed without authorization.

# v1.3.86 release handoff — Current Stripe invoice schema (staging only)

LIVE sandbox testing on v1.3.85 verified booking payment and cancelled-checkout reuse; recurring Checkout took the test payment but activation stayed pending because the current invoice schema omits the old paid boolean. This fix verifies paid status plus a positive integer amount, retrieves amount_paid_off_stripe for webhook/return fulfillment, and excludes off-Stripe payments. The paid test membership can be reconciled by its existing return page after deployment; do not charge it again. Production remains unchanged. Verify LIVE and the membership's once-only credits/revenue.

# v1.3.90 release handoff — All-business Stripe setup (staging only)

VERIFIED LIVE 2026-10-16 UTC: code 064bd99a2c9a7d8bcb0c51b656436f1177e930ce, Render dep-db9030vavr4c73cim47g, health 1.3.90. All 225 tests, typecheck and build pass locally/on Render. STAGING_PREPARE_STRIPE=true provisioned separate accounts for Arcila/Capstone/Shekinah/Car Shine, all connected but onboarding pending; original synthetic studio remains Stripe-verified ready. Public canPay false for the four, true for fixture. Primary API anonymous GET=401/originless POST=403. Production remains 1.3.81 on the same deployment. Staging primary-admin sign-in is pending, so panel visual QA/onboarding not completed. A synthetic Payment Sync fixture enrollment opened $20/month Stripe Sandbox Checkout; automatic approval review blocked the final submission and requires manual user action. It is pending, not paid; reuse its existing Checkout. No production changes, real charges or new resources. Documentation commits after LIVE code are not new deployments.

The user requested payment buttons and Stripe setup for every business after the production snapshot. Shared booking/membership payment buttons already existed; copied businesses had no sandbox merchant connection. This release adds a primary-admin-only Business Stripe payments panel and server-verified status synchronization. STAGING_PREPARE_STRIPE=true prepares separate sandbox accounts for active businesses at startup, preserves existing connections and skips archived tenants. It never invents readiness, submits agreements or charges clients. Stripe onboarding still must be completed where requested. Production/main remain unchanged. Verify LIVE, actual account setup results and private UI access before claiming readiness; staging admin sign-in was pending during implementation.

# v1.3.89 release handoff — Production business replicas (staging only)

VERIFIED LIVE on 2026-10-16 UTC: code 2cd1043920aa26b732710c093a92410e60458dcf, Render dep-db8qma2vcj2c73asf7ig, health 1.3.89. The 04:35:37 UTC snapshot copied all five production businesses and verified 28 table counts. Arcila, Capstone, Car Shine and Shekinah public booking configurations verified against production; source Crawford stays archived. Synthetic sandbox studio is now /book/staging-test-studio and retains canPay=true. Copied businesses require separate sandbox connection and staging-only login reset. Temporary import env payload values cleared with Save only; no extra deploy. Production remains 1.3.81 on dep-db8ao7rrjlhs73cvrf3g. All 223 tests, TypeScript and build passed locally/on Render; no new paid resources. Private owner logins were not manually tested. Documentation commits after the LIVE code are not new app deployments.

Explicit owner authorization permits a one-time read-only production business snapshot into staging. The reviewed startup importer retains business/source IDs, settings, branding and client/history records, preserves the synthetic studio/sandbox merchant under staging-test-studio, excludes production auth/tokens/provider connections, and backs up staging tables transactionally before insert. Destination database/role and notification guards fail closed. Repeated startup is idempotent; a later snapshot requires a new reviewed migration. Migration 039 is additive. Imported owner logins require staging-only admin reset; no production credentials are copied. Verify tests, LIVE deployment and import row counts before declaring completion. Production remains v1.3.81 and must not be deployed without separate authorization.


## v1.3.93 release handoff — Legacy booking compatibility and payment delivery (staging only)

Arcila staging DB logs at 12:25–12:26 UTC identify business_client_profiles_member_number_six, despite the user describing the registrant as new. Migration 040 allows only historical IDs captured in a tenant-scoped reservation table; new malformed IDs remain rejected and existing identity guards remain active. Existing history and IDs are unchanged. US phone normalization now handles common omitted +1 in payment SMS. Approval-to-link and verified-payment confirmation flow already existed; provider setup is not proof of actual delivery. Sanitized startup readiness reports missing Gmail/Twilio configuration names and allowlist counts only. Local synthetic Staging Bookingprobe request 111808aa-946f-47f8-82e8-6482f88347d5 saved successfully before the fix, is pending approval and uses fictional contacts; preserve it and do not recreate it. Browser Render configuration is at a sign-in wall. Full checks/deployment/provider-state verification pending. Production unchanged.

VERIFIED Render LIVE 2026-10-16 12:57 UTC: code dad842f4f2da7465492c6599257497b76c7d5d6d, deployment dep-db91saivcj2c73bjsepg. All 227 tests, typecheck and build passed locally/on Render, including reproduction of the exact constraint and successful booking-route reuse of legacy records. Migration startup successful. Actual failed client retry remains user verification; no real owner approval/payment or email/SMS test performed. Startup confirms Gmail not connected and missing GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET; Twilio missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER; external staging delivery false and both test allowlists empty. Encryption key retained. Do not claim notifications connected or enable delivery to copied real clients. Production/main unchanged.

Public health verified 1.3.93. Secure Render Google sign-in succeeded and its staging Environment page is authenticated, with existing secrets masked. Google Cloud credentials page showed Site Unavailable after one reload. Twilio console access was rejected by automatic approval review because the requested www.twilio.com origin differed from visible console.twilio.com without evidence of an expected authentication redirect. Do not bypass this rejection. Provider configuration and external tests remain incomplete; secure user input is required for missing values and approved test contacts. No environment values were changed in this task.

## v1.3.92 release handoff — Six-character password minimum (staging only)

The required temporary-password replacement form was the remaining twelve-character exception. It now uses six for client validation, HTML constraints and error copy, matching all existing server and other form validations. Existing password hashes and generated temporary credentials are unchanged. Verified Render LIVE 2026-10-16 12:20 UTC: code 5d64182966409f608f156ab07cb171e64a105883, deployment dep-db91bfnavr4c73cmlrq0. All 226 tests, typecheck and build passed locally and on Render. Production/main remain unchanged. No actual owner password changed for testing.

## v1.3.91 release handoff — Owner reset sign-in recovery (staging only)

- Resetting an owner password now clears only that owner’s sign-in and password-change throttles inside the reset transaction, retaining forced rotation and session revocation.
- One-time credential display offers Copy password only separately from Copy full sign-in message, links to the same environment, and explains that later resets invalidate earlier passwords. No existing passwords or hashes are displayed.
- User screenshot showed a rejected Arcila login; full-message paste is a possible cause, not confirmed. No real owner password was collected or reset during development. Owner login requires user verification after a fresh reset.

VERIFIED LIVE 2026-10-16 12:07 UTC: code 6c00cec73304c9c18ae731b44cf1943007e870a3, Render dep-db9158tg1s2s738vf4k0, health 1.3.91. TypeScript, all 226 tests and build passed locally and on Render. Snapshot startup confirms alreadyImported=true, preserving owner resets. No real owner password was obtained or reset; user must perform a fresh staging reset, copy only its password, sign in with its returned owner email, and complete forced rotation. Actual Arcila sign-in remains unverified. Production remains on dep-db8ao7rrjlhs73cvrf3g. Startup now reports Arcila Stripe ready=true; other three copied active businesses remain pending. Documentation updates after LIVE are not new deployments.
