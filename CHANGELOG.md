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
