import {randomUUID} from 'node:crypto';
import {teamIdentity,accountAppointments,portalError} from './team-portal.mjs';
import {changeAppointmentStatus} from './appointment-membership-usage.mjs';

const closed=new Set(['Cancelled','Completed','No-show']);
const fields=['date','start','duration','staff','status'];
const parse=v=>typeof v==='string'?JSON.parse(v):v||{};
const shape=a=>Object.fromEntries(fields.map(k=>[k,a[k]]));
const summary=a=>{const d=parse(a.data);return {...shape(a),customerName:String(d.name||d.customerName||'Customer').slice(0,100),services:Array.isArray(d.services)?d.services.slice(0,10):[]};};
export async function listTeamCancellations(pool,account){
 return (await pool.query('SELECT id,appointment_id,reason,snapshot,status,created_at,reviewed_at FROM team_cancellation_requests WHERE business_id=$1 AND requester_id=$2 ORDER BY created_at DESC LIMIT 100',[account.business_id,account.id])).rows;
}
export async function listOwnerCancellations(pool,owner){
 return (await pool.query("SELECT r.*,a.status AS appointment_status,a.data::jsonb->>'paymentStatus' AS payment_status FROM team_cancellation_requests r LEFT JOIN appointments a ON a.id=r.appointment_id AND a.owner=r.owner_id JOIN businesses b ON b.id=r.business_id WHERE r.owner_id=$1 AND b.owner_id=$1 AND b.status='active' ORDER BY (r.status='pending') DESC,r.created_at DESC LIMIT 100",[owner])).rows;
}
export async function requestTeamCancellation(pool,req,input){
 if(typeof input.appointmentId!=='string'||!input.appointmentId||input.appointmentId.length>120||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)throw portalError('Choose an appointment and enter a reason of up to 500 characters.');
 const db=await pool.connect();try{await db.query('BEGIN');
 // Refresh authenticated access inside the schedule transaction, including billing/rotation rules.
 const a=await teamIdentity(db,req);
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[a.owner_id+':schedule']);
 await db.query('SELECT id FROM team_accounts WHERE id=$1 FOR SHARE',[a.id]);
 const current=await teamIdentity(db,req);
 const ap=(await db.query('SELECT * FROM appointments WHERE owner=$1 AND id=$2 FOR UPDATE',[current.owner_id,input.appointmentId])).rows[0];
 if(!ap||!(await accountAppointments(db,current)).some(x=>x.id===ap.id))throw portalError('Choose an appointment assigned to you.',403);
 if(closed.has(ap.status))throw portalError('This appointment is already closed.',409);
 const prior=(await db.query("SELECT id FROM team_cancellation_requests WHERE business_id=$1 AND appointment_id=$2 AND status='pending'",[current.business_id,ap.id])).rows[0];
 if(prior){await db.query('COMMIT');return {ok:true,id:prior.id,alreadyPending:true};}
 const staff=parse(current.config).staff.find(s=>s.id===current.staff_id),id=randomUUID();
 await db.query('INSERT INTO team_cancellation_requests(id,business_id,owner_id,appointment_id,requester_id,staff_id,staff_name,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[id,current.business_id,current.owner_id,ap.id,current.id,current.staff_id,staff.name,input.reason.trim(),JSON.stringify(summary(ap))]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'team_cancellation_requested',$4)",[randomUUID(),current.owner_id,new Date().toISOString(),JSON.stringify({requestId:id,appointment:ap.id,actor:current.id})]);
 await db.query('COMMIT');return {ok:true,id};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function reviewTeamCancellation(pool,owner,input){
 if(typeof input.id!=='string'||!/^[a-f0-9-]{36}$/i.test(input.id)||typeof input.accept!=='boolean'||input.accept&&input.confirmed!==true)throw portalError('Confirm your cancellation decision.',400);
 const db=await pool.connect();try{await db.query('BEGIN');
 const b=(await db.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];if(!b)throw portalError('Business unavailable.',403);
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':schedule']);
 const r=(await db.query('SELECT * FROM team_cancellation_requests WHERE id=$1 AND owner_id=$2 AND business_id=$3 FOR UPDATE',[input.id,owner,b.id])).rows[0];if(!r)throw portalError('Cancellation request unavailable.',404);
 const status=input.accept?'approved':'declined';
 if(r.status!=='pending'){if(r.status!==status)throw portalError('This request has already been reviewed.',409);await db.query('COMMIT');return {ok:true,alreadyProcessed:true};}
 if(input.accept){
  const ap=(await db.query('SELECT * FROM appointments WHERE owner=$1 AND id=$2 FOR UPDATE',[owner,r.appointment_id])).rows[0];
  if(!ap||closed.has(ap.status)||fields.some(k=>ap[k]!==parse(r.snapshot)[k]))throw portalError('This appointment changed or closed. Decline this request and ask the team member to submit a new one if needed.',409);
  // An existing Checkout/Terminal attempt must be reconciled first; cancellation never moves money.
  if((await db.query("SELECT 1 FROM booking_payments WHERE business_id=$1 AND booking_id=$2 AND status='pending' AND (stripe_checkout_session_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL OR terminal_payment_intent_id IS NOT NULL)",[b.id,ap.id])).rows.length)throw portalError('Check or cancel the open card payment before approving this cancellation.',409);
  const result=await changeAppointmentStatus(db,{owner,appointmentId:ap.id,status:'Cancelled',eventId:randomUUID(),ledgerId:randomUUID(),createdAt:new Date().toISOString()});
  if(result.notFound)throw portalError('Appointment unavailable.',409);
 }
 await db.query('UPDATE team_cancellation_requests SET status=$1,reviewed_by=$2,reviewed_at=now(),owner_read_at=COALESCE(owner_read_at,now()) WHERE id=$3',[status,owner,r.id]);
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'team_cancellation_reviewed',$4)",[randomUUID(),owner,new Date().toISOString(),JSON.stringify({requestId:r.id,appointment:r.appointment_id,status,actor:owner})]);
 await db.query('COMMIT');return {ok:true,status};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
