import {publicBookingServiceSummary} from './public-booking-service.mjs';
import {easternClock} from './session-scheduling.mjs';

export async function memberSessionStatus(db,owner,memberNumber,config,at=new Date()){
 const {date,minutes}=easternClock(at);
 const rows=(await db.query(`
  WITH visits AS (
   SELECT id,date,start,duration,status,data FROM appointments
   WHERE owner=$1 AND data::jsonb->>'memberNumber'=$2 AND COALESCE(data::jsonb->>'sample','false')<>'true'
   UNION ALL
   SELECT id,date,start_minute,duration,
    CASE status WHEN 'pending' THEN 'Awaiting approval' WHEN 'declined' THEN 'Declined' ELSE status END,details
   FROM booking_requests WHERE owner_id=$1 AND details::jsonb->>'memberNumber'=$2
    AND appointment_id IS NULL AND status IN ('pending','declined')
  ), past AS (
   SELECT *,false AS upcoming FROM visits WHERE (date,start)<=($3::text,$4::integer)
   ORDER BY date DESC,start DESC,id LIMIT 5
  ), future AS (
   SELECT *,true AS upcoming FROM visits WHERE (date,start)>($3::text,$4::integer)
    AND status NOT IN ('Cancelled','Declined','No-show','Completed')
   ORDER BY date,start,id LIMIT 5
  )
  SELECT * FROM past UNION ALL SELECT * FROM future
 `,[owner,memberNumber,date,minutes])).rows;
 const order=(a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.id.localeCompare(b.id);
 const project=row=>({date:row.date,start:row.start,duration:row.duration,status:row.status,...publicBookingServiceSummary(row.data,config)});
 return {past:rows.filter(row=>!row.upcoming).sort((a,b)=>-order(a,b)).map(project),
  upcoming:rows.filter(row=>row.upcoming).sort(order).map(project)};
}
