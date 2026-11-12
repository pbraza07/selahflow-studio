import {randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {changeAppointmentStatus} from './appointment-membership-usage.mjs';
import {kioskObject,kioskTimezone,kioskDay} from './kiosk.mjs';
export async function markAutomaticNoShow(db,{business,appointmentId,now=new Date()}){
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.owner_id+':schedule']);
 const current=(await db.query('SELECT status,auto_no_show_enabled,auto_no_show_after FROM businesses WHERE id=$1 FOR SHARE',[business.id])).rows[0];
 if(!current?.auto_no_show_enabled||current.status!=='active')return {skipped:true};
 const zone=kioskTimezone(kioskObject(business.config));
 const a=(await db.query("SELECT *,((date::date+start*interval '1 minute') AT TIME ZONE $3) AS starts_at FROM appointments WHERE owner=$1 AND id=$2 FOR UPDATE",[business.owner_id,appointmentId,zone])).rows[0];
 if(!a||a.status!=='Confirmed'||kioskObject(a.data).sample||new Date(a.starts_at)<new Date(current.auto_no_show_after)||now.getTime()<new Date(a.starts_at).getTime()+5*60000)return {skipped:true};
 const result=await changeAppointmentStatus(db,{owner:business.owner_id,appointmentId,status:'No-show',eventId:randomUUID(),ledgerId:randomUUID(),createdAt:now.toISOString(),source:'automatic-five-minute-no-show'});
 await db.query("INSERT INTO automatic_attendance(appointment_id,owner,status,attempts) VALUES($1,$2,'marked',1) ON CONFLICT(appointment_id) DO UPDATE SET status='marked',detail='',attempts=automatic_attendance.attempts+1,updated_at=now()",[appointmentId,business.owner_id]);
 return result;
}
export async function processAutomaticAttendance(pool,now=new Date()){
 const businesses=(await pool.query("SELECT b.id,b.owner_id,s.data AS config FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.status='active' AND b.auto_no_show_enabled=true")).rows;let marked=0,failed=0;
 for(const business of businesses){
  const zone=kioskTimezone(kioskObject(business.config)),day=kioskDay(now,zone);
  const visits=(await pool.query("SELECT a.id FROM appointments a LEFT JOIN automatic_attendance r ON r.appointment_id=a.id JOIN businesses b ON b.owner_id=a.owner WHERE a.owner=$1 AND a.date<=$2 AND a.status='Confirmed' AND COALESCE(a.data::jsonb->>'sample','false')<>'true' AND ((a.date::date+a.start*interval '1 minute') AT TIME ZONE $3)>=b.auto_no_show_after AND ((a.date::date+a.start*interval '1 minute') AT TIME ZONE $3)<=$4::timestamptz-interval '5 minutes' AND COALESCE(r.attempts,0)<5 ORDER BY a.start,a.id LIMIT 100",[business.owner_id,day,zone,now.toISOString()])).rows;
  for(const visit of visits){const db=await pool.connect();try{await db.query('BEGIN');const result=await markAutomaticNoShow(db,{business,appointmentId:visit.id,now});await db.query('COMMIT');if(!result.skipped)marked++;}catch{await db.query('ROLLBACK');failed++;await db.query("INSERT INTO automatic_attendance(appointment_id,owner,status,attempts,detail) SELECT id,owner,'review',1,'Attendance or membership rules require owner review.' FROM appointments WHERE id=$1 AND owner=$2 ON CONFLICT(appointment_id) DO UPDATE SET status='review',attempts=automatic_attendance.attempts+1,detail=excluded.detail,updated_at=now()",[visit.id,business.owner_id]);}finally{db.release();}}
 }
 return {marked,failed};
}
export function startAutomaticAttendanceWorker(){
 const key=Symbol.for('selahflow.automatic.attendance');if(globalThis[key])return;let busy=false;
 const run=async()=>{if(busy)return;busy=true;try{const result=await processAutomaticAttendance(getPool());if(result.marked||result.failed)console.log('Automatic attendance:',JSON.stringify(result));}catch{console.warn('Automatic attendance temporarily unavailable.');}finally{busy=false;}};
 globalThis[key]=setInterval(run,30000);globalThis[key].unref?.();setTimeout(run,8000).unref?.();console.log('Automatic attendance: five-minute grace period; checking every 30 seconds.');
}
