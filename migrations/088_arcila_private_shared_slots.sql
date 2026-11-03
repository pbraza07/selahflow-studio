-- Explicit user-requested opt-in for Arcila's existing Private Session only.
-- Preserve all catalog values, bookings, payments and other tenants.
DO $$
DECLARE target RECORD; next_services JSONB;
BEGIN
 FOR target IN SELECT s.owner,s.data::jsonb AS config FROM settings s JOIN businesses b ON b.owner_id=s.owner WHERE b.slug='arcillatrng' AND b.status='active' LOOP
  PERFORM pg_advisory_xact_lock(hashtext(target.owner||':schedule'));
  SELECT data::jsonb INTO target.config FROM settings WHERE owner=target.owner FOR UPDATE;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(target.config->'services') x WHERE x->>'id'='1e0d1116-96e5-4a43-ad5c-8ea3e451c734' AND x->>'name'='Private Session' AND COALESCE(x->>'shareTeamSlots','false')<>'true') THEN
   SELECT jsonb_agg(CASE WHEN x->>'id'='1e0d1116-96e5-4a43-ad5c-8ea3e451c734' AND x->>'name'='Private Session' THEN x||'{"shareTeamSlots":true}'::jsonb ELSE x END ORDER BY ord) INTO next_services FROM jsonb_array_elements(target.config->'services') WITH ORDINALITY AS entries(x,ord);
   UPDATE settings SET data=jsonb_set(jsonb_set(target.config,'{services}',next_services),'{teamSessionRevision}',to_jsonb(COALESCE((target.config->>'teamSessionRevision')::int,0)+1))::text WHERE owner=target.owner;
   INSERT INTO events(id,owner,created,kind,data) VALUES('v1.3.212-arcila-private-shared-slots',target.owner,now()::text,'service_capacity_policy','{"serviceId":"1e0d1116-96e5-4a43-ad5c-8ea3e451c734","shareTeamSlots":true,"reason":"Owner requested same-time private service capacity"}') ON CONFLICT(id) DO NOTHING;
  END IF;
 END LOOP;
END $$;
