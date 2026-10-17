-- Epoch marks existing receipts as historical; only future jobs opt into the
-- explicit new-client-email rollout. No old queue is released by deployment.
ALTER TABLE booking_receipt_emails ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z';
ALTER TABLE booking_receipt_emails ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE booking_client_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z';
ALTER TABLE booking_client_messages ALTER COLUMN created_at SET DEFAULT now();
-- Explicit authenticated retries may authorize one historical booking without
-- enabling automatic delivery for the rest of the copied staging backlog.
ALTER TABLE booking_receipt_emails ADD COLUMN IF NOT EXISTS client_delivery_authorized_at TIMESTAMPTZ;
ALTER TABLE booking_client_messages ADD COLUMN IF NOT EXISTS client_delivery_authorized_at TIMESTAMPTZ;
