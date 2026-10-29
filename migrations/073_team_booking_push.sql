CREATE TABLE team_booking_push_jobs(
 appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES team_accounts(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','skipped','failed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(appointment_id,account_id)
);
CREATE INDEX team_booking_push_pending ON team_booking_push_jobs(created_at) WHERE status='pending';
CREATE FUNCTION enqueue_team_booking_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status NOT IN ('Cancelled','No-show','Completed') AND NEW.date >= to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD') THEN
 INSERT INTO team_booking_push_jobs(appointment_id,account_id)
 SELECT NEW.id,t.id FROM team_accounts t JOIN businesses b ON b.id=t.business_id
 WHERE b.owner_id=NEW.owner AND b.status='active' AND t.active=true
 AND (t.staff_id=NEW.staff OR COALESCE(NEW.data::jsonb->'hostTeamIds','[]'::jsonb) ? t.staff_id OR EXISTS(SELECT 1 FROM session_team_occurrences o WHERE o.business_id=b.id AND o.session_id=NEW.data::jsonb->>'sessionId' AND o.session_date=NEW.date AND o.start_minute=NEW.start AND o.staff_ids ? t.staff_id) OR EXISTS(SELECT 1 FROM session_team_assignments o WHERE o.business_id=b.id AND o.session_id=regexp_replace(NEW.data::jsonb->>'sessionId','__[0-9]{8}$','') AND o.staff_ids ? t.staff_id))
 ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER team_booking_push_created AFTER INSERT OR UPDATE OF staff,date,start ON appointments FOR EACH ROW EXECUTE FUNCTION enqueue_team_booking_push();

CREATE FUNCTION enqueue_assigned_team_booking_push() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO team_booking_push_jobs(appointment_id,account_id)
 SELECT a.id,t.id FROM appointments a JOIN businesses b ON b.id=NEW.business_id AND b.owner_id=a.owner JOIN team_accounts t ON t.business_id=b.id
 WHERE a.id=NEW.appointment_id AND t.active=true AND b.status='active' AND NEW.staff_ids ? t.staff_id
 AND a.status NOT IN ('Cancelled','No-show','Completed') AND a.date>=to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER team_booking_push_assigned AFTER INSERT OR UPDATE OF staff_ids ON appointment_team_assignments FOR EACH ROW EXECUTE FUNCTION enqueue_assigned_team_booking_push();
