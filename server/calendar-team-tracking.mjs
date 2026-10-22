import {validAssignmentDate} from './team-occurrence-assignments.mjs';
import {sessionsForDate} from './session-scheduling.mjs';
import {sessionTeamDefaults} from './team-booking-policy.mjs';
const object=value=>typeof value==='string'?JSON.parse(value):value||{};
export function trackingDateRange(from,to){
 if(!validAssignmentDate(from)||!validAssignmentDate(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>92)throw Error('Choose a valid date range of up to 93 days.');
 return Array.from({length:(Date.parse(to)-Date.parse(from))/86400000+1},(_,i)=>new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10));
}
export function calendarTrackingRows(config,dates,appointments,assignments,appointmentAssignments){
 const rows=[];
 for(const date of dates)for(const session of sessionsForDate(config,date)){
  const assigned=assignments.find(a=>a.scope==='occurrence'&&a.session_id===session.id&&a.session_date===date&&a.start_minute===session.start)||assignments.find(a=>a.scope==='series'&&a.session_id===(session.seriesId||session.id));
  rows.push({kind:'session',id:session.id,date,start:session.start,duration:session.duration,name:(config.services||[]).find(s=>s.id===session.service)?.name||'Retained session',staffIds:assigned?assigned.staff_ids:sessionTeamDefaults(config,session),note:assigned?.note||'',assignmentSource:assigned?'Saved assignment':'Default hosts',status:'Configured session'});
 }
 for(const appointment of appointments){
  const data=object(appointment.data),assigned=appointmentAssignments.find(a=>a.appointment_id===appointment.id);
  const services=Array.isArray(data.services)?data.services:[];
  rows.push({kind:'appointment',id:appointment.id,date:appointment.date,start:appointment.start,duration:appointment.duration,name:services.join(', ')||(data.serviceIds||[]).map(id=>(config.services||[]).find(s=>s.id===id)?.name||'Retained service').join(', ')||'Service appointment',clientName:data.name||'',staffIds:assigned?assigned.staff_ids:Array.isArray(data.hostTeamIds)&&data.hostTeamIds.length?data.hostTeamIds:[appointment.staff].filter(Boolean),note:assigned?.note||'',assignmentSource:assigned?'Saved assignment':'Booking hosts',status:appointment.status});
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.start-b.start||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
}
export async function saveAppointmentTeam(db,{businessId,config,input}){
 if(typeof input.appointmentId!=='string'||!input.appointmentId||!Array.isArray(input.staffIds)||input.staffIds.length>100||input.staffIds.some(id=>!(config.staff||[]).some(s=>s.id===id)))throw Error('Choose this business’s appointment and team members.');
 const result=await db.query(`INSERT INTO appointment_team_assignments(business_id,appointment_id,staff_ids,note)
 SELECT b.id,a.id,$3::jsonb,$4 FROM businesses b JOIN appointments a ON a.owner=b.owner_id WHERE b.id=$1 AND a.id=$2 AND b.status='active'
 ON CONFLICT(business_id,appointment_id) DO UPDATE SET staff_ids=excluded.staff_ids,note=excluded.note,updated_at=now() RETURNING appointment_id`,[businessId,input.appointmentId,JSON.stringify([...new Set(input.staffIds)]),String(input.note||'').slice(0,1000)]);
 if(!result.rows.length)throw Error('This appointment no longer exists in this business. Refresh the calendar.');
 return {ok:true};
}
