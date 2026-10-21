# Issue 46 — verified staging release and remaining gates

Observed October 21, 2026 UTC (October 20 in America/New_York). This supersedes earlier deployment status in the recovery checkpoint. Issue 46 remains open; do not claim all requirements complete.

## Source and deployments

- Recovered original feature work without overwriting it. Original `feature/service-participation-waivers` checkout remains preserved.
- Saved implementation branch: `feature/issue-46-waiver-client-id-integrity`.
- Tested application commit: `1c6c4e8cadfb5de633e8b98a04786dbe1f50cf68`; tree `65f114ae9aa204e14f2195c4e6207415a0ea068d`.
- Staging v1.3.116: LIVE `dep-dbc25mu1egvs73982s80`, exact application commit above, finished `2026-10-21T02:31:27.367512Z`.
- Previous staging v1.3.115 deployment: LIVE `dep-dbc20fpsrm7s739cfmo0`, commit `b4d6e98a21d769edcc870afc7ec52e6e0469e37b`.
- Production remains v1.3.114, LIVE `dep-dbbkfpbm8hqs7391t2mg`, commit `e303c421bb42146bc4d217f87d82d10db28609e3`. HTTP health returned status ok/version 1.3.114 after a slow initial probe. Main was not updated.

## Actual verification

- Local typecheck exit 0; 284 automated tests passed, 0 failed (47.28 seconds); production build exit 0; diff check exit 0.
- Render staging build also reported 284 tests passed, 0 failed before successful build/deployment.
- Actual staging startup preflight at 02:31:14Z: database selahflow_staging, role selahflow_staging_user, schema CREATE allowed, zero unowned public tables.
- Migration 049 applied at 02:31:15Z. Migrations 046–048 were applied by the preceding staging deployment at 02:20:21Z.
- Dedicated database roles have CONNECT to their own SelahFlow database and not the other SelahFlow database or Amanda. No Amanda/Kairos/environment deletion or connection change was performed.
- Authenticated Arcila staging dashboard visibly reported v1.3.116. Existing catalog services displayed separate approval and participation-waiver controls. The waiver checkbox could be toggled in the unsaved editor; no settings save was submitted.
- Membership question editor displayed independently enabled Required and notification checkboxes on standard/custom questions. This is UI presence evidence, not a completed persisted end-to-end matrix.
- Production legal-review reference and date were not supplied. The staging editor's legal-review fields were blank. No legal approval was inferred or recorded.
- Public invalid eight-character ID smoke request returned HTTP 400 before identity lookup. Automated tests cover allocation/collisions, cross-tenant reuse, deletion/reuse, tombstones and optional identities; these are not represented as live customer deletion tests.

## Backup and target limitations

The managed export and no-cost isolated logical restores, row/hash comparisons, and migration rehearsals are detailed in ISSUE_46_ACCEPTANCE_EVIDENCE.md. Migration 049 preserved all 56 original table contents in each rolled-back rehearsal (production 400 rows, staging 652 rows). This is not a native Render PITR test.

Read-only backup inspection found no matching active profile, booking identity or membership for the authorized cleanup target. Retired reservation/history evidence remains. Current live target inspection is not complete. No customer records, retired reservations, financial receipts or consent records were deleted. Recheck backup freshness and identify exact current business/source IDs before any authorized deletion.

## Remaining work

1. Complete authenticated staging acceptance: persisted service/field settings, unsigned booking block, consent reuse/version/guardian scenarios, approval email provider acceptance and idempotency, optional enrollment/profile completion, financial reconciliation and mobile layout. Do not send real customer test emails or sign a real waiver without the relevant authorization.
2. Correct the question editor's stale explanatory sentence saying new IDs always require name and DOB; v1.3.116 supports optional membership identity. Review the distinction with booking identity requirements and test the completion workflow.
3. Privately inspect the exact live cleanup target and all active legacy IDs, retain required financial/consent history, and validate constraints after reviewed remediation. Absence from the backup is not proof of current absence.
4. Obtain counsel review of exact participation-1 wording, particularly Florida minor-waiver requirements, before production waiver use. The downloadable one-page Arcila PDF is explicitly a review draft, not legally approved.
5. Promote only after staging acceptance, verify production startup/database ownership/migrations, HTTP health and applicable acceptance flows, then record exact production commit/deploy ID. Do not close issue 46 before verified acceptance.

## Browser continuation blocker

Secure staging owner login succeeded and authenticated controls were observed. Subsequent browser operations failed with credential-protection errors (`retained_data_restricted` / `credential_observation_restricted`). A fresh-tab recovery attempt also failed. This is a browser tooling restriction, not evidence of a SelahFlow login failure or bot block. Further private owner inspection needs browser recovery/manual handoff. Do not extract credentials or bypass the protection. No password was printed or saved in project files.

The generated one-page Arcila Training review PDF was saved and visually checked: business red/black/white, date/electronic-signature/guardian fields, eight interactive controls, no SelahFlow branding. Reproducible renderer: scripts/render-waiver-review.py.
