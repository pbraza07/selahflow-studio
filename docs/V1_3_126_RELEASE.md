# v1.3.126 — Team privacy and booking defaults

## Owner instructions

- Settings → Team members: create or edit a member and check Hide from client booking, then save. The member is removed entirely from the public team dropdown; the owner still sees the member and can assign sessions and private tracking. Existing members remain visible unless the owner changes this setting. The older business-wide Hide team names option retains its separate name-masking behavior.
- Settings → Service catalog: select a qualified Default team member for a service, then save. A default can be a hidden member. With a single service (or multiple services sharing the same default), the client does not choose a team member. Different defaults in a combined booking require a visible qualified selection or separate bookings.
- Settings → Bookable sessions: choose Default session host. Enable Use the assigned host automatically. New sessions start with this enabled; existing sessions retain their setting. Hidden hosts always use automatic assignment. Choose additional Default tracking team members for owner-only accountability. The primary host still controls capacity and scheduling; extra tracking members do not reserve extra staff slots.
- Selecting a dated session uses that session's host, ahead of any service default. The booking page skips the team dropdown for automatic assignments. Hidden names do not appear in session cards, confirmations or newly generated client receipts; generic Session team wording can identify the assigned team without exposing a private member.
- Owner dashboard → Team accountability: select a date/time to see scheduled default hosts, saved booking host records, and private dated/series overrides. A dated tracking assignment can record the actual team separately. New bookings snapshot the assigned host/team IDs so later default edits do not rewrite their tracking history; old bookings retain their original primary staff ID. This is accountability tracking, not payroll or proof of attendance.

## Boundaries and verification

Staff qualification, exact session date/service/start and business ownership are checked server-side. A forged hidden team ID cannot be used for arbitrary public appointments; it must be the configured service default or the exact session host. Missing/default service selection and recurring session assignment are tested through the actual public booking handler with a synthetic database. No database migration or environment/provider changes. Existing bookings, pricing, capacity, approval/payment, IDs, questions and waivers are preserved.

Application commit `9f78e747fab578a511da130bed5e48518da66ed2`, source tree `275079c5c12f50f92555106979621e6019955126`. Saved branch `feature/private-team-session-defaults`; PR #52.

| Environment | Deployment ID | Verified LIVE (America/New_York) |
| --- | --- | --- |
| Staging | dep-dbcutlvavr4c738t88t0 | October 22, 2026, 7:14:38 a.m. EDT |
| Production | dep-dbcv0jbncjis73baibp0 | October 22, 2026, 7:17:33 a.m. EDT |

- Local: all 319 tests passed, 0 failed; typecheck and production build passed. Focused policy/public-handler/discount/team tests passed (9 tests).
- GitHub Actions 39768315414 / job 119789218469: all 319 tests passed, 0 failed, typecheck/build/static assets checks passed for the exact remote source.
- Render staging independently passed 319 tests, 0 failed, typecheck/build. Production build passed.
- Both live health endpoints: ok / 1.3.126. Public catalog checks passed for Arcila Training, Shekinah, Capstone and Car Shine, plus the staging synthetic business; service default fields are present and default tracking arrays are excluded from public session definitions.
- Private owner tracking/settings GET and same-origin unauthenticated POST return 401. Public styles include member-privacy, session-default and automatic-assignment controls. Push readiness remains configured=true in both environments; production Gmail readiness remains configured=true.
- Startup preflights confirm selahflow_staging/selahflow_staging_user and selahflow_production/selahflow_production_user, schema CREATE true, zero unowned tables; no error-level startup logs observed.
- Synthetic actual-handler tests prove a hidden host is absent from catalog choices and session-name display, can accept exact assigned-session and service-default bookings without a client staff choice, uses masked client receipts, and retains host/team snapshots privately. Additional tests cover recurring defaults, invalid/foreign IDs, mismatched date/service/time, multi-service default agreement and private history grouping.

No real customer bookings/messages/payments or private owner preference changes were created for QA. Authenticated owner browser acceptance was not performed. Existing preferences remain unchanged until the owner edits them; this release provides the controls without guessing which members/services should be hidden or assigned. Final handoff docs use [skip render] and do not deploy another build.
