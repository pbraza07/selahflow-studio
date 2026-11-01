# v1.3.200 release handoff — Assigned team and owner booking approvals

Every signed-in team member can review pending bookings assigned to their own staff ID in Workspace → Bookings & approvals, even when approval notifications are disabled or routed elsewhere. Owners retain every pending request on their dashboard. Service-level Require approval continues to decide which new bookings need review; existing confirmed appointments are preserved. Settings now distinguish notification routing from approval permissions. Legacy bearer review links keep their explicitly delegated scope and current-setting/revocation checks.

Workspace GET, approve/decline and customer-detail editing are scoped to the authenticated team account, active business and current primary booking assignment. Account disable/password rotation, tenant/peer isolation, saved prices, waivers, capacity and payment-after-approval protections remain enforced. Calendar approval revalidates pending status, assignment and the reviewed snapshot inside the transaction, with current team access checked and locked; the first owner/team decision wins. Declines conditionally recheck staff/account authorization. Original submission/edit audit and reviewer identity remain retained. No migration or business setting change is required.

Local/GitHub validation and production rollout pending. No real client request is created, edited, approved or declined, and no payment or outgoing message is generated for QA. Staging remains suspended by Render billing and is not changed.

# v1.3.199 verified LIVE — Onsite cash and owner-selected commission collection dates

PR #131 merged as fb7258bc4a67cd9581ea2d4cdfce31ae470f6bd8. Production deploy dep-dbj8psp5efls73dpqcf0 is LIVE at 2026-11-01T00:52:57.618793Z. Migration 082_cash_collection_schedule.sql applied at 00:52:42.761152487Z. Final source 35a299fa00b3c4f72ee8f65a9ad30d547eee245e / tree 86d653a1a621b6b772d69aae8c0b10652f56ed13 passed all 589 GitHub tests, TypeScript, production build and native checks (workflow 41257952730; web 124705033817; native 124705033715). Local full regression passed 587 tests before the final two standalone UI tests; the final 12-test rendering/interaction group, affected cash/API tests, TypeScript and production build passed. Initial fixture identity and old component-harness failures were corrected before final checks.

Production versioned smoke passed for health 1.3.199, public booking/payment shells, protected APIs and invalid-invitation/no-store behavior. New team cash GET and owner commission GET reject anonymous access with 401/no-store. Team booking/membership cash, owner appointment/membership cash and owner schedule POSTs reject anonymous requests with 401 and foreign origins with 403. Migration succeeded and no error-level startup entries were returned in the checked rollout window. Signed-in owner/team visual acceptance, real cash confirmation, owner card/date authorization, invoice/card collection and physical-device acceptance were not exercised. No real customer/payment/consent or outgoing message was created for QA.

Owner controls: appointment → Pay on Site → Pay cash; Memberships → pending offline member → Pay cash. Team controls: My clients → select an assigned visit → onsite cash payment / pending offline membership for that client. Payment setup shows the separate service/membership cash commission balances and itemized statements. Automatic collection requires the actual owner's signed card-storage/billing authorization and verified card. Collection-date changes require a separate explicit owner agreement; month end means after the calendar month closes, or day 1–31 of the following month (shorter months clamp). Prepared statements/retries retain their schedule. No business was enrolled or retrospectively charged by the migration.

Staging is confirmed suspended by Render billing, autoDeploy off; it was not resumed or claimed updated. This verification supersedes pending v1.3.199 notes below. Documentation-only commits may follow the deployed application SHA without rebuilding.

# v1.3.199 release handoff — Confirm onsite cash and select commission collection date

Owners can confirm cash from Pay on Site and pending offline memberships; team members can confirm received cash for assigned appointments and initial offline memberships of their assigned clients. Saved amounts, business/assignment scope, approval/waiver checks and paid/active-card safeguards are enforced on the server. Confirmers are retained in payment events. Cash recording atomically adds any eligible first-service or first-membership commission to the existing separate ledger; repeats, renewals and membership-covered bookings retain existing exclusions. No card is charged when recording cash.

Payment setup shows recent unbilled cash items and itemized monthly statements, with a Pay outstanding balance action on failed/open invoices. After signing the existing card authorization and verifying a billing card, the actual owner can separately agree to month-end collection (from the first day after the month closes) or day 1–31 of the following month; shorter months clamp to the last day. New statements freeze their collection date; existing prepared statements and retries retain their schedule. Schedule changes have a durable owner authorization snapshot. Calendar periods and due dates use America/New_York. Migration 082 is additive and preserves existing first-of-next-month collection; no existing business is enrolled or charged by migration.

Local/GitHub validation and production rollout pending. No real payment, owner consent, client record or outgoing message is created for QA. Staging remains suspended by Render billing and is not changed.

# v1.3.198 verified LIVE — Onsite payment actions

PR #130 merged as 02940bc0d2b1f6c42f66b169fcc70b25f7c48ec9. Production deploy dep-dbj8dprm8hqs73fifskg is LIVE (2026-11-01T00:27:10.739512Z). Final source 0440db826878dc726c11c5d26c5e98d425832398 passed all 582 tests, TypeScript, production build and native checks (workflow 41256129550; web 124699561446; native 124699561262). Local full tests/type/build also passed. The final test-only Web Push fixture pads an ECDH scalar to its required 32-byte width to remove a random fixture failure; production push validation is unchanged. No migration.

Production versioned smoke checks passed for health (1.3.198), public booking/payment shells, protected APIs and invalid-invitation/no-store behavior. Onsite API anonymous GET and check/checkout/cancel writes reject with 401; foreign-origin checkout rejects with 403. Live /onsite/setup browser verification confirms the browser-card instructions and signed-app prerequisites. No startup errors were returned in the checked deploy window. Anonymous owner-page bundle probing redirects to login by design; signed-in owner UI, actual card collection, physical-phone installation and NFC acceptance were not exercised. No real customer checkout, charge, record, consent or outgoing message was created for QA.

Owners now use Pay on Site → Pay by card in browser for secure Stripe Checkout. Check payment shows busy feedback, a checked time and actionable Checkout/Terminal/cash status. The native app link is explicitly limited to a signed installed phone app; native distribution/device activation remains pending. Staging remains suspended by Render billing and was not changed. This verification supersedes pending v1.3.198 notes below. Documentation-only commits may follow the deployed application SHA without rebuilding.

# v1.3.198 release handoff — Working onsite payment actions and browser card checkout

Fixes the no-action onsite modal: Open SelahFlow Pay was an installed-phone-only URL while the native app has not been distributed; Check payment reported not_started without explaining that no collection existed. Owners can now choose Pay by card in browser to open secure Stripe Checkout for the saved approved appointment, including onsite-only services. The client completes card-not-present checkout; browser NFC / Tap to Pay is not claimed. Native phone launching remains available under explicit installed-app requirements, with desktop/failure guidance. No native signing, distribution or device activation is performed.

The shared Checkout core retains authoritative owner/tenant scope, saved amount, service payment policy, approval/waiver checks, first-customer commissions, open-checkout reuse, processing-payment exclusion and verified receipts. The public entry point still requires a private token and cannot accept an injected owner flag. Browser collection requires an authenticated owner and valid origin. Check payment now checks both Checkout and Terminal, recognizes previously recorded cash, displays progress and a checked time, and reports actionable unpaid/processing/expired states. Only verified unpaid checkout expiry allows subsequent cash settlement; cancelled Terminal and current financial history stay retained. No card charge is created merely by Check payment.

Focused database/API/component tests pass. Full local validation, final GitHub checks and production rollout are pending. No migration is needed; the v1.3.197 monthly cash commission features are preserved. Staging remains suspended by Render billing. No real customer checkout, payment, client record or outgoing message is generated for QA. Physical-phone installation and NFC acceptance remain separate prerequisites.

Release source: v1.3.200.

# v1.3.197 verified LIVE in production — Monthly cash commission billing and concise benefits

PR #128 delivered monthly cash commission billing (merge b2e61092757be5d22d9fdd51be4920fdf524de07); PR #129 finalized description wrapping and recovery after interrupted local verification writes (merge 33d7d4c5ca5a66be927cd9327941a56308ce1524). Production deploy dep-dbj7mhdg1s2s73fn3jq0 is LIVE at 2026-10-31T23:37:14.741321Z. All 572 final-head tests, TypeScript, production build and native checks passed on a48dcbf8ed62c2ff7003d9b7e75844e75cf7c589 (web 124689354673, native 124689354503). Local targeted billing, real membership route, fault-injection, benefits rendering, type and build checks also passed. Migration 081 applied on production at 23:21:41.453975668Z during v1.3.196; v1.3.197 adds no migration.

Production versioned health, public booking/payment shells, protected owner APIs and invalid-invitation/no-store checks passed. The commission billing endpoint rejects anonymous reads (401/no-store) and foreign-origin setup writes (403). Business benefits and pricing each render 19 expandable benefits and 57 inclusion checkboxes. Live desktop browser verified payment-benefit expansion, green checkboxes and corrected wrapping: at a 1363px viewport, the document is 1348px wide; the description is 650px wide with scrollWidth 650px and 88px height. An initial native-summary locator mismatch was resolved with the visible text control. Physical-phone and signed-in owner billing visual acceptance were not exercised. No error-level startup entries or cash commission worker warnings were returned in the checked final startup window.

Billing is implemented and opt-in, not automatically enabled for existing businesses. Owners must use Business settings → Payment setup → Monthly cash commission billing (or /settings/commissions), read/sign the explicit card-storage and monthly collection authorization, and complete Stripe setup; existing administrator commission conditions still control eligibility. Automatic Stripe reminders/retry emails depend on Stripe settings. No real card authorization, provider invoice collection, charge, owner consent, customer booking or outgoing email was created for QA; live financial collection is not claimed tested. Test-provider and database fixtures cover the financial flow, failed balances, once-per-identity/type rules, tenant isolation and recovery. Cash recording must identify the client; linked appointment settlement also checks the booking identity/amount. No retrospective cash-record sweep is performed.

Staging remains suspended by Render billing and was not resumed, reconfigured or claimed updated. Production verification supersedes earlier v1.3.196/v1.3.197 pending notes below. Documentation-only commits may follow the deployed application SHA without a rebuild.

# v1.3.197 release handoff — Benefits explanation wrapping

Corrects the global table nowrap rule so expanded benefit explanations wrap within the benefit column instead of clipping across plan columns. Includes the monthly cash billing and comparison-table features from v1.3.196. Also makes Stripe verification recover safely from an interrupted local card-activation or paid-statement write. Fee calculations, schema, prices and limits are unchanged. Local build, final GitHub checks and live visual acceptance are pending; v1.3.196 is deployed in production and migration 081 applied successfully. The previous live check caught this clipping before final handoff. Staging remains suspended by Render billing. No real owner authorization, invoice or payment is created for QA.

Release source: v1.3.197.

# v1.3.196 release handoff — Monthly cash commission billing and concise benefit tables

Release source: v1.3.196.

Adds opt-in monthly automatic billing for eligible cash booking and manually confirmed offline initial membership commissions. Preserves the existing 10% or $5 minimum fee, first-booking / first-membership separation, legacy-client exclusions, and administrator activation. The owner must sign a separate versioned authorization and verify a billing card in Stripe Checkout; merchant connection or package subscription is never treated as cash-billing consent. Support administrators cannot sign for owners. No business is automatically enrolled or retrospectively charged.

A durable monthly ledger and invoices provide itemized owner statements, payment-failure status and a Pay outstanding balance link to the same verified Stripe invoice. Calendar months use America/New_York; a five-minute worker catches up after downtime. Invoice totals, ownership and provider payment states are verified; idempotent provider keys and frozen statements protect retry paths. Balances below $0.50 carry forward. Stripe invoice automatic collection/retries apply after finalization. Cash service sales under enabled conditions require a verified client ID; appointment payments also support linked booking settlement; retail and taxes are excluded. Offline initial membership payments accrue before credits activate; renewals do not create another commission. Accounting survives operational client deletion.

Business benefits and pricing now use a concise comparison table with read-only inclusion checkboxes, real plan limits and individual expandable explanations, including payment integration across bookings, services and memberships. Existing package prices and limits are unchanged.

Migration 081 is additive and opt-in; existing card commissions retain their collection method. Local validation, final GitHub checks and production rollout are in progress. Staging runtime deployment remains blocked by Render billing suspension. Real card authorization, charges and outgoing invoices are not generated for QA; these require an actual owner agreement. Billing UI: Business settings → Payment setup, or /settings/commissions. Platform invoice events reuse /api/platform-billing/webhook and STRIPE_PLATFORM_WEBHOOK_SECRET; worker polling also reconciles saved setup sessions and invoices. Automatic Stripe reminder/retry email settings remain controlled in Stripe.

## Release source: v1.3.195 — Concise booking client ID instructions

Deployment verification pending. The booking client ID box uses two short instructions and omits ID-generation details.

## Release source: v1.3.194 — Clickable marketplace business logos

Verified LIVE on staging and production. Marketplace logos open their business landing pages, including image fallbacks. All 560 tests, TypeScript, builds, GitHub checks, live endpoint checks and actual staging/production logo clicks passed. See AGENTS.md for deployment evidence and testing limits.

## Release source: v1.3.193 — Marketplace-backed customer category buttons

Verified LIVE on staging and production. All 560 local/staging tests, TypeScript, builds, GitHub checks, category API checks and public browser verification passed. See AGENTS.md for exact deployment evidence and testing limits. Customer category buttons show only categories represented by current marketplace businesses.

## Release source: v1.3.192 — Membership offers before Google reviews

Verified LIVE on staging and production. All 558 local/staging tests, TypeScript, builds, GitHub checks, live endpoint checks and public membership ordering inspection passed. See AGENTS.md for exact deployment evidence and third-party/phone testing limits. Customer membership offers and registration always precede the business Google gallery/reviews on desktop and phones.

## Release source: v1.3.191 — Organized platform administrator workspace

Verified LIVE on staging and production. All 558 local/staging tests, TypeScript, final builds, GitHub and live endpoint checks passed. See AGENTS.md for deployment evidence and authenticated-browser limits. Clear sections, task-focused overview, desktop sidebar and phone section selector preserve all existing administrator tools and permissions.

## Release source: v1.3.190 — Package payment fix, team sharing and workspace approvals

Verified LIVE on staging and production. All 553 final local/staging tests, TypeScript, builds, GitHub and endpoint checks passed; see AGENTS.md for exact evidence and live-testing limits. Package checkout explicitly uses standard Stripe Billing to avoid the account-default Managed Payments tax-code error. Public profiles gain a top Share page button; private workspaces gain an in-page booking review panel under the welcome area. Reviewer permissions remain controlled by the business owner.

## Release source: v1.3.189 — Account choices and modern business agreements

Verified LIVE on staging and production. Google/Google Workspace or email/password → business details → read and sign agreement → separate Make payment. Selected package price/benefits are displayed; paid access still requires verified payment and primary approval. All 549 tests, TypeScript, builds, GitHub checks and live endpoint checks passed. See AGENTS.md for deployment evidence and real-account/payment testing limitations.

## Release source: v1.3.188 — Owner usability and responsive layout

Verified LIVE on staging and production. All 538 final local and staging tests, TypeScript, builds, GitHub checks and live endpoint checks passed. See AGENTS.md for exact deployment evidence and browser-testing limitations.

## Release source: v1.3.187 — Owner session-full checkbox

Deployment verification pending.

## Release source: v1.3.186 — verification pending

Paid business onboarding now enforces signed agreement → Stripe-hosted package payment → primary approval → functional business page and owner dashboard. Free onboarding requires the signed agreement and approval without a card. Provider-verified paid invoices, not redirect URLs, control paid readiness.

Assigned team members also receive a private workspace bell confirmation for each appointment on their own calendar, with client/service/date/time details and per-member read state.

## Release source: v1.3.185 — verified LIVE

Team profile name URLs and circular crop controls, team onsite-only confirmations, ten-year recurrence, header sharing, signed registration agreements and Stripe package subscriptions. All 527 final local, GitHub and staging tests passed. Production deployment dep-dbiesjnavr4c73blpq3g is LIVE; see AGENTS.md for verified deployment details and remaining native distribution/legal/tax setup limits.

## Release source: v1.3.184

Clients without a birth date receive initials plus a business-specific sequence starting at 1001. Birth-date-based and existing IDs remain supported; booking, membership and owner client creation share the allocator.

## Release source: v1.3.178

Business settings → Important URLs provides current business navigation links with Open and Copy controls.

## Release source: v1.3.177

Email-only team sign-in, temporary password 123456 with mandatory replacement, and owner-branded team pages.

## Release source: v1.3.176 — Team member workspaces

Owners create separate team logins in Settings → Team logins. Team members manage their own profile, private client photos/notes, appointment calendar and time off; shared pages offer public profiles and booking availability. Package limits and administrator overrides still govern the saved staff roster. See AGENTS.md for deployment verification and testing limits.

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

**Release source: v1.3.175 — verified live in staging and production; Helcim collection remains pending.**

# v1.3.154 release handoff — canonical URL deployment verified LIVE

Primary production is https://selahflow.onrender.com, Render service selahflow (srv-dbgbiu0n74is73cglveg), workspace tea-da643qgu01pc73951gdg. It reuses the existing selahflow_production database and selahflow_production_user. No customer-data copy, reset or credential rotation. Original selahflow-studio (srv-db3tokqd0e5s73f31hfg) remains available at the old hostname for existing links/callbacks. No automatic redirect is installed.

PR #82 added canonical PDF/current-documentation links, a configurable message worker and staging-host protection. PR #83 added the exact new immutable Render service ID to database preflight without weakening database, role, schema or ownership checks. Application merge bca27a11a9a05e60dc020b3d981345256756528a; source tree 1acbab4fb9c019da67a17d04eb751daf52a87437. Staging commit 1ca857482b9f86c2130f7587a0e97070ce4ca055 has the identical tree.

Staging dep-dbgc4hg473hc73b2di70 LIVE 2026-10-27T15:33:36.645549Z. Old production dep-dbgc90ks728c73f7jpdg LIVE 15:36:15.075160Z. New production dep-dbgc9tnavr4c73dkc15g LIVE 15:38:03.475253Z. Normal npm run start is restored on the new service; APP_URL is the new origin, SELAHFLOW_MESSAGE_WORKER=true, and main auto-deploy is On Commit. Old worker flag is false, verified in Render. Do not set the old service APP_URL to the new origin: that would reject old-origin mutations.

Local, GitHub CI 40530704751/job 122282381795 and Render staging passed 424 tests, typecheck and builds. Both production services passed live version/booking/payment-shell/protected-API/no-store checks. New production preflight confirms intended database/role, schema CREATE true and zero unowned tables. Gmail readiness is configured/setupComplete true, needsReconnect false, missingConfiguration empty; authorization remains stored_connection_not_live_verified. No error-level entries in the checked successful cutover window.

New-host PDF exact-byte and business-scoped assistant checks passed; staging and new production passed public assistant and ID-only unknown-status checks. The older GitHub live-smoke run exposed a stale hardcoded four-session assertion after successful deployment checks. The verification script now compares the mixed answer against published weekly/monthly plan data and current price; its corrected live checks passed in both environments. This verification-only correction does not alter the deployed app.

Stripe live SelahFlow LLC endpoint we_1UTjvl3btxSEZmvTRMc6CG0l was updated and read back at https://selahflow.onrender.com/api/stripe/webhook. Its endpoint ID, API version and eight event subscriptions were retained; no secret rotation or charge. The unsigned endpoint rejects invalid signatures. Existing Gmail connection and credentials are retained. Still pending: Google OAuth allowlisting of https://selahflow.onrender.com/api/platform/gmail/callback for future reconnection, and authorized real payment/email-delivery verification. No real client booking, signature, payment, test email or customer-data retrieval was used for QA.

The 20-page Arcila guide revision 1.1 has eight new-host links, SHA-256 d3132806a98f0c1610e965323181bda22bde0a85ab67e172ceb3b94f4b731035, 1,388,112 bytes. Rendered pages were visually checked. Public Arcila navigation and Request help were verified in the browser at the new host. New-origin sign-in/notification permission is separate from the old origin. See docs/URL_MIGRATION_2026_10_27.md for operational details.

**Previous release: v1.3.152 — verified LIVE in staging and production.** Arcila Training client instructions PDF with screenshots, right-side Request help and assistant guide links. See [release evidence](docs/V1_3_152_RELEASE.md).

**Previous release: v1.3.151.** One expandable entry per linked booking, separate booking/payment status and shared Expand all / Collapse all arrows. See [release evidence](docs/V1_3_151_RELEASE.md).

**Previous release: v1.3.150.** ID-only registration autofill and booked service/type in appointment status. See [release evidence](docs/V1_3_150_RELEASE.md).

**Previous release: v1.3.149.** Membership classification badges show payment/usage status; confirmed owner deletion expires eligible unpaid Stripe checkouts. See [release evidence](docs/V1_3_149_RELEASE.md).

**Previous release: v1.3.148.** Membership plans support optional weekly allowances within the membership month. See [release evidence](docs/V1_3_148_RELEASE.md).

**Previous release: v1.3.147.** All public-page customization is under Branding, with booking QR downloads/sharing and top-right social links. See [release evidence](docs/V1_3_147_RELEASE.md).

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

Main platform: https://selahflow.onrender.com/
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
