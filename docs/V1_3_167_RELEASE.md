# v1.3.167 release handoff — Deduplicate business introductions

All tenant business landing pages render their introduction through shared businessIntroLines. Matching tagline and business-model/description text appears once, comparing case, whitespace and Unicode compatibility forms. Distinct wording remains visible in its original form. A tagline-only business displays it once; empty introductions retain the generic fallback. Description precedence and saved business records remain unchanged. Discovery, booking and membership surfaces were reviewed for the same repeated-field pattern; they do not render this pair twice.

Validation and deployment in progress. No database migration or authentication, payment, email or customer-data changes.
