# v1.3.153 — URL migration follow-up (prepared; not deployed)

The new service at https://selahflow.onrender.com already runs unchanged v1.3.152 against the existing production database. See docs/URL_MIGRATION_2026_10_27.md for exact service/deploy IDs and remaining cutover tasks.

This follow-up updates the Arcila client PDF links and current deployment/README/smoke references to the new hostname. The 20-page guide retains its reviewed screenshots, instructions and layout; revision 1.1 updates links. scripts/start.mjs now honors an explicitly configured SELAHFLOW_MESSAGE_WORKER=false instead of overriding it; default remains true for existing deployments. Staging rejects both production hostnames. No payment, email contents, database schema or customer records change.

Source checks in progress. Stripe installation confirmed by user, but no Stripe account tools are currently exposed to this executor. Provider webhook/reconnect verification, final worker transfer, compatibility redirects and auto-deploy settings remain pending. Do not claim full migration or delivered email/charge verification.

