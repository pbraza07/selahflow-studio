# v1.3.116 production promotion — October 21, 2026 UTC

The user explicitly removed Noah-record inspection from scope and requested production v1.3.116 and first-booking waiver enforcement. Do not inspect or delete that client's records as part of this continuation.

Main was merged without force to da37e15f261b91ec01016322c55759c4245e3a97 with the identical tested staging tree 65f114ae9aa204e14f2195c4e6207415a0ea068d. Production deployment dep-dbc2culg1s2s738bjl60 built successfully but failed before migrations because the service-name preflight rejected the runtime name.

Corrected the preflight to prefer the two verified immutable Render service IDs, reject unknown IDs, and retain exact database, role, CREATE and table-ownership checks. Regression coverage includes renamed services, unknown IDs and cross-environment database mismatch. This is a deployment correction to the still-unreleased production v1.3.116, not a new functional release.

Correction commit on main/staging: c5d7a9090c1318fe35b52d905229e7627f962862. Production deployment dep-dbc2e4bncjis73ek3bs0 built but failed at 02:46:00Z because the production role does not own all public application tables. Database name/role/schema checks passed before that failure. No migration ran. Backup archive TOC lists all 56 production application tables owned by amanda_realtor_db_user; inspect current ownership before any repair. Do not disable the preflight or grant membership in the broad administrator role.

Local checks after correction: typecheck exit 0, 285 tests passed / 0 failed (46.49 seconds), diff check exit 0. Focused waiver tests additionally passed first signature, same-identity/version reuse, guardian validation and tenant isolation. These do not prove active production waiver settings.

Browser recovery succeeded using a fresh tab through the documented browser API. Automatic approval review rejected copying the external database connection URL because it contains credentials and deployment authorization did not explicitly authorize that extraction. No credential was copied or exposed. Approval is needed to use the existing administrative connection solely to inspect and correct SelahFlow production object ownership, preserving records and all unrelated databases. The read-only Render connector cannot perform that repair or select this child database.

Production remains on the previous LIVE v1.3.114 deployment until a future successful rollout; main's version is ahead of LIVE. No data deletion occurred. The corrected staging deployment dep-dbc2e4lg1s2s73bjh4t0 must be checked to terminal status.

Waiver enforcement is implemented for services whose requiresWaiver flag is enabled, including booking, approval and payment checks. Do not claim all Arcila sessions are active yet: the existing production service flags were not enabled, and no actual legal-review reference/date was supplied. Issue 46 requires legal review before production use. Do not fabricate that review, sign for a customer, or enable a configuration that blocks all bookings before the review is available.

## Follow-up: credential approval received

The user explicitly approved use of the credential for the scoped repair. The copy action was permitted, but the browser runtime then blocked clipboard retrieval with retained_data_restricted, including after its documented fresh-document recovery. No credential reached the local database client; no credential file was created. Do not treat this as missing user approval or attempt to bypass browser protection. Prepared scripts/repair-production-object-ownership.sql: transactionally changes ownership of the exact 56 known application tables and three identity functions, guarded by current database and administrator identity; excludes the unrelated legacy sequence. It has not been executed on production. An authorized administrator must execute it through an available database client, or the browser credential-transfer limitation must be resolved.

Corrected staging deployment dep-dbc2e4lg1s2s73bjh4t0 became LIVE at 2026-10-21T02:49:20.220291Z on c5d7a9090c1318fe35b52d905229e7627f962862. Production HTTP health still returned status ok/version 1.3.114. Do not report production v1.3.116 success.

## Resolved — production v1.3.116 LIVE

The user executed the scoped ownership repair in pgAdmin. Initial SET ROLE failure was resolved with a temporary administrator-issued membership (INHERIT FALSE, SET TRUE), revoked before COMMIT. Live pg_auth_members verification showed only the original postgres-issued membership remaining (ADMIN true, INHERIT false, SET false). The repair script now includes that prerequisite and cleanup.

Production deployment dep-dbc2r98n74is73f5v9sg became LIVE at 2026-10-21T03:14:16.994133Z, exact commit c5d7a9090c1318fe35b52d905229e7627f962862. Build passed. Actual startup preflight at 03:14:02Z confirmed database selahflow_production, role selahflow_production_user, schema CREATE true and unownedTables 0. Migrations 046, 047, 048 and 049 applied successfully. Public GET /api/health returned {"status":"ok","version":"1.3.116"}. No error-level logs were returned for the observed startup window through 03:14:32Z.

This supersedes earlier production-blocked status. The application is deployed; business-specific waiver activation/legal review and the broader acceptance matrix are not thereby proven complete. No Noah inspection or customer deletion was performed in this continuation.
