-- Preserve each signed revision; category documents require exact content reuse.
DROP INDEX participation_waivers_active_identity_version_key;
CREATE UNIQUE INDEX participation_waivers_active_identity_version_key
 ON participation_waivers(business_id,customer_id,document_version,document_hash) WHERE deleted_at IS NULL;
