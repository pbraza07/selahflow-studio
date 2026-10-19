# SelahFlow technical optimization audit — Phase 1 (2026-10-19)

> **Safety status:** optimization candidate only; production remains v1.3.110 at `63383233ba2bf48b44531deff6588a21f3eff6ce`. A production change is NOT authorized until the owner reviews measured outcomes and explicitly approves deployment. No production database migration or data reset is included.

## 1. Read-only inventory and deployment baseline

- GitHub repository: `pbraza07/selahflow-studio`, production branch `main`, staging branch `staging`.
- Both active deployments started from the same application source tree at the baseline (though they retained separate databases and credentials).
- Runtime: Next.js **16.3.4**, React **19.2.6**, PostgreSQL through `pg` **8.23.1**, Node.js **22** in CI.
- Source inventory from GitHub tree: **391 files**, **22 app pages**, **46 API route files**, **60 app UI components**, **71 server modules**, **44 SQL migrations**, **71 test modules**.
- Largest code: `app/studio/owner-dashboard.tsx` (~98 KB), `lib/studio-handler.ts` (~49 KB), `app/components/owner-client-directory.tsx` (~35 KB), `app/components/owner-memberships.tsx` (~28 KB).
- Global stylesheet: `app/globals.css` ~195 KB (source). Several SVG brand assets are ~130–201 KB (source).
- Production Render service `selahflow-studio`: free instance, `main`, auto deploy, `npm install; npm run build`, no configured health-check path.
- Staging Render service `selahflow-staging`: free instance, `staging`, manual deploy, `npm ci --include=dev --no-audit --no-fund && npm run typecheck && npm test && npm run build`, health check `/api/health`.
- Shared `server/database.mjs` already reuses a global PostgreSQL pool (max 10 in production, 2 in staging): preserve.
- Read-only Render database inventory did **not establish the identity of SelahFlow's production PostgreSQL connection**, nor the backup/restore point. The separate Render instances exposed default connections for other projects. Database optimization is blocked until the SelahFlow production database and a **tested restore procedure** are identified.

## 2. Baseline measurements — do not misinterpret

Repeatable build measurement script: `scripts/measure-build.mjs`, run after an unchanged Next webpack production build in GitHub Actions. Script sums static JS/CSS asset sizes with and without gzip. These are **all emitted files**, *not* the initial bytes downloaded for any one route.

| Build metric | Baseline v1.3.110 | Candidate optimization | Meaning |
|---|---:|---:|---|
| JS raw bytes, all emitted chunks | 1,523,104 | 1,544,827 | +1.43%; chunk splitting adds emitted modules |
| JS gzip bytes, all emitted chunks | 474,458 | 491,674 | +3.63%; not a first-load metric |
| CSS raw bytes, all emitted CSS | 246,072 | 246,072 | unchanged |
| CSS gzip bytes, all emitted CSS | 41,642 | 42,049 | compressor variance |
| All JS + CSS gzip bytes | 516,100 | 533,723 | +3.41%; optimization **not yet shown to reduce total output** |
| Number of JS chunks | 92 | 106 | on-demand splitting increases chunk count |
| GitHub Actions build step duration | 38 seconds | 38 seconds | no proven build-time gain |
| Automated suite | 251 passing | 254 passing | three additional structural regressions |

Comparison: CI baseline `feature/perf-baseline-110` run `39232201190`; optimized `feature/perf-wave1-110` run `39232264940`. Route-specific first-load size is **not yet established** from the available Next.js 16 build manifests. Lighthouse LCP, INP, CLS, p75 page timings and response-time savings are **not measured**. Render returned no usable HTTP latency/count series in the requested baseline window, so they must not be invented.

## 3. Highest-priority architecture and performance risks

| Risk | Evidence | Recommended controlled action |
|---|---|---|
| Large owner-dashboard client dependency graph | 98 KB main component plus eager imports of multiple heavy secondary sections | Chunk-split non-Overview sections and measure route initial JS; do not change dashboard layout or data contracts |
| Full dashboard polling while backgrounded | 30-second `refresh()` interval ran regardless of tab visibility (except Settings) | Skip hidden-tab refresh and resume immediately upon return; no changes to foreground cadence |
| Avoidable serialized backend work | `ownerGet()` fetched business name after waiting for roster/activity queries | Issue the name query concurrently with independent requests; preserve tenant-scoped SQL and JSON shape |
| Unbounded owner-data retrieval | `SELECT * FROM appointments` and events without paging in `lib/studio-handler.ts` | Profile representative workloads, paginate carefully, preserve calendar and reporting completeness; higher-risk follow-up |
| Overweight static assets / CSS | 195 KB global source stylesheet; repeated large SVGs | Establish visual snapshots and per-route asset map before changing images or CSS; user must approve any appearance change |
| Deployment mismatch | Production build skips staging's validation steps and uses `npm install` | Propose an immutable, validated production build after explicit production approval |
| Unverified database restore | No confirmed production PostgreSQL database identity/backup from available Render read-only metadata | Verify recovery snapshot, test restoration, capture pre-deploy checksums before any schema/index changes |
| Staging startup side effects | `scripts/start.mjs` calls one-off staging reset/import/setup scripts behind environment flags | Confirm flags and idempotency before deploying a new staging release; do not reset customer/test data |
| Observability gaps | Render free services, no production health check path and missing HTTP latency samples | Set health-check path after approval; add low-overhead safe RUM/performance capture in later wave |

## 4. Implemented source-only candidate

- `app/studio/owner-dashboard.tsx`: 14 secondary-screen and Settings components replaced with Next.js `dynamic()` imports, preserving every original usage and route/role gate. This defers their module evaluation until selected; user-visible savings require route-level network validation.
- Same file: the original 30-second owner data-refresh interval remains for visible tabs; hidden tab polling is skipped and one refresh occurs on visibility restoration. Expected theoretical bound: **120 full-refresh timer firings/hour avoided** while completely hidden, but not yet verified from network telemetry.
- `lib/studio-handler.ts`: independent business-name lookup moved into the original `Promise.all`, reducing critical-path serial awaits without changing query count, tenant filter, response JSON or payment logic.
- `tests/performance-boundaries.test.mjs`: three new structural checks guarding lazy-loading boundaries, foreground polling, tab wiring, original owner API shape, and tenant-scoped name query.
- `scripts/measure-build.mjs` and validation workflow: automated reproducible static-output measurements for future changes. No runtime dependencies were added.
- No migrations, payment changes, membership changes, UI redesign, environment-variable edits, or changes to `main` or `staging` are included in the candidate.

## 5. Functionality and rollout gate

Before staging promotion: GitHub typecheck, full tests and build must all pass; validate route-level client download and UX changes. After staging: manually verify owner nav tabs, existing client directory, history, Stripe/Gmail workflows, booking and approvals, calendars, reports, and multi-tenant permissions. Capture before/after Lighthouse with the same device/network and representative warm/cold views. If no measurable improvement or there is a regression, revert the candidate.

Production gate: **explicit owner approval AFTER the staging report**, confirmed production DB backups/restore capability, exact production SHA verification, and release rollback plan. Production's current known-good deploy: `dep-dbamvr0ae00c739v0tr0` on commit `63383233ba2bf48b44531deff6588a21f3eff6ce`. Roll back code to that Git revision if required; a code rollback is **not a database restore**.

## 6. Remaining work and costs

- Finish first-load route mapping and real-device CWV measurements; current compiled asset totals **do not prove** the requested 30% reduction or Lighthouse 90+.
- Profile SQL with `EXPLAIN (ANALYZE, BUFFERS)` against a safe production-like dataset and verified recovery first; defer speculative indexes.
- Add API request count/p95 and slow-query monitoring without exposing personal or payment data.
- Add formatting/linting rules and explicit architectural boundaries, but avoid formatting the entire repository in a risky bulk change.
- Review dependency vulnerabilities and upgrade one compatibility-tested dependency at a time.
- Estimated infrastructure cost for this phase: **$0 additional** (existing GitHub Actions and Render services), subject to normal build-minute quotas.

This audit is deliberately incremental. It is not a claim that all 391 files were exhaustively refactored or that all end-to-end production journeys have been verified.
