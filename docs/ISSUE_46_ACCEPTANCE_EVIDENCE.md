# Issue 46 implementation and recovery evidence

Status: feature-branch checkpoint; NOT deployed, NOT complete. Authoritative requirements: https://github.com/pbraza07/selahflow-studio/issues/46.

## Recovery and preserved baseline

On 2026-10-20, fetched origin and verified main and baseline/v1.3.114-before-issue-46 at e303c421bb42146bc4d217f87d82d10db28609e3. Feature recovery checkpoint was 901c482bac0c72aae050e437f955835927ee6b7d. Staging was 533c8317ba71e9add535279f5b4e88dbb5869627. Recovered an older uncommitted implementation into a separate worktree; original checkout remains unchanged. No force-push, baseline reset, live data mutation or service configuration change was performed.

## Verified live baseline (before candidate)

- Workspace: tea-da643qgu01pc73951gdg.
- Production srv-db3tokqd0e5s73f31hfg: LIVE dep-dbbkfpbm8hqs7391t2mg, e303c421bb42146bc4d217f87d82d10db28609e3.
- Staging srv-db8e9dajnfac73fa0vo0: LIVE dep-dbbphe7f3r2c73dunrs0, 533c8317ba71e9add535279f5b4e88dbb5869627. Public health returned ok/version 1.3.114. Production HTTP probe timed out; not evidence of failure or candidate readiness.
- amanda-realtor-db instance contains distinct selahflow_staging and selahflow_production databases. Dedicated roles have CONNECT to their own database and not the other. Staging role had active sessions. No production session was observed in that snapshot. Current DATABASE_URL values and table ownership remain unverified.
- A current managed export and no-cost isolated logical restores are now verified; see the later evidence below. No exact client deletion target has been privately verified. Amanda and Kairos were not modified.

## Candidate changes

Migration 046 adds versioned signed consent with exact wording/hash/theme, signer/guardian/date, timestamp, IP and audit UUID. Consent references actual identity, not a reusable number; identity removal detaches consent rather than deleting it. Current-version checks apply to direct booking, owner approval and checkout. Production waiver use requires recorded version-specific legal review; no legal review is asserted by this implementation.

Migration 047 adds financial retention, source tombstones, deletion audit, exact-target backup/restore authorization and ID history aliases. Six-character guards apply to future writes; NOT VALID constraints intentionally preserve existing legacy rows for reviewed remediation. Historical snapshots remain intact. Legacy replacements preserve history and use aliases, not bulk rewriting of immutable evidence.

Migration 048 queues future direct booking/membership owner notifications transactionally with a unique source/channel/destination key. Per-question Notify controls filter content. Current recipient/channel settings are rechecked; ambiguous delivery outcomes are not blindly retried. No historical notification backfill.

Startup no longer performs destructive client repair/reset. Database preflight checks environment-specific database, role and migration privileges before migrations. Import replay protections remain active and importers no longer disable identity constraints.

## Retention policy implemented

Client deletion requires a fresh, one-use database/target-specific authorization linked to backup and isolated-restore evidence digests. Provision only after actual evidence verification; hashes are not a substitute for a restore test. The transaction blocks active subscriptions, open checkouts and in-flight delivery. Eligible operational PII is removed; tombstones prevent stale source-ID replay and released six-character IDs can be reused for a new identity. Immutable backup snapshots are preserved and must not be used to bypass tombstones.

Retained consent remains under legal hold, including signature and original identity evidence. Minimal financial facts are decoupled from the deleted profile and deduplicated against provider receipts. Stripe reconciliation references remain intact with removed client links set null. Ambiguous legacy financial matching aborts deletion. No automatic financial/consent expiry is implemented: a jurisdiction-specific retention schedule and legal authorization are required before future disposal. This is an engineering retention policy, not a legal determination.

## Acceptance still outstanding

- Every-question Required behavior: controls exist, but membership registration still requires name, email and DOB in identity validation. Fully optional identity fields need a safe identity model and end-to-end tests; do not claim this criterion passed.
- Privately inspect exact authorized client/business records and all active legacy ID sources; remediate only reviewed rows, then validate constraints. Do not infer targets from names alone.
- Verify environment connections/table privileges and current backups; perform and record an isolated restore before any client deletion.
- Counsel review of exact waiver wording/version, especially minors; owner records review reference/date only after review occurs.
- Authenticated mobile/desktop flows and one-page print/PDF visual checks.
- Staging deployment of exact tested commit, migration logs, provider acceptance/idempotency evidence, accounting and concurrency smoke tests; then production promotion of same application changes and equivalent acceptance evidence.
- Record candidate deploy IDs and exact commits here. Issue remains open until all acceptance criteria pass.

Render connector does not expose environment secrets/backup restore workflow; Dashboard fallback reached a sign-in screen. Secure authentication is needed for those checks. No credentials or customer details belong in this document.

## Local validation — 2026-10-20

Final implementation checks: `npm run typecheck` exit 0; `npm test` exit 0 (279 passed, 0 failed, 43.75 seconds); `npm run build` exit 0. `git diff --check` exit 0. Tests use isolated synthetic PGlite databases, not customer databases. Coverage includes versioned consent/retention, unsigned checkout refusal before provider calls, exact deletion authorization, financial deduplication/provider-reference retention, tombstone replay/reuse, database preflight, and filtered/idempotent notification outbox. These automated results do not substitute for the live acceptance items above.

## Dashboard verification — October 20, 2026 (America/New_York)

Authenticated Render Dashboard access succeeded in Plinio's workspace. Read-only inspection verified DATABASE_URL targets on both services: staging uses selahflow_staging / selahflow_staging_user, production uses selahflow_production / selahflow_production_user, both on dpg-db3f1hegekts73egtus0-a. Passwords were not printed or changed. Table privileges remain to be checked.

Recovery page reports a three-day point-in-time recovery window. Requested a fresh managed logical export; it was still generating at the last observation. This is not yet a verified usable backup. Prepared, but did not create, an isolated point-in-time recovery instance named selahflow-issue46-restore-check. Render quotes $6/month compute plus $1.50/month for 5 GB storage = $7.50/month, prorated by the second. Autoscaling and high availability are disabled. The user rejected added cost. The paid restore form was canceled; no new paid instance was created. No existing connections, data, deployment or database settings were changed.


## No-cost isolated logical restore — October 21, 2026 (UTC)

Managed export `2026-10-21T01:31Z.dir.tar.gz` completed and was downloaded from Render. SHA-256: `cf170855e724189ce2b8ec682df89b0d33ac233178d5bc2d62b1b11197223e85`. Render retains this export for at least seven days; the local working copy is restricted temporary storage, not the durable backup. Only the two SelahFlow archive directories were extracted; Amanda/Kairos were not restored or modified.

No-cost restore tooling: PostgreSQL 18.0 `pg_restore` converted each directory archive to SQL with `--no-owner --no-privileges`. PGlite 0.5.10 / PostgreSQL 18.6 restored the schema, data, indexes and constraints using COPY through its documented blob API. The socket COPY attempt failed and is NOT counted as successful evidence. `scripts/verify-logical-backup.mjs` implements the successful direct path and compares sorted COPY content SHA-256 and row counts for every table. No app process, notification worker or provider integration ran against either copy.

| Source | Tables | Rows | Restore evidence SHA-256 | Exit |
| --- | ---: | ---: | --- | ---: |
| selahflow_production | 56 | 400 | fd92c9acdcd76845a218bbcd11ad02a9d3e4d2ba9c9f81984c9bc8fa4b241b0f | 0 |
| selahflow_staging | 56 | 652 | 481a446f98a62ef329162dd5380cec5b8987d87525a43d688c2797f8eb4d494a | 0 |

Each restored database has 56 primary keys, 68 foreign keys, 65 check constraints, 360 NOT NULL constraints and 20 unique constraints. Every copied table's row count and content hash matched its dump. This is isolated logical recovery evidence, not a native Render/PITR recovery test; source role ownership and ACLs were intentionally omitted and current live privileges still require verification.

Migrations 046–048 then passed separately on both restored copies (exit 0), adding eight tables while preserving content hashes of all 56 original tables. Migration rehearsal evidence SHA-256: production `58fdef6c83c0bf3d20fd46497590781b9a3d4ed1aef8fbf908b6de978e26b09e`; staging `3c6276981bab95eba34632203f5071a1c6ef2c782f19052aa683e05c1354746f`. No live migration, client deletion or deployment occurred. Backup freshness must be rechecked immediately before any approved live deletion.


## Follow-up corrections and private target inspection — 2026-10-21

An explicit `showInNotification: false` now takes precedence over legacy notification preferences for both forms. Added regression coverage verifies Notify off independently of Required and of form-specific notification overrides. The current-release handoff heading was corrected after the full test suite caught missing v1.3.115 release metadata.

Read-only inspection of the restored data found no matching active profile, booking identity or membership for the authorized target in either environment. Each snapshot retains one retired legacy-ID reservation; staging also retains three historical receipt rows (two submitted, one superseded). Exact private review manifests remain outside Git. This backup observation does not prove current live state and does not authorize deleting a reservation or receipt independently of reviewed retention rules.

Migration 047 now permits a malformed historical reservation only while retired. It still rejects new malformed active IDs and reactivation of malformed retired IDs, verified by a regression test. No historical reservation is deleted to make validation pass. Fresh restores and rehearsals of revised 046–048 passed again with all 56 original table contents unchanged:

| Environment | Fresh restore evidence SHA-256 | Revised migration rehearsal SHA-256 |
| --- | --- | --- |
| Production copy | 64901aeb24fa207acf8dbc1fc6ad9b9bc686cd43034f497b15edca03021d6a8d | 786bee5b2fe8a07e473a338d30c6d590d2d9e62d2e0f0215cd892bc2504d8783 |
| Staging copy | 3fa584983aa59dea9268581bd8614f2840022c75fa0472a1a37210cd60e03ea9 | 409fd06615781c9c28e865ead9ee580d65e296b233ec48861df47eb4d46da925 |

No-cost recovery evidence and reproducible restore checker were saved at `ff5d5ba989d3dc3f32a51e85b53591279a7129e4`. No production/staging deployment or live data mutation has occurred.

Final candidate validation after the follow-up fixes: `npm run typecheck` exit 0; `npm test` exit 0 (281 passed, 0 failed, 51.13 seconds); `npm run build` exit 0; `git diff --check` exit 0. On each isolated restored copy, all four six-character constraints validated successfully: business_client_profiles_member_number_six, business_member_ids_six, customer_booking_ids_member_number_six and customer_memberships_member_number_six. No live constraint validation is asserted.

## Resumed release — October 20, 2026 (America/New_York)

Remote feature branch already contained follow-up fixes at b4d6e98a21d769edcc870afc7ec52e6e0469e37b; local changes matched that tree exactly and were preserved. Fresh validation of that candidate passed typecheck, 281 tests and build (exit 0).

Staging v1.3.115 became LIVE at 2026-10-21T02:20:32Z, deploy dep-dbc20fpsrm7s739cfmo0, exact b4d6e98 commit. Fresh browser GET /api/health returned status ok/version 1.3.115. Startup preflight confirmed selahflow_staging / selahflow_staging_user, schema CREATE privilege and zero unowned public tables; migrations 046, 047 and 048 applied at 02:20:21Z. No recent error-level startup logs were returned. Live database CONNECT checks confirmed each SelahFlow role can access its own database only, not the other SelahFlow database or Amanda. No production migration or customer deletion occurred.

v1.3.116 follow-up fixes optional membership answers in public enrollment, secure checkout and owner assignment. Omitted name/birth date uses a per-enrollment UUID identity instead of deduplicating blanks. Known full identities retain existing behavior. No DOB, name or contact is fabricated. IDs remain six characters, tenant scoped and serialized by the existing allocation lock. New identity references are immutable and tombstoned on deletion; tests cover retries, cross-tenant reuse, distinct incomplete registrations, deletion/reuse and stale request replay. Missing email is omitted from the Stripe request; no email delivery is claimed without an address. Participation signing and birth-date lookup still require sufficient participant identity. Further authenticated live tests and profile-completion workflow review are required before calling every scenario accepted.

Final local follow-up validation: typecheck exit 0; 284 tests passed, 0 failed (47.28 seconds); production build exit 0; diff check exit 0. Migration 049 rehearsed within rolled-back transactions on both previously verified isolated copies, matching original COPY column hashes for all 56 tables (400 production rows, 652 staging rows). Evidence hashes: production e4db0c39d4ddb125d2581b983781fb84592f6db3f595bac45bc33d13effbda1f; staging 694fda6a6a1e98ca2edc432bc5c2269b27da2e8aac4bbcb7ee2d5a21ac2f841d. This verifies logical data preservation, not native Render PITR.

Arcila review PDF: one letter-size page, eight interactive fields including date, typed electronic signature and signer role, red/black/white business palette, no platform branding. Text matches participation-1. Generated with scripts/render-waiver-review.py from the server document; rendered and visually inspected with embedded fonts. Explicitly marked review draft. Counsel must review the exact wording and Florida minor-waiver notice requirements (https://www.flsenate.gov/Laws/Statutes/2025/744.301). No legal approval has been recorded or inferred. Production promotion, live target-record investigation/deletion and both-environment acceptance remain pending; keep issue 46 open.
