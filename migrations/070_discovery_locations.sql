-- Only fill previously empty public descriptions from existing business details.
UPDATE businesses SET description=left(COALESCE(NULLIF(btrim(business_model),''),replace(industry,'-',' ')),600) WHERE btrim(COALESCE(description,''))='';
CREATE TABLE business_discovery_locations (
 business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
 place_id TEXT NOT NULL,
 address TEXT NOT NULL DEFAULT '',
 city TEXT NOT NULL DEFAULT '',
 region TEXT NOT NULL DEFAULT '',
 fetched_at TIMESTAMPTZ,
 attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
