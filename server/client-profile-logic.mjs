import {normalizeClientEmail,normalizeClientName,normalizeClientPhone,isAttended} from './client-history.mjs';
import {dateOnly} from './client-registration-fields.mjs';

const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export function validateClientInput(body){
 const name=clean(body?.name,101),email=clean(body?.email,255),phone=clean(body?.phone,41),notes=clean(body?.notes,1001);
 if(!name||name.length>100)throw Error('Enter a client name (up to 100 characters).');
 if(email&&(email.length>254||!normalizeClientEmail(email)))throw Error('Enter a valid email address.');
 if(phone&&(phone.length>40||!normalizeClientPhone(phone)))throw Error('Enter a valid phone number.');
 if(notes.length>1000)throw Error('Notes cannot exceed 1,000 characters.');
 return {name,email,phone,notes};
}
export function sameClientContact(a,b){
 if(normalizeClientName(a.name)!==normalizeClientName(b.name))return false;
 const aEmail=normalizeClientEmail(a.email),bEmail=normalizeClientEmail(b.email),
       aPhone=normalizeClientPhone(a.phone),bPhone=normalizeClientPhone(b.phone);
 return Boolean((aEmail&&bEmail&&aEmail===bEmail)||(aPhone&&bPhone&&aPhone===bPhone));
}
function freshClient(profile){
 return {id:profile.id,name:profile.name,firstName:profile.first_name||'',lastName:profile.last_name||'',previousMemberNumbers:profile.previous_member_numbers||[],profileUpdatedAt:profile.updated_at instanceof Date?profile.updated_at.toISOString():profile.updated_at||'',email:profile.email||'',phone:profile.phone||'',memberNumber:profile.member_number||undefined,dateOfBirth:dateOnly(profile.date_of_birth)||undefined,notes:profile.notes||'',importColumns:profile.import_columns||{},registrationAnswers:profile.registration_answers||{},registrationFieldLabels:profile.registration_field_labels||{},
  bookedSessions:0,attendedSessions:0,attendanceDays:[],serviceTypes:[],serviceNames:[],
  latestDate:'',history:[],firstBooking:null,latestBookingAnswers:[],managed:true};
}
function visitMetrics(client){
 const history=[...new Map(client.history.map(row=>[row.id,row])).values()];
 history.sort((a,b)=>b.date.localeCompare(a.date)||b.time-a.time);
 client.history=history;
 client.bookedSessions=history.filter(row=>!['Cancelled','No-show','Pending approval','Declined'].includes(row.status)).length;
 client.attendedSessions=history.filter(row=>isAttended(row.status)).length;
 client.attendanceDays=[...new Set(history.filter(row=>isAttended(row.status)).map(row=>row.date).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
 client.serviceNames=[...new Set(history.flatMap(row=>row.serviceNames||[]))].sort((a,b)=>a.localeCompare(b));
 client.serviceTypes=[...new Set(history.flatMap(row=>row.serviceTypes||[]))].sort((a,b)=>a.localeCompare(b));
 client.latestDate=history[0]?.date||'';
 client.firstBooking=[...history].sort((a,b)=>a.date.localeCompare(b.date)||a.time-b.time)[0]||null;
 client.latestBookingAnswers=history.find(row=>row.answers?.length)?.answers||[];
 return client;
}
/** Attach persisted profile edits and manually-added customers to appointment-backed
 * groups, while leaving the original appointment data untouched.
 * Edited clients stay anchored to their original appointment even if later
 * bookings shift the deterministic derived-client hash.
 */
export function applyClientProfiles(derived,profiles){
 const rows=Array.isArray(derived)?derived:[];
 const records=Array.isArray(profiles)?profiles:[];
 const managed=new Map(records.map(p=>[p.id,freshClient(p)]));
 const baseGroups=new Map(records.map(p=>[p.id,p]));
 const detached=[];
 for(const client of rows){
  const anchor=records.find(p=>p.anchor_appointment_id&&client.history?.some(v=>v.id===p.anchor_appointment_id));
  const source=records.find(p=>p.source_key===client.id);
  const member=records.find(p=>p.member_number&&client.memberNumber&&(p.member_number===client.memberNumber||(p.previous_member_numbers||[]).includes(client.memberNumber)));
  const contact=records.find(p=>sameClientContact(p,client));
  const profile=member||anchor||source||contact;
  if(!profile){detached.push({...client,notes:'',managed:false});continue;}
  managed.get(profile.id).history.push(...(client.history||[]));
 }
 const active=[],archived=[];
 for(const profile of records){
  const client=visitMetrics(managed.get(profile.id));
  if(profile.archived)archived.push({id:profile.id,name:client.name,email:client.email,phone:client.phone});
  else active.push(client);
 }
 active.push(...detached);
 active.sort((a,b)=>b.latestDate.localeCompare(a.latestDate)||a.name.localeCompare(b.name));
 archived.sort((a,b)=>a.name.localeCompare(b.name));
 return {clients:active,archived};
}
export function findClientForEdit(clients,id){
 return clients.find(c=>c.id===id)||null;
}
