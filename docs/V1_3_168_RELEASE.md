# v1.3.168 release handoff — Industry-specific waiver generation

PR #99 implements opt-in category waivers across businesses. Owners select a category (suggested from their registered industry), add business and service terms, preview the complete document and record a completed legal review before saving activation. The document explicitly lists all waiver-required services; it is a business-wide scope, not a separate signature per booking. Medical, veterinary and other specialized/unknown industries default to general and require their own tailored review.

Category consent is bound to business/client identity, template version, category and SHA-256 of legal content. Service names, descriptions, scope and custom terms affect the fingerprint; palette-only changes do not. Optional media permission starts unchecked. Existing legacy documents, signatures and their compatibility rules remain unchanged until explicit activation. Additive migration 066 permits retained signed revisions with different content hashes. No actual business template or legal review is activated by deployment.

Source implementation; validation and deployment status pending. Production last independently verified on v1.3.167, deployment dep-dbh4kjh5efls73ar1d70. No legal review has been performed by this implementation. No customer signature, booking, payment or outgoing message is created for verification.

