import {getPool} from './database.mjs';
import {configured,sendWebPush} from './push-crypto.mjs';
import {businessDeviceName} from './business-device-name.mjs';

export async function teamBookingNotifications(pool,account){
 const rows=(await pool.query(`SELECT j.appointment_id AS id,j.created_at::text AS created_at,(j.read_at IS NULL) AS unread,a.date,a.start,a.data
  FROM team_booking_push_jobs j JOIN appointments a ON a.id=j.appointment_id AND a.owner=$2
  LEFT JOIN appointment_team_assignments direct ON direct.appointment_id=a.id AND direct.business_id=$3
  LEFT JOIN session_team_occurrences occurrence ON occurrence.business_id=$3 AND occurrence.session_id=a.data::jsonb->>'sessionId' AND occurrence.session_date=a.date AND occurrence.start_minute=a.start
  LEFT JOIN session_team_assignments series ON series.business_id=$3 AND series.session_id=regexp_replace(a.data::jsonb->>'sessionId','__[0-9]{8}$','')
  WHERE j.account_id=$1 AND a.status NOT IN ('Cancelled','No-show') AND (a.staff=$4 OR COALESCE(direct.staff_ids,'[]'::jsonb) ? $4 OR COALESCE(occurrence.staff_ids,series.staff_ids,'[]'::jsonb) ? $4 OR COALESCE(a.data::jsonb->'hostTeamIds','[]'::jsonb) ? $4)
  ORDER BY j.created_at DESC LIMIT 100`,[account.id,account.owner_id,account.business_id,account.staff_id])).rows;
 const config=JSON.parse(account.config||'{}'),profile=account.profile||{},member=profile.name||config.staff?.find(s=>s.id===account.staff_id)?.name||'Team member';
 return rows.map(row=>{let data={};try{data=JSON.parse(row.data||'{}');}catch{}return {id:row.id,createdAt:row.created_at,unread:row.unread,date:row.date,start:row.start,teamMember:member,customerName:String(data.name||data.customerName||'Client').slice(0,100),services:Array.isArray(data.services)?data.services.slice(0,8).map(x=>String(x).slice(0,100)):[]};});
}
export async function markTeamBookingNotificationsRead(pool,account,ids){
 if(!ids.length)return;
 await pool.query("UPDATE team_booking_push_jobs j SET read_at=COALESCE(j.read_at,now()) FROM appointments a WHERE j.account_id=$1 AND j.appointment_id=a.id AND a.owner=$2 AND j.appointment_id=ANY($3::text[])",[account.id,account.owner_id,ids]);
}
/** Only appointment-triggered jobs exist here; settings/time-off changes never enqueue. */
export async function deliverTeamBookingPush(pool,{enabled=configured(),send=sendWebPush}={}){
 if(!enabled)return {processed:0};let processed=0;
 for(let i=0;i<30;i++){
 const job=(await pool.query("UPDATE team_booking_push_jobs SET status='sending' WHERE (appointment_id,account_id) IN (SELECT appointment_id,account_id FROM team_booking_push_jobs WHERE status='pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *")).rows[0];if(!job)break;
 try{
 const r=(await pool.query("SELECT a.owner,a.date,a.start,a.staff,a.data,a.status,t.business_id,t.staff_id,t.active,b.name,b.status AS business_status,s.data AS settings FROM appointments a JOIN team_accounts t ON t.id=$2 JOIN businesses b ON b.id=t.business_id AND b.owner_id=a.owner JOIN settings s ON s.owner=b.owner_id WHERE a.id=$1",[job.appointment_id,job.account_id])).rows[0];
 const cfg=r?JSON.parse(r.settings):{},data=r?JSON.parse(r.data):{};
 const assignment=r?(await pool.query("SELECT 1 FROM appointment_team_assignments WHERE business_id=$1 AND appointment_id=$2 AND staff_ids ? $3 UNION ALL SELECT 1 FROM session_team_occurrences WHERE business_id=$1 AND session_id=$4 AND session_date=$5 AND start_minute=$6 AND staff_ids ? $3 UNION ALL SELECT 1 FROM session_team_assignments WHERE business_id=$1 AND session_id=regexp_replace($4,'__[0-9]{8}$','') AND staff_ids ? $3 LIMIT 1",[r.business_id,job.appointment_id,r.staff_id,data.sessionId||'',r.date,r.start])).rows.length:false;
 if(!r||!r.active||r.business_status!=='active'||['Cancelled','No-show','Completed'].includes(r.status)||!cfg.staff?.some(s=>s.id===r.staff_id)||r.staff!==r.staff_id&&!data.hostTeamIds?.includes(r.staff_id)&&!assignment){await pool.query("UPDATE team_booking_push_jobs SET status='skipped' WHERE appointment_id=$1 AND account_id=$2",[job.appointment_id,job.account_id]);continue;}
 const subscriptions=(await pool.query('SELECT id,endpoint,p256dh,auth FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=$2 LIMIT 10',[r.business_id,'team-account:'+job.account_id])).rows;
 let sent=false,failed=false;
 for(const s of subscriptions){const result=await send({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},{title:businessDeviceName(r.name),body:'Appointment scheduled · '+r.date+' at '+String(Math.floor(r.start/60)).padStart(2,'0')+':'+String(r.start%60).padStart(2,'0')+' Eastern. Open your calendar for details.',url:'/team/workspace',tag:'team-booking-'+job.appointment_id+'-'+job.account_id,businessId:r.business_id});if(result.status==='submitted')sent=true;else failed=true;if(['gone','invalid_subscription'].includes(result.status))await pool.query('DELETE FROM business_push_subscriptions WHERE id=$1',[s.id]);}
 await pool.query('UPDATE team_booking_push_jobs SET status=$3 WHERE appointment_id=$1 AND account_id=$2',[job.appointment_id,job.account_id,sent?'sent':failed?'failed':'skipped']);processed++;
 }catch{await pool.query("UPDATE team_booking_push_jobs SET status='failed' WHERE appointment_id=$1 AND account_id=$2",[job.appointment_id,job.account_id]);}
 }
 return {processed};
}
export function startTeamBookingPushWorker(){const key=Symbol.for('selahflow.team.booking.push');if(globalThis[key])return;let busy=false;const run=async()=>{if(busy)return;busy=true;try{await deliverTeamBookingPush(getPool());}catch{console.warn('Team booking push sweep unavailable.');}finally{busy=false;}};globalThis[key]=setInterval(run,10000);globalThis[key].unref?.();setTimeout(run,1000).unref?.();}
