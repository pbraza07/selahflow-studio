ALTER TABLE team_accounts ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;
CREATE TABLE IF NOT EXISTS team_profile_aliases(slug TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES team_accounts(id) ON DELETE CASCADE);
DO $$ DECLARE r RECORD; base TEXT; candidate TEXT; suffix INTEGER;
BEGIN
 FOR r IN SELECT a.id,b.slug,a.profile,s.data,a.staff_id FROM team_accounts a JOIN businesses b ON b.id=a.business_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE a.public_slug IS NULL ORDER BY a.id LOOP
  base:=trim(both '-' FROM regexp_replace(lower(r.slug||'-'||COALESCE(NULLIF(r.profile->>'name',''),(SELECT st->>'name' FROM jsonb_array_elements(COALESCE(r.data::jsonb->'staff','[]'::jsonb)) st WHERE st->>'id'=r.staff_id LIMIT 1),'team-member')),'[^a-z0-9]+','-','g'));
  candidate:=base;suffix:=1;
  WHILE EXISTS(SELECT 1 FROM team_accounts WHERE public_slug=candidate) OR EXISTS(SELECT 1 FROM team_profile_aliases WHERE slug=candidate) LOOP suffix:=suffix+1;candidate:=base||'-'||suffix;END LOOP;
  UPDATE team_accounts SET public_slug=candidate WHERE id=r.id;
 END LOOP;
END $$;
