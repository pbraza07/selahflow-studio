-- Preserve every signed revision and legacy per-version uniqueness.
DROP INDEX participation_waivers_active_identity_version_key;
CREATE UNIQUE INDEX participation_waivers_active_identity_version_key
 ON participation_waivers(business_id,customer_id,document_version,
 (CASE WHEN document_version='category-1' THEN document_hash ELSE '' END))
 WHERE deleted_at IS NULL;
