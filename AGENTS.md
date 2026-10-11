# SelahFlow — continuity and operating rules for all future changes

> This file provides long-running project context for coding assistants and ChatGPT handoffs. It is **not** an authoritative live deployment indicator. Always verify production before declaring a version or deployment status.

## Identity and production source of truth

- Product: **SelahFlow** — *Pause & Flow*, a multi-tenant booking, appointment/calendar, and business-management platform for many service industries. Preserve the approved branding and existing functionality.
- Production source: **pbraza07/selahflow-studio**, branch **main**.
- Render service: **selahflow-studio**, service ID `srv-db3tokqd0e5s73f31hfg`, workspace ID `tea-da643qgu01pc73951gdg`.
- Current Render production URL: **https://salonflow-hf3w.onrender.com**. Do not rename or replace it unless explicitly requested. `selahflow-studio` is the service name even though the URL retains an older slug.
- Version authority: inspect (1) **latest LIVE Render deploy and its commit SHA**, and (2) `package.json` on GitHub `main`. Report discrepancies. The `VERSION` marker must match `package.json`; older README/changelog text may not.
- Snapshot verified **2026-10-11**: **v1.3.30 LIVE**, Render deploy `dep-db5eurou01pc73ek74qg`, GitHub `main` commit `0fa66cc10e38569e6b6cf6736de1cb152dfaa6a1`. **Check again each new conversation**, never assume the snapshot is still current.
- For new functional releases increment the patch version sequentially (after 1.3.30, **1.3.31**), consistently update `package.json`, `package-lock.json`, `VERSION`, release-visible version copy and release notes. Do not jump to 1.4 without user approval.
- Keep a distinction between **implemented on a feature branch**, **merged**, **Render deployment in progress**, **Render LIVE**, and **manually tested**. Never claim deployment success without a verified live Render status.

## User's platform-wide default

- **Unless explicitly scoped to one business, apply every new feature and UI fix to all existing and future businesses**. One business (such as Arcila Training or Crawford Studio) is a test/example, never the default tenant.
- Keep every business's settings, services, customers, attendance, passwords, notification settings, booking questions, memberships, branding/theme, calendar, seat capacity, staff permissions, and financial records isolated by authenticated owner/business ID.
- Preserve all historical records. Business removal must be **non-destructive archive**, with restoration of the original workspace/business/owner IDs.
- All owner/admin feature grants and permissions must be enforced **server-side** against database records; not by hiding controls alone. Only platform admins can change plan entitlements and review ad hoc team seats.
- Maintain usable layouts for iPhone/mobile and desktop, using each business's chosen palette, consistent smaller Settings typography, usable touch targets and accessible controls. Avoid hardcoded salon-specific language and icons.
- Never expose existing passwords or password hashes. Admin password recovery uses a one-time temporary password, forced rotation and session revocation.

## Features that were already shipped before the verified v1.3.30 snapshot

- Multi-business registration/approval, marketplace discovery, private dashboards, customer booking, service catalog, team members and business profiles.
- Business-scoped push notifications, booking approval/decline review, per-business notification fields, owner-editable booking details and per-business themes/logos.
- Customer daily/weekly/monthly calendar views; owner calendar and bookable sessions with independent group capacity and visible slots remaining; 15-minute Eastern time appointment increments (subject to existing availability rules).
- Recurring daily/weekly/monthly sessions, interval and end date, stable occurrence IDs, atomic capacity checks.
- Owners can reschedule booked single/recurring occurrences to new date, time, service or coach without losing confirmed attendees, pending requests or historical answers; transferring coach **preserves capacity and remaining slots unless intentionally edited**.
- Client directory, attendance/service history, Excel export, edit/add/remove client functions, returning-customer name assistance.
- Customer membership signup offers and Stripe Connect scaffolding; payment activation is contingent on actual Stripe setup. Business Google listing link and Google Places photo carousel require valid Google Places configuration.
- Platform administrator business create/edit/archive/restore, owner login email change, secure owner password reset, business-specific ad hoc extra staff seat approvals.
- **v1.3.28:** sidebar business workspace tile links to its own public homepage.
- **v1.3.29:** SelahFlow home page plan cards replace Crawford-only promotion; Free/Professional/Business plan limits enforced on the server and manually assignable by authorized admin. **Paid subscription checkout is not yet connected; proposed paid prices are not active charges.**
- **v1.3.30:** owners can select sessions on daily/weekly/monthly calendars to view registered clients and their details in a private session roster. This was deployed in the LIVE commit listed above.

## Key remaining qualifications

- Do not represent automatic recurring **platform** subscription billing, generative AI receptionist, provider-backed SMS/voice, or payment collection as working unless separately verified. Planned features and UI are not proof of configured third-party integrations.
- Public pricing is proposed. A platform admin may manually assign plan entitlements with audit trail, **without collecting payment**.
- Google Places/Stripe/Resend/Twilio/Web Push require proper configuration, permissions and backend enablement; never invent their live operational state.
- An open/old PR is **not** a deployed feature. For example PR **#34** was still open at the snapshot even though a separate v1.3.30 commit had already shipped calendar rosters; review its diff and merge status before reuse and **do not merge a stale branch over production**.
- Obsolete historical docs include old release examples; this file and `docs/CHATGPT_PROJECT_CONTINUITY.md` are the up-to-date handoff entry points, but actual production verification always wins.

## New-conversation workflow

1. Read this file and `docs/CHATGPT_PROJECT_CONTINUITY.md`. Check the last relevant user request and recent deployment status.
2. Check Render LIVE deploy, `package.json` on `main`, any open PRs/branches and actual source code before announcing version or planning new work.
3. Classify each requested item as **already LIVE**, **partially implemented**, **not implemented**, or **unknown/needs live verification**. Never assume a past assistant claim alone proves deployment.
4. Design changes once in shared tenant-aware components, APIs and server validations; preserve existing business data/migrations and revenue logic.
5. Implement in a feature branch, write regression tests, run `npm run typecheck`, `npm test`, `npm run build`. Correct failures; avoid declaring success on failing CI.
6. Merge after checks, confirm Render **LIVE** for the exact commit, inspect migration/startup logs where needed; report deployment ID and manual test limitations.
7. Update version markers and handoff summary with a short factual note of what shipped or remains pending. Do not put API keys, credentials, customer data or sensitive secrets into project documentation.

## Useful routes and code

- Owner dashboard: `/studio/{businessSlug}`.
- Business public home: `/{businessSlug}`.
- Public booking: `/book/{businessSlug}`.
- Platform admin: `/admin/platform`.
- Core: `app/studio/owner-dashboard.tsx`, `lib/studio-handler.ts`, `server/session-scheduling.mjs`, `server/session-recurrence.mjs`, `server/safe-session-reschedule.mjs`, `server/plan-entitlements.mjs`, `app/components/`, `migrations/`, `tests/`.
- The independent **ArcilaTrainingBooking** repository/service is **not** SelahFlow production; do not modify it unless specifically asked.
