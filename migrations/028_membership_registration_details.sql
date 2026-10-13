-- Preserve the actual membership-registration submission independently of imports
-- and of future edits to a business's shared booking questions.
ALTER TABLE customer_memberships
 ADD COLUMN IF NOT EXISTS customer_phone TEXT NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS registration_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS registration_field_labels JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Older member registrations stored their custom answers in import_columns.
-- Migrate only identifiable membership-created profiles; do not overwrite a
-- newer snapshot and never reinterpret genuine spreadsheet imports.
UPDATE customer_memberships m
SET registration_answers=p.import_columns
FROM business_client_profiles p
JOIN businesses b ON b.owner_id=p.owner
WHERE b.id=m.business_id
 AND p.deleted_at IS NULL
 AND p.notes='Membership registration'
 AND (p.member_number=m.member_number OR
      (lower(trim(p.name))=lower(trim(m.customer_name))
       AND lower(trim(p.email))=lower(trim(m.customer_email))))
 AND m.registration_answers='{}'::jsonb
 AND p.import_columns<>'{}'::jsonb;

UPDATE customer_memberships m
SET customer_phone=p.phone
FROM business_client_profiles p
JOIN businesses b ON b.owner_id=p.owner
WHERE b.id=m.business_id
 AND p.deleted_at IS NULL
 AND m.customer_phone=''
 AND p.phone<>''
 AND (p.member_number=m.member_number OR
      (lower(trim(p.name))=lower(trim(m.customer_name))
       AND lower(trim(p.email))=lower(trim(m.customer_email))));
