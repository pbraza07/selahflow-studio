-- Retail inventory is separate from appointment services; both share catalog capacity.
CREATE TABLE IF NOT EXISTS business_products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 description TEXT NOT NULL DEFAULT '',
 price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 50 AND 10000000),
 tax_code TEXT NOT NULL,
 image BYTEA CHECK(octet_length(image)<=250000),
 archived BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,id)
);
CREATE INDEX IF NOT EXISTS business_products_catalog_idx ON business_products(business_id,archived,created_at);
CREATE TABLE IF NOT EXISTS product_shop_settings (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id),
 address JSONB NOT NULL,
 stripe_account_id TEXT NOT NULL,
 stripe_location_id TEXT NOT NULL,
 terms_version TEXT NOT NULL,
 terms_snapshot TEXT NOT NULL,
 accepted_by TEXT NOT NULL,
 accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id TEXT NOT NULL REFERENCES businesses(id),
 request_key UUID NOT NULL,
 member_number TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 customer_email TEXT NOT NULL DEFAULT '',
 customer_address JSONB NOT NULL,
 pickup_location_id TEXT NOT NULL,
 lines JSONB NOT NULL,
 subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents>0),
 tax_cents INTEGER NOT NULL CHECK(tax_cents>=0),
 total_cents INTEGER NOT NULL CHECK(total_cents=subtotal_cents+tax_cents),
 quoted_tax_cents INTEGER,
 quoted_total_cents INTEGER,
 payment_method TEXT NOT NULL CHECK(payment_method IN ('stripe','cash','zelle')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','expired','refunded','partially_refunded','canceled')),
 stripe_account_id TEXT NOT NULL,
 stripe_checkout_session_id TEXT UNIQUE,
 stripe_payment_intent_id TEXT,
 checkout_url TEXT,
 tax_calculation_id TEXT,
 tax_transaction_id TEXT,
 tax_expires_at TIMESTAMPTZ,
 commission_id UUID REFERENCES first_customer_commissions(id),
 refunded_cents INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 paid_at TIMESTAMPTZ,
 submitted_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(business_id,request_key)
);
CREATE INDEX IF NOT EXISTS product_orders_client_idx ON product_orders(business_id,member_number,created_at);
ALTER TABLE first_customer_commissions DROP CONSTRAINT IF EXISTS first_customer_commissions_kind_check;
ALTER TABLE first_customer_commissions ADD CONSTRAINT first_customer_commissions_kind_check CHECK(kind IN ('booking','membership','product'));
