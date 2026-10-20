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

Render returned no selected workspace and explicitly requires user confirmation before proceeding. The account lists Plinio's workspace (tea-da643qgu01pc73951gdg), matching the repository's AGENTS.md. Live deployment state and current database connections have NOT been reverified in this session.

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
