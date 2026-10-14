# SelahFlow Booking App — ChatGPT Project Continuity

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
