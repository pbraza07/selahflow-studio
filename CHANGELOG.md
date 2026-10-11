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
