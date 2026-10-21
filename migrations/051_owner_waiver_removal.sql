-- Retain signed evidence; removal invalidates consent and permits a fresh signature.
ALTER TABLE participation_waivers ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE participation_waivers ADD COLUMN deleted_by TEXT REFERENCES users(id);
DO $$ DECLARE item record; BEGIN
 FOR item IN SELECT conname FROM pg_constraint WHERE conrelid='participation_waivers'::regclass AND contype='u' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='participation_waivers'::regclass AND attname='business_id'),(SELECT attnum FROM pg_attribute WHERE attrelid='participation_waivers'::regclass AND attname='customer_id'),(SELECT attnum FROM pg_attribute WHERE attrelid='participation_waivers'::regclass AND attname='document_version')]::smallint[] LOOP
  EXECUTE format('ALTER TABLE participation_waivers DROP CONSTRAINT %I',item.conname);
 END LOOP;
END $$;
CREATE UNIQUE INDEX participation_waivers_active_identity_version_key ON participation_waivers(business_id,customer_id,document_version) WHERE deleted_at IS NULL;
