**Release source: v1.3.146 — verified LIVE in staging and production.** Primary platform admins can independently enable or disable each business’s two 10% first-purchase commission conditions. Owners can accept terms while keeping both off. All 396 CI/staging tests, typecheck/build and live checks passed. Business terms and Stripe verification remain pending; no live fees activated for QA. See [release evidence](docs/V1_3_146_RELEASE.md).

**v1.3.145 operational status:** Production Stripe commission webhook events are configured and verified Ready. Business verification and owner activation remain pending; no live fees are collecting. Staging administrator authentication remains pending. See [current setup evidence](docs/V1_3_145_RELEASE.md).

**Release source: v1.3.145 — feature LIVE in staging and production; owner activation pending.** Independent 10% first-booking and first-membership Stripe commissions, protected repeat purchases/renewals, refunds and accounting. All 393 tests, typecheck/build and live/browser checks passed. No live fees activated for QA. See [release evidence and setup steps](docs/V1_3_145_RELEASE.md).

**Release source: v1.3.144 — verified LIVE in staging and production.** Shared assistant answers are grouped into expandable subsections with source links and separate membership/booking status. All 379 tests, typecheck/build and live/browser checks passed. See [release evidence](docs/V1_3_144_RELEASE.md).

**Release source: v1.3.143 — verified LIVE in staging and production.** Assistant membership and booking status checks require only the unique client ID, with limited results and masked IDs. All 375 tests, typecheck/build and live/browser checks passed. See [release evidence](docs/V1_3_143_RELEASE.md).

**Release source: v1.3.142 — verified LIVE in staging and production.** The shared assistant reads current published business content, with sources, public-page availability and tenant privacy. All 371 tests/typecheck/build and read-only checks for both live environments passed. See [release evidence](docs/V1_3_142_RELEASE.md).

**Release source: v1.3.141 — verified LIVE in staging and production.** Stripe onboarding validates destinations and provides a browser continuation fallback. Actual staging button reached Stripe-hosted onboarding. First-time live merchant-account creation remains owner acceptance. See [release evidence](docs/V1_3_141_RELEASE.md).

**Release source: v1.3.140 — verified LIVE in staging and production.** Public Privacy Policy page linked from main navigation and footer. See [release notes](docs/V1_3_140_RELEASE.md).

**Release source: v1.3.137 — verified LIVE in staging and production.** White question cards/fields and permanent owner waiver deletion. The reviewed numbered media-release waiver participation-2 is active for Arcila Training in staging and production as of October 23, 2026; each other business retains its own version-specific review requirement. See [release evidence](docs/V1_3_137_RELEASE.md).

**Release source: v1.3.136 — verified LIVE in staging and production.** Add Client accepts the correctly generated initials + MMDDYY ID while preserving uniqueness and rollback safeguards. See [release evidence](docs/V1_3_136_RELEASE.md).

**Release source: v1.3.135 — verified LIVE in staging and production.** Owner-confirmed client email recipients are automatically approved within staging; each recipient has provider receipt evidence. See [release evidence](docs/V1_3_135_RELEASE.md).

**Release source: v1.3.133 — verified LIVE in staging and production.** Owners can edit current client profiles with linked membership/contact and returning-booking synchronization. Communications expose failure reasons and safe retries; the existing staging test email was recovered. See [release evidence](docs/V1_3_133_RELEASE.md).

**Release source: v1.3.132 — verified LIVE in staging and production.** Settings → Client communications syncs client contacts and sends customized emails with saved business branding. See [release evidence](docs/V1_3_132_RELEASE.md).

**Release source: v1.3.131 — verified LIVE in staging and production.** Green, editable owner checkboxes; service approval and question/team defaults honor saved choices. See [release evidence](docs/V1_3_131_RELEASE.md).

**Release source: v1.3.130 — verified LIVE in staging and production.** Business emails use current owner-selected colors and uploaded logo while retaining the shared sender. See [release evidence](docs/V1_3_130_RELEASE.md).

**Release source: v1.3.129 — verified LIVE in staging and production.** Fix bookable session removal, including recurring reschedules and scoped questions, while retaining customer records. See [release evidence](docs/V1_3_129_RELEASE.md).

**Release source: v1.3.128 — verified LIVE in staging and production.** Calendar → Team accountability provides private session/service assignments and an owner list with names, date and time. Removed tracking from Overview. See [release evidence](docs/V1_3_128_RELEASE.md).

**Release source: v1.3.127 — verified LIVE in staging and production; retained in v1.3.128.** Clients → Booking Status shows all incoming bookings across clients, with answers, timelines, payment tracking and filters. See [release evidence](docs/V1_3_127_RELEASE.md).

**Release source: v1.3.126 — verified LIVE in staging and production.** Per-member booking privacy, editable service/session default hosts and private owner tracking. See [owner setup and release evidence](docs/V1_3_126_RELEASE.md).

**Release source: v1.3.125 — verified LIVE in staging and production.** Settings → Questions is the single editor for all standard/custom registration questions, required/notification choices and service/session targeting. See [release evidence](docs/V1_3_125_RELEASE.md).

**Release source: v1.3.124 — verified LIVE in staging and production.** Persistent push configuration, subscription recovery and a private device test. See [push setup and verification](docs/V1_3_124_RELEASE.md).

**Release source: v1.3.123 — verified LIVE in staging and production.** Service booking coupons, client submission/approval emails and dated team accountability. See [release evidence and owner steps](docs/V1_3_123_RELEASE.md).

**Release source: v1.3.122 — verified LIVE in staging and production.** Owner membership payment invitations, monthly credits without rollover, Stripe recurrence controls, coupons, booking approval before payment, client payment timelines, optional media release and private team accountability.

**Release source: v1.3.121 — verified LIVE in staging and production.** Matching checkbox sizes and alignment for booking waiver and appointment-policy consent.

**Release source: v1.3.120 — verified LIVE in staging and production.** Owners can restrict each membership plan’s credits to selected services and session series.

**Release source: v1.3.119 — verified LIVE in staging and production.** White registration-status text and owner-managed waiver removal with retained evidence. New client IDs use initials + MMDDYY; existing IDs remain valid. See continuity for verified deployments; older release notes below are historical.

**Release source: v1.3.118 - Participation waivers.** Optional service waivers with business-only branding, electronic signatures, guardian consent, once-per-client identity storage, and private owner viewing/printing. Verify deployments independently.

**Release source: v1.3.118 — candidate, not yet verified LIVE.** Membership registration and secure checkout now create the same business-unique six-character Unique ID, booking identity and client-directory profile as a first-time booking; returning customers retain their IDs. Memberships remain payment-pending with zero sessions until paid. Owners can add, edit, require and scope custom questions by existing or new service, including mixed-service bookings and recurring sessions. Both environments use the same code but separate databases and provider configurations.

**Release source: v1.3.118 — candidate, not yet verified LIVE.**  direct membership registration and accurate Reports.** New membership registrations require no owner approval; unpaid registrations create pending-payment members with zero session credits and may continue to Stripe Checkout once that business is ready. Existing durable membership payment-confirmation emails are queued only after verified or owner-recorded payment; delivery depends on that environment's connected sender. Booking, scheduled, checked-in, completed, paid, canceled and no-show activity now have explicit Reports metrics, and reconciled Stripe booking receipts prevent missing or duplicate paid revenue. Forecast excludes already-paid and membership-covered appointments. Settings now exposes booking and membership questions, with a Memberships shortcut; the duplicated Booking page content category was removed (Page editor remains). Staging and production share code but NOT customer data, merchant accounts, or credentials. Verify both environments LIVE before declaring deployment.

**Release source: v1.3.118 — staging candidate.** Reports include detail dialogs for every metric, membership payment details and provider outcomes. A typed business-name/phrase confirmation resets all currently reported paid revenue across all dates, preserving financial receipts, source history, membership credits and Stripe idempotency. New payments appear normally. Verified Stripe invoices and owner-recorded membership payments/renewals queue durable plan-specific confirmation emails. Checks/deployment pending; production unchanged.

**Release source: v1.3.118 — VERIFIED LIVE in staging (2026-10-18 12:05:34 UTC).** Full sessions show “Session is now full” and block new bookings, pending requests and checkout. Capacity is refreshed on booking/review screens and rechecked server-side. Clients with an existing confirmed seat retain payment access. All 244 tests, typecheck and build passed locally/on Render. Public health ok / 1.3.107. Commit 4243f27950996ee010d05833923b582b39ffb9c2, deploy dep-dbaba6tg1s2s73bfkvo0. Production unchanged.

**Release source: v1.3.118 — VERIFIED LIVE in staging (2026-10-18 11:55:17 UTC).** All six History columns support ascending/descending sorting across filtered results; owners can select entries across pages and remove them from the activity view while operational records remain. A background reconciler automatically confirms eligible pending requests for currently unchecked services with existing capacity, availability and price safeguards, then queues the client payment link. Verified Stripe payment queues the client receipt. Production unchanged. Commit f794dde23f030696634203d772eaf7e2308b29e0; deploy dep-dbab5dk9v7es73frs3t0. All 244 tests, typecheck and build passed locally/on Render; public health is ok / 1.3.106. Runtime reconciled one pending unchecked request and Gmail accepted its payment-link email. Existing rollout delivery records include one submitted payment-confirmation email; provider acceptance is not proof of inbox delivery.

**Release source: v1.3.118 — VERIFIED LIVE in staging (2026-10-18 11:34:13 UTC).** Commit 17c97a3c5a9dbdfa4a6e3d3c85c8ec97456ede21; deploy dep-dbaarfk9v7es73fqprcg. All 243 tests, typecheck and build passed locally and on Render. Public health returns ok / 1.3.105. No production changes. Service Catalog Require Approval controls booking and immediate payment independently of notification routing. Existing pending requests for unchecked services can confirm atomically when the client clicks Make Payment. Production unchanged.

**Prior release: v1.3.104 — VERIFIED LIVE in staging (2026-10-18 04:00:54 UTC).** Commit 1bde2a4ac59bbc1c29f6338ec35427bdebe5b5cb; Render dep-dba473uq1p3s73a8nk20. All 241 tests, typecheck and build passed. Permanent registration reset and six-character allocation verified. Gmail accepted a booking confirmation and payment-link email for the exact saved test recipient. Guest/archived deletion isolation is included. Payment-confirmation logic passed automated verified-Stripe tests; no new payment was performed for live verification. Production untouched.

**Prior staging release: v1.3.103.**: permanent client deletion, session required/time controls, direct payment emails and labeled email buttons. History clearing affects the activity tab, preserving operational source records. Deployment verification is recorded in docs/CHATGPT_PROJECT_CONTINUITY.md.

# SelahFlow — current production and project continuity

**Release source: v1.3.118 (2026-10-17 UTC), promoted to production.** PR #37 merged tested staging features into main. Production is LIVE at commit 255b934aa848a5b135dfc2ac0438ce6133d32718, Render dep-db9l64rrjlhs73bq2ih0. Homepage, shared business navigation, registration payment controls, Gmail integration and checkout code are deployed; production provider credentials/authorization remain separate. All four active production businesses currently report canPay=false. Paid platform subscriptions and the proposed first-customer fee remain inactive.

**Prior verified staging release: v1.3.102 (2026-10-17 UTC).** Commit fda2dd290095bcc7db220edfdbefbeb1234d270b, Render dep-dba090e1egvs738s9dsg, LIVE 23:31:55 UTC. All 236 tests, typecheck and build passed; migration startup and prospective client email enablement verified. New client transactional emails may use submitted recipients; old jobs need their existing allowlist or an authenticated explicit retry. SMS remains paused. Owner-confirmed legacy ID replacement preserves reservations/history and updates current registration and unreviewed requests. Browser protection blocked the final legacy action; actual personal ID replacement and real email acceptance remain unverified. Production unchanged.

**For all future ChatGPT conversations and software changes, start with [AGENTS.md](AGENTS.md) and [docs/CHATGPT_PROJECT_CONTINUITY.md](docs/CHATGPT_PROJECT_CONTINUITY.md).** Keep plan benefits, session rosters, booking capacity, recurring schedules, client histories, owner settings, admin security and business data intact. Feature changes apply to **all current and future businesses** unless specifically scoped by the user. Each new functional release increments the patch number, and `VERSION` must equal `package.json`.

**What recently shipped:** v1.3.28 made business workspace cards open the correct business homepage; v1.3.29 delivered Free/Professional/Business plan detail cards plus server-enforced subscription entitlements (no active paid platform subscription checkout); v1.3.30 delivered clickable owner calendar sessions with private enrolled-client rosters. See `AGENTS.md` for more history and current limitations.

---

# SelahFlow Studio v1.3.12 — Platform administrator access hotfix

The primary platform administrator (`pbraza@gmail.com`) is automatically directed to `/admin/platform` after login, even when they also own Crawford. Non-administrator accounts requesting `/admin/platform` are directed to an informative `/admin/access-denied` page with an account-switch action instead of an unexplained Next.js 404. Logged-out users are sent to `/login?next=%2Fadmin%2Fplatform`.

The original platform_admins server-side permission checks remain intact. This is a routing/UX fix only and preserves all data, service and Web Push features introduced in v1.3.11.

# SelahFlow Studio 1.3.11 — Business-specific Web Push

Owners and designated team reviewers can enable native device/browser notifications using their own device in the business's secure dashboard. When a customer requests approval, SelahFlow delivers a Web Push message to the currently authorized reviewers for that business. Tapping opens the review UI but does **not** accept a booking. In-app bells display unread and pending requests, with separate read receipts for each reviewer. iPhone (iOS/iPadOS 16.4+) requires Safari → Share → Add to Home Screen, then permission from the installed Home Screen app. Android and modern desktop browsers can enable notifications normally.

**Technology:** RFC 8291 aes128gcm Web Push, VAPID JWT ES256 generated and encrypted with Node built-ins (no new package dependencies). Service worker at /sw.js, PWA manifest, per-business and per-reviewer PostgreSQL subscriptions, cached/read state on server only (no browser persistence of customer histories). Token-authenticated designated team reviewers register their own devices; revoked team links or reviewer changes prevent further pushes.

**Render secret setup:** `VAPID_PUBLIC_KEY` (base64url uncompressed EC P-256 point), `VAPID_PRIVATE_KEY` (base64url 32-byte scalar), and `VAPID_SUBJECT` (contact URI, e.g., `mailto:pbraza@gmail.com`). Keys must be generated as a matched pair and retained across deployments. Email and SMS remain independent. See docs/RELEASE_v1.3.11_WEB_PUSH.md.

# SelahFlow v1.3.10 — Email and SMS Booking Review Links

Select **Dashboard → Settings → Booking requests and reviewer notifications**. Enable booking approval, choose Business owner or a team reviewer, and tick **Send by email**, **Send by SMS**, or both. For the owner, enter a notification phone in E.164 format and optionally override the signed-in email. For team members, enter their email and phone under **Your team**, then save. A new customer booking creates a pending request and sends its details and a 72-hour review link to the designated recipient using connected providers. Click **Accept** or **Decline** on the linked page to make a decision.

**Production provider setup is mandatory for external delivery.** Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (verified sender), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` in the Render service environment. Without these secrets, channels show **Not configured**, and no email/text messages are sent; in-app notifications continue working. Providers may require sender verification and compliant SMS registrations. A submitted message means the provider accepted the request, not that the recipient's device delivered it.

See `docs/RELEASE_v1.3.10_OUTBOUND_APPROVALS.md`.

# SelahFlow v1.3.9 — Appointment review notifications

The business owner can enable booking approvals in Dashboard → Settings, designate themselves or a team member reviewer, and set simultaneous booking slot limits for every service. Incoming requests appear in the dashboard while it is open; an authorized staff reviewer may receive a private 30-day link for the dedicated review inbox. Pending online requests do **not** reserve times, appear as confirmed appointments, or collect payment. After acceptance, appointment and staff calendar slots are saved transactionally after conflict checks. A decline creates no calendar booking.

The business registration dropdown is now alphabetized by category label.

See docs/RELEASE_v1.3.9_BOOKING_APPROVALS.md for complete behavior and safeguards.

# SelahFlow Studio v1.3.8 — Business marketplace and administrator directory

All **approved, active** businesses are discoverable at `/discover`. Database migration 006 publishes previously unlisted active businesses; businesses still pending registration, declined or suspended remain private.

The authenticated platform dashboard at `/admin/platform` now includes clickable business cards for **all accounts**, with a protected drilldown into owner information, business type, service catalogs, staff and customer booking history. Details are never returned to anonymous visitors or ordinary business owners. The main "Businesses" and "Listed businesses" metric cards link to the directory.

Businesses with no long-term service catalog or historical term enrollments have **no term-service tracking panel**. The platform's aggregated term-service section also disappears when there are no recorded term enrollments.

See `docs/RELEASE_v1.3.8_MARKETPLACE_ADMIN.md` for verification steps and scope.

# SelahFlow Studio v1.3.7 — All business registrations require approval

The **primary administrator** approves every new application in /admin/platform. New signups are `pending` and redirected to /registration-status. They cannot use private studio APIs or public booking until approved. Approval atomically makes the business `active` and `is_listed=true` so it appears in /discover automatically.

Signup supports broad service-industry categories plus 50-state dropdowns (and DC). Owner Settings supports minute/hour appointment service durations and separately tracked day/week/month/year services. Monthly and annual service enrollments, their start/renewal dates and statuses are visible to business owners and as aggregated counts to platform administrators. Term-service tracking is manual; Stripe recurring charges are still not active.

Full rollout and architecture: docs/RELEASE_v1.3.7_APPROVAL_AND_TERMS.md

# SelahFlow v1.3.6 — Business-wide themes and addresses

**Current release: 1.3.6.** Independent saved business themes apply to all owner dashboard views, dialogs, business profile, public business homepage, and booking screens. No changes to platform administration or shared SelahFlow branding.

Owners can type a business street address in **Dashboard → Settings** or **Business Profile**. Suggestions come from OpenStreetMap Photon with a 650ms client debounce, server-side per-owner throttling, an upstream limit, a ten-minute cache, explicit attribution, and manual-entry fallback. Public location displays include **Google Maps Directions** links (no Google API key required). Coordinates are not stored; the selected address, city and region remain in existing owner/business settings.

**Capacity note:** `photon.komoot.io` is a public demo best suited to development and light usage. It has no uptime or high-volume guarantee; use a hosted or self-managed geocoding provider for commercial scale. See docs/RELEASE_v1.3.6_BUSINESS_THEMES_ADDRESSES.md.

# SelahFlow Studio v1.3.5 — Full theme personalization

Owners can choose 20 presets and edit 19 HEX color roles or use a fully custom palette, plus select separate heading and body fonts from 12 options. Changes publish to the business's own public page, booking flow and owner dashboard without affecting the SelahFlow platform or other businesses. Accessible text colors are computed automatically. No migration or data reset. See docs/RELEASE_v1.3.5_THEMES.md.

# SelahFlow v1.3.4 — Password Minimum of Six Characters

This maintenance patch aligns password creation, change, administrator invitation, login and startup at a minimum of six characters. Existing v1.3.3 features and all account/business data remain untouched. Use long, unique passwords for stronger security.

# SelahFlow v1.3.3 — Owner Controls

New business-specific colors, logo uploads, descriptions, service catalog + team editors, server-enforced team subscription caps, self-service password changes, and primary administrator invitations. The original Crawford data remains intact. The primary administrator email is pbraza@gmail.com; passwords are not embedded in source, and new passwords must be at least 6 characters. Paid subscription activation is not implemented.

See [v1.3.3 guide](docs/RELEASE_v1.3.3_OWNER_CONTROLS.md).

# SelahFlow Studio v1.3.2 — Platform and per-business routing

Main platform: https://salonflow-hf3w.onrender.com/
Crawford public business page: /crawford
Crawford private dashboard: /studio/crawford
Crawford booking: /book/crawford
Business dashboard: /studio/{slug}
Customer booking: /book/{slug}
Crawford database records and existing SQL migrations remain unchanged.

# SelahFlow Studio — Version 1.3.1 Branding Update

v1.3.1 applies the Pause & Flow identity to the existing v1.3 platform. See [branding release and validation](docs/BRANDING_UPDATE_v1.3.1.md). Functional scope and the approved v1.3 roadmap remain unchanged.

SelahFlow is expanding from the original single-studio product into a multi-business booking platform. Version 1.3 is a development branch with registration, business booking slugs, marketplace directory moderation, owner business profiles and platform administrator summary counts. **It has not been verified or deployed to your Render production environment.**

**Important:** v1.3 does not process Stripe payments, bill paid subscriptions, collect marketplace referral commissions, send SMS, or run generative AI/voice. The published /pricing figures are a proposed business model, not live payment plans. See [v1.3 roadmap](docs/RELEASE_v1.3_ROADMAP.md). Do not publicly launch registration without email verification and security review.

Existing production v1.2 instructions and original /book booking flow are retained below for compatibility, but any statement below describing the app as exclusively single-business refers to the earlier v1.2 scope.


A standalone hair salon and barbershop management app for your own GitHub repository and Render account.

**No ChatGPT integration, ChatGPT login, Sites hosting, OpenAI API key or AI-provider dependency is required.** This ZIP is the source project. It has not been uploaded to your GitHub account or deployed to your Render account.

Start with [DEPLOY_RENDER.md](DEPLOY_RENDER.md).

## Included
- Public `/book` page with live availability, server-confirmed bookings and confirmation printing.
- Charcoal/navy/steel-blue theme and a dashboard button to copy the customer link.
- Owner email/password login, password hashing, 12-hour server-side sessions, logout and database-backed login throttling.
- Multi-service appointment creation, staff qualification matching, server-checked available times and cleanup buffers.
- PostgreSQL transactions and a unique owner/date/staff/minute reservation constraint to reject overlaps.
- Calendar, client directory, check-in, completion, cancellation and appointment CSV exports.
- Editable salon name, contact information, service prices/durations, staff names, hours and cancellation policy.
- Manual cash-sale recording with service/retail revenue reporting; appointment values remain separate from paid revenue.
- Deterministic guided FAQ assistant using configured services, hours and policy, with saved human-handoff requests.
- Clearly labeled sample appointments; samples are never saved as actual bookings or financial transactions.

## Current scope
This is a single-owner, single-business first release. Customers can book at `/book` without logging in. The owner dashboard remains protected. There are no customer accounts or customer self-service cancellation/rescheduling yet. The receptionist is a guided FAQ assistant, not generative AI. Additional production features from the master prompt remain unimplemented: customer/staff accounts and roles, staff breaks/holidays/time off, rescheduling, resource/chair capacity, checkout holds, provider payments/deposits/refunds, SMS/email reminders, true AI/voice, inventory ledger, packages, memberships, gift cards, full expenses/profit accounting, and multi-location/tenant onboarding. Do not represent those as active features.

Hours apply every day in America/New_York; configure daytime hours only. Booking durations and buffers use 15-minute increments. Existing bookings keep their original quoted price and reserved buffer. A settings change that alters a price/duration while booking is open rejects stale confirmation and asks for review.

Cash checkout uses the current catalog and a single configured tax rate. Product unit cost is snapshotted when a sale is recorded. Inventory is not decremented. Completed appointments are not automatically marked paid. The booked-time ratio uses opening hours, not fully adjusted staff utilization. Gross/net profit are intentionally unavailable until all required costs are recorded.

## Stack
Next.js + React + TypeScript, Node.js, PostgreSQL (`pg`). Standard npm commands; no proprietary hosting adapter. Keep PostgreSQL data outside the web service filesystem so deployments do not erase records.

## Local development
1. Install Node 22.22 or another supported Node 22/24 release and PostgreSQL 17+.
2. Copy `.env.example` to `.env.local`.
3. Set a local `DATABASE_URL`, your `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` of at least 6 characters.
4. Run `npm ci`.
5. Run `npm run db:migrate`.
6. Run `npm run dev` and open `http://localhost:3000`.
7. Sign in with your configured credentials.

The database migration requires PostgreSQL, not SQLite. Startup migrations are versioned and protected by a PostgreSQL advisory lock. Changing ADMIN_EMAIL or ADMIN_PASSWORD and restarting updates the same owner account and invalidates existing sessions; appointments remain attached to the same owner ID. There is no email password-reset provider.

## Commands
- `npm run dev` — local development
- `npm run typecheck` — TypeScript validation
- `npm test` — schema, transaction, password/session helper and origin tests
- `npm run build` — production Next.js build
- `npm start` — migrate database, provision owner, start on PORT (default 3000)
- `npm run db:migrate` — apply pending migrations and provision/update owner

## Data and access
Every owner studio API action requires a valid session. The separate public `/api/booking` endpoint permits only catalog retrieval, availability lookup and new booking creation. It never returns client records, owner email, sales, costs or internal events. Public booking adds database rate limits and a hidden anti-bot field; it does not include CAPTCHA or email identity verification. User IDs come from server-side sessions, never browser identity headers. The owner page redirects to login when unauthenticated; API data is not returned to anonymous callers. State-changing endpoints require same-origin requests. Passwords use salted scrypt, and the database stores only hashes of random session tokens. Production cookies are Secure and HttpOnly. Use HTTPS in production. No third-party payment credentials are collected.

Database access is internal-only in render.yaml (`ipAllowList: []`). Configure backup/restore retention in your Render database before using real customer records. Never commit `.env.local`, credentials, database dumps, `node_modules`, or `.next`.

## Release numbering
This is **version 1.3.1**, the branding and favicon patch for the v1.3 platform. The planned v1.4 feature milestone has not been released. See CHANGELOG.md. Replace source files in the existing repository when upgrading; preserve the Render database and apply additive migrations. Do not restore an older source version across incompatible migrations without a migration plan.

## Acceptance checks after deployment
Sign in, create a test appointment, refresh and confirm it persists; open a second browser session and confirm the same slot cannot be double-booked; cancel it and confirm capacity is released. Record a test cash sale only if clearly kept separate from real business records. Sign out and verify `/api/studio` returns 401. Verify the custom domain origin after setting APP_URL. Complete these checks in your actual Render account before opening operations.

## Sharing the booking link
Deploy this release to the existing Render web service. Use **Copy customer link** in the sidebar or open your normal app URL with `/book` appended. Example only: `https://YOUR-SERVICE.onrender.com/book`. Do not share the owner login credentials. The owner appointment list refreshes every 30 seconds while outside Settings, or immediately on page refresh.
