# v1.3.142 — business knowledge assistant

Verified LIVE October 23, 2026 in staging and production.

The assistant reads the selected business’s current saved public content for every question. Owners save normal page/catalog edits; no separate FAQ or reindexing step is required. Shared across all existing and future businesses in owner dashboard, public business home, booking and membership pages.

Knowledge includes profile/page wording; service descriptions, prices and durations; public hours, location, phone and cancellation policy; active membership descriptions, billing intervals, allowances and eligible services; visible team names; registration question definitions/options; the next 31 days of configured future sessions; and version-reviewed waiver clauses including media release. Answers include public sources and booking/membership links. Combined topics and specific dates are supported. Already-passed start times are omitted; live seat availability must be checked in booking.

Private client records, question answers, signed waivers, member balances, hidden staff, notification addresses and internal settings are excluded. Conversations are not persisted. Unknown questions direct visitors to the business. This expands factual published-information search; no generative provider or third-party scraping service was configured. Existing explicit owner handoff remains; public visitors receive contact information rather than an unauthenticated inbox write.

No migration, credentials, environment changes or business/customer mutations. Existing data, Stripe setup and billing are preserved.

## Release evidence

| Item | Verified result |
| --- | --- |
| Application commit | `0f359a9a2ff9386e935c4f73ac8d032de9df3081` |
| Saved implementation branch | `feature/business-knowledge-assistant` |
| Implementation review | [PR #68](https://github.com/pbraza07/selahflow-studio/pull/68), merged |
| Staging deployment | `dep-dbdqf12qqsrs73d5a0eg`, LIVE 2026-10-23 18:38:38 UTC / 2:38:38 p.m. EDT |
| Production deployment | `dep-dbdqk9o473hc73bd538g`, LIVE 2026-10-23 18:42:54 UTC / 2:42:54 p.m. EDT |
| Final local checks | All 371 tests passed; TypeScript and production build passed |
| Application CI | [Run 40003705164](https://github.com/pbraza07/selahflow-studio/actions/runs/40003705164), job 120586121776: all 371 tests, typecheck and build passed |
| Final Render staging checks | All 371 tests passed, zero failed; typecheck/build passed |
| Production build/startup | Passed; dedicated production database preflight passed |
| Live verification | [Run 40005622043](https://github.com/pbraza07/selahflow-studio/actions/runs/40005622043), job 120592654624: passed both environments |
| Verification source | [PR #69](https://github.com/pbraza07/selahflow-studio/pull/69), `scripts/verify-business-assistant.mjs` and updated read-only workflow |

Four new automated tests cover retrieval from actual field types, unknown questions, saved changes without reindexing, mixed price/membership topics, explicit dates, passed start times, default waiver activities not being treated as offered services, reviewed media clauses, script stripping, hidden staff, tenant isolation, active records and actual API validation/no-store. Final local suite: 371 passed, zero failed, skipped or cancelled.

The live job verified health v1.3.142, booking/payment shells, protected owner endpoints HTTP 401, invalid invitation HTTP 400/no-store, and each marketplace business’s own current prices, active membership names, public address, source links and unknown-answer behavior. It exercised reviewed Arcila media text, mixed pricing/credits, configured schedules/date filtering, unknown business HTTP 404 and unrelated origin HTTP 403. Five businesses passed in staging; four passed in production. Arcila’s current production catalog had four services and eight active membership plans. Production had no configured future schedule returned; the assistant correctly directed visitors to booking instead of inventing dates.

Actual runtime preflights: staging database `selahflow_staging` / role `selahflow_staging_user`; production database `selahflow_production` / role `selahflow_production_user`. Both report schema CREATE true and zero unowned tables. No error-level startup entries observed in the final post-startup windows.

Staging browser checks exercised public home/booking/membership assistants, source expansion, current hours/address/prices/plans, owner free-form cancellation-policy and combined pricing/credit answers, and readable white layout. The terminal/browser environment became unavailable during production rollout; no post-deploy production browser or actual phone-device acceptance is claimed. Production HTTP/API verification completed successfully through GitHub Actions.

An initial staging-only build failed one new API test because its fixture used an origin different from Render’s configured app origin (403 versus expected 200). The fixture was corrected to use the configured origin; protection was retained. The corrected intermediate build passed, then the final application commit passed all staging checks before production promotion. Earlier staging-only deploys were `dep-dbdq9qjrjlhs73817r6g` (failed test) and `dep-dbdqd7vavr4c7391qs8g` (corrected intermediate).

No real customer booking, message/email, signature, payment, account creation, settings edit or deletion was generated for verification. Documentation and verification-only commits use [skip render]; they do not change the deployed application or trigger another release.
