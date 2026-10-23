# v1.3.136 — Add Client generated-ID fix

Status: candidate; staging and production verification pending.

## Cause and change

The owner editor auto-fills first/last initials + MMDDYY. The create API passed that suggested number to the shared allocator as an existing membership ID. For a genuinely new identity, the allocator correctly rejected the existing-ID claim, but the create flow had confused a suggestion with an identity claim. The error was also hidden as HTTP 503 / Client operation could not be completed.

Only the exact server-recomputed suggestion is now treated as a new-ID allocation request. The shared allocator still reserves the ID under its business/identity lock, rejects collisions and preserves previously issued IDs. Arbitrary or mismatched supplied IDs remain rejected with actionable validation. Missing/invalid required answers roll back both the profile and ID reservation. Client profile editing, deletion/reuse, consent, memberships, financial records and email delivery remain unchanged. No migration, environment or credential changes.

## Verification

A new regression using the actual compiled owner API and all migrations reproduced the reported 503 before the fix. It creates a client with an auto-filled ID, three required select answers and notes, verifies persisted data, rejects repeated/mismatched/colliding requests, permits the same generated ID in a different business, and verifies rollback on missing required answers. Final suite, staging and production checks pending. No live customer record will be created or deleted for QA.
