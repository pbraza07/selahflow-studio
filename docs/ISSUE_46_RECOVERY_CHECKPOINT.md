# Latest checkpoint — 2026-10-20

Implementation saved to GitHub: `1df6e1d9cfae79a446757c7b47f009d2424dfa5c` on `feature/issue-46-waiver-client-id-integrity`. Its tree `6268634e518cf96bb5b18d10cb98a5863dd4e8c4` exactly matches locally tested commit `1a6131b7f3870ec6d69088e19aea5233ac095afd` (preserved as local recovery/issue46-local-tested-1a6131b). Shell push lacked credentials; connected GitHub created the identical tree and fast-forwarded the feature ref with an expected-head check. Local branch is aligned to the GitHub commit.

Typecheck, 279 tests and production build passed (all exit 0). Read `docs/ISSUE_46_ACCEPTANCE_EVIDENCE.md` for changes and open criteria. No staging/production deploy or live client deletion occurred. Optional membership identity fields are not yet fully supported despite editable Required controls. Backups/isolated restore, exact private target identification, legacy remediation, legal review and both-environment acceptance remain pending. Keep the issue open.

Render Dashboard Google account selection completed through secure authentication, but browser capability became unavailable before positive sign-in verification. Authentication state is unknown. Resume via fresh visible evidence when browser access is available; never assume authentication succeeded. No secrets were collected in chat.

---

# Issue #46 recovery checkpoint — 2026-10-20

Status: requirements recovered; implementation, staging acceptance and production deployment are pending. This document is not evidence that issue #46 is complete.

## Verified source baseline

- Repository: pbraza07/selahflow-studio.
- main: e303c421bb42146bc4d217f87d82d10db28609e3.
- package.json and VERSION both report 1.3.114.
- Preserved baseline branch: baseline/v1.3.114-before-issue-46, created at the main SHA above.
- staging: 533c8317ba71e9add535279f5b4e88dbb5869627.
- main and staging both reference source tree 064777fb8959b6faf4d88910e5fbd68c8aa25ba5.
- Before this checkpoint, feature/issue-46-waiver-client-id-integrity had zero commits ahead of main, one merge commit behind, and no changed files. No issue-specific implementation was recoverable from that branch. Uncommitted work in previous execution environments could not be inspected.
- Issue #46 remains the authoritative acceptance specification: https://github.com/pbraza07/selahflow-studio/issues/46

## Execution and access blockers

Shell execution was attempted repeatedly and returned: "No usable execution environment is available. Wait for an environment to become available before using this tool." Connector orchestration works; this does not establish that Node, PostgreSQL tools, a local checkout or browser tests can run.

The user explicitly confirmed Plinio's workspace (tea-da643qgu01pc73951gdg), and the Render connector selected it successfully. The workspace-selection blocker is resolved. Local shell execution was retried and remains unavailable. See the verified Render observations below; full application/database and backup verification remains pending.

## Recovery and data safeguards

No application code, deployment branch, environment setting or customer record was changed in this session. This checkpoint and the baseline branch are source-control records, NOT database backups.

PR #42 describes a historical database restore with matched row counts/content hashes, but also states backup archives were in a temporary administration-service filesystem. That historical report is not evidence of a current durable, restorable backup. Verify current source connections, backup existence, scope, integrity and an isolated restore before any destructive action. Preserve Amanda, Kairos, existing SelahFlow records, financial reconciliation and required consent evidence.

Do not embed customer identities, database credentials, backup contents or private payment links in this document or future release notes. Exact deletion targets must be identified privately by immutable business/client identifiers, checked for dependencies and homonyms, and matched to the user's authorized scope. Do not perform broad name-based or startup deletion.

## Implementation starting points

Read AGENTS.md and docs/CHATGPT_PROJECT_CONTINUITY.md, treating dated deployment claims as historical.

- Shared registration and questions: server/registration-questions.mjs, server/client-registration-fields.mjs, server/booking-custom-fields.mjs, app/components/registration-question-settings.tsx, app/components/registration-fields.tsx.
- Identity: server/member-id-policy.mjs, server/shared-member-identity.mjs, server/replace-legacy-member-id.mjs; audit all callers, returning lookup, imports, caches, membership/session flows and legacy compatibility.
- Client messages: server/booking-client-notifications.mjs and server/registration-payment.mjs; preserve queue deduplication and provider-outcome handling.
- Deletion coverage: tests/permanent-client-deletion.test.mjs and linked implementation; inspect staging reset/import paths before changes.
- Current migration tree ends at 045_remove_legacy_crawford.sql. Discover actual applied migrations independently in each database.

Implement all issue #46 requirements in shared tenant-scoped paths: versioned signed waivers and booking/checkout enforcement; independent Required/Notify flags; accurate idempotent approval emails with payment links only for a positive balance; strict configured six-character active IDs with transactional business-scoped uniqueness and collision handling; retention-aware targeted deletion and prevention of stale-record resurrection. Do not silently delete or rewrite legacy data to make a constraint pass. Legal approval of production waiver wording, particularly minors' provisions, remains an issue requirement.

## Resume and release gates

1. Restore execution access and verify it with a trivial shell command, then recover any available local work before overwriting files.
2. Confirm the Render workspace, current LIVE commit/deploy IDs, isolated database connections, migration privileges, and usable backups.
3. Recheck main/staging/feature tips for concurrent changes. Continue on the feature branch from the verified baseline without reverting newer work.
4. Implement requirements, advance functional release version consistently, and run npm run typecheck, npm test and npm run build.
5. GitHub workflow .github/workflows/validate-v1.3.yml runs these checks on main and feature/** pushes. A successful baseline/docs-only run does not prove issue #46 acceptance.
6. Test the exact candidate in staging, including waiver version/guardian cases, all form flags, email deduplication and retries, six-character IDs, concurrent registration, tenant isolation, deletion/retention and financial reconciliation. Record limitations and avoid unintended customer notifications or charges.
7. Promote only the verified application changes to production while retaining production configuration and data. Verify exact LIVE SHA/deploy ID, health, migrations and acceptance smoke checks.
8. Record all evidence and leave issue #46 open until its acceptance criteria are actually met.


## Render verification after workspace confirmation — 2026-10-20

Read-only checks verified:
- Production service srv-db3tokqd0e5s73f31hfg: Render status live, deploy dep-dbbkfpbm8hqs7391t2mg, exact commit e303c421bb42146bc4d217f87d82d10db28609e3; finished 2026-10-20T10:54:03Z. It tracks main with automatic deploys enabled.
- Staging service srv-db8e9dajnfac73fa0vo0: Render status live, deploy dep-dbbphe7f3r2c73dunrs0, exact commit 533c8317ba71e9add535279f5b4e88dbb5869627; finished 2026-10-20T16:41:53Z. It tracks staging with automatic deploys disabled.
- These are the v1.3.114 source commits identified above, not issue #46 releases. No deployment was triggered during these checks.
- Staging logs for that existing deploy show 266 tests, 266 passed and 0 failed at 16:40:28Z, database migrations ready at 16:41:37Z and application ready at 16:41:45Z. These results cover the baseline only.
- Staging startup reports a prior registration reset with alreadyApplied=true and freshRegistrationVerified=true. This is historical reset metadata, not evidence that a new deletion was performed in this session or that issue #46's ID-reuse/retention requirements pass. Review this startup path before future deployment.
- Read-only pg_database query on amanda-realtor-db confirms separate amanda_realtor_db, selahflow_staging and selahflow_production databases. Both SelahFlow database owners are the administrative Amanda database user. A separate pg_stat_activity query observed staging connections as selahflow_staging_user; no production connection was present in that snapshot. Absence of a session does not establish production misconfiguration.
- The connector's SQL tool selects the managed instance and does not expose a database-name override. No per-SelahFlow-table queries, restore tests, backup verification, or current production connection-string inspection were completed.
- Public /api/health fetch attempts for both SelahFlow URLs were inaccessible through the available web tool. Render LIVE state is verified; fresh independent endpoint/application smoke verification is not.

No application changes, environment changes, client deletions, migrations or new deployments were performed. The next step still requires a usable execution environment for implementation and validation, plus verified backup/recovery access before destructive work.
