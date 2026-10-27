# v1.3.155 release handoff — legacy URL reference cleanup

User authorized retirement on October 27, 2026 after confirming the new Google callback and working integrations. Canonical production is https://selahflow.onrender.com (srv-dbgbiu0n74is73cglveg); staging is unchanged. Legacy service retirement is pending explicit approval after automatic approval review blocked the retirement controls. The old service remains running with its existing deployment setting. No database, customer record or credentials are deleted. Previously sent links remain available while the legacy service is retained. Historical URL examples in documentation now use the canonical address; historical deployment IDs remain evidence, not current deployment instructions.

Database preflight permissions are unchanged so the retained legacy service can continue starting safely. Staging rejects every non-staging Render hostname rather than naming the retired host. Sharing fixtures use the canonical origin. Stripe webhook already targets canonical production. Google callback configuration is user-confirmed, not directly inspected.

This release removes literal legacy URL references from current tracked source/documentation. Historical deployment identities remain for audit and existing startup compatibility; they are not URL dependencies. Final verification is recorded after deployment. No real booking, charge, or outgoing test email is created.

