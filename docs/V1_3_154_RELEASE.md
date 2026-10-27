# v1.3.154 release handoff — new production service preflight (prepared)

Allow the exact new Render service ID srv-dbgbiu0n74is73cglveg to use the existing selahflow_production database and dedicated role. Unknown service IDs, staging database connections, incorrect roles, missing schema CREATE and unowned tables remain rejected. No schema/data changes or new credentials.

v1.3.153 passed 423 tests, typecheck/build and live staging checks; PR #82 merged e8387c618a81a498d64a3659f2275870ea6114a9. Old production reached v1.3.153. New service deployment dep-dbgc1rqfngtc7399l870 failed safely before migration because its immutable service ID was absent from the allowlist. The previous v1.3.152 app remains live there. Old email worker was restored while this correction is tested. Stripe's existing live Connect endpoint now targets https://selahflow.onrender.com/api/stripe/webhook with its ID/events/API version unchanged. Google OAuth reconnect allowlisting and real email/payment verification remain pending.

