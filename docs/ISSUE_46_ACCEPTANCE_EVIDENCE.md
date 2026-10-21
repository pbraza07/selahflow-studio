# Issue 46 implementation and recovery evidence

Status: feature-branch checkpoint; NOT deployed, NOT complete. Authoritative requirements: https://github.com/pbraza07/selahflow-studio/issues/46.

## Recovery and preserved baseline

On 2026-10-20, fetched origin and verified main and baseline/v1.3.114-before-issue-46 at e303c421bb42146bc4d217f87d82d10db28609e3. Feature recovery checkpoint was 901c482bac0c72aae050e437f955835927ee6b7d. Staging was 533c8317ba71e9add535279f5b4e88dbb5869627. Recovered an older uncommitted implementation into a separate worktree; original checkout remains unchanged. No force-push, baseline reset, live data mutation or service configuration change was performed.

## Verified live baseline (before candidate)

- Workspace: tea-da643qgu01pc73951gdg.
- Production srv-db3tokqd0e5s73f31hfg: LIVE dep-dbbkfpbm8hqs7391t2mg, e303c421bb42146bc4d217f87d82d10db28609e3.
- Staging srv-db8e9dajnfac73fa0vo0: LIVE dep-dbbphe7f3r2c73dunrs0, 533c8317ba71e9add535279f5b4e88dbb5869627. Public health returned ok/version 1.3.114. Production HTTP probe timed out; not evidence of failure or candidate readiness.
- amanda-realtor-db instance contains distinct selahflow_staging and selahflow_production databases. Dedicated roles have CONNECT to their own database and not the other. Staging role had active sessions. No production session was observed in that snapshot. Current DATABASE_URL values and table ownership remain unverified.
- No current backup or isolated restore has been verified. No exact client deletion target has been privately verified. Amanda and Kairos were not modified.

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

Recovery page reports a three-day point-in-time recovery window. Requested a fresh managed logical export; it was still generating at the last observation. This is not yet a verified usable backup. Prepared, but did not create, an isolated point-in-time recovery instance named selahflow-issue46-restore-check. Render quotes $6/month compute plus $1.50/month for 5 GB storage = $7.50/month, prorated by the second. Autoscaling and high availability are disabled. New paid-instance creation is awaiting the user's requested cost approval. No existing connections, data, deployment or database settings were changed.
