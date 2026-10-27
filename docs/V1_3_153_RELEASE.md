# v1.3.153 — canonical links and configurable email worker

PR #82 merged e8387c618a81a498d64a3659f2275870ea6114a9. Updated eight PDF links/current deployment references, honored an explicit SELAHFLOW_MESSAGE_WORKER=false at startup and rejected both production hostnames in staging safety checks. 423 tests, typecheck and builds passed. Staging and old production reached this version.

The new service's normal startup stopped before migrations because its immutable ID was absent from the database preflight allowlist. The previous v1.3.152 deployment remained serving. v1.3.154 corrects this exact-ID allowlist and is the verified final cutover; see V1_3_154_RELEASE.md. No data reset, secret rotation or protection bypass.
