# v1.3.136 — Add Client generated-ID fix

Status: verified LIVE in staging and production on October 23, 2026.

Application commit `3daeec9fb477159c738ba5212fe98c91967fb361` (tree `62d0ce53dffcfe32f7a994c13698894735809e36`). Staging `dep-dbdk6mvb9u1s73a01jqg` LIVE 7:28:16 a.m. EDT; production `dep-dbdka1u417fc738nhrjg` LIVE 7:30:56 a.m. EDT. Saved branch `fix/add-client-generated-id`; PR #62 merged. Documentation-only [skip render] commits may follow the LIVE application SHA.

## Cause and change

The owner editor auto-fills first/last initials + MMDDYY. The create API passed that suggested number to the shared allocator as an existing membership ID. For a genuinely new identity, the allocator correctly rejected the existing-ID claim, but the create flow had confused a suggestion with an identity claim. The error was also hidden as HTTP 503 / Client operation could not be completed.

Only the exact server-recomputed suggestion is now treated as a new-ID allocation request. The shared allocator still reserves the ID under its business/identity lock, rejects collisions and preserves previously issued IDs. Arbitrary or mismatched supplied IDs remain rejected with actionable validation. Missing/invalid required answers roll back both the profile and ID reservation. Client profile editing, deletion/reuse, consent, memberships, financial records and email delivery remain unchanged. No migration, environment or credential changes.

## Verification

A new regression using the actual compiled owner API and all migrations reproduced the reported 503 before the fix. It creates a client with an auto-filled ID, three required select answers and notes, verifies persisted data, rejects repeated/mismatched/colliding requests, permits the same generated ID in a different business, and verifies rollback on missing required answers. Local, GitHub Actions run 39945550084 / job 120387209180 and Render staging each passed all 359 tests, zero failures/skips, typecheck and build. Production build passed. Live read-only health/catalog/protected-owner/communications/style/push checks passed across five staging/four production businesses. Actual runtime database preflights confirmed dedicated databases/users, schema CREATE true and zero unowned tables; no new migration. Final error-level startup query returned no entries.

Client creation success was verified through the actual compiled API against a fully migrated synthetic database. No real client creation/deletion, profile/membership changes, emails, payments, environment changes or credential changes were performed for QA. The reported client was not added on the user's behalf; they can retry the Add Client form. Actual signed-in browser save acceptance was not manually exercised.
