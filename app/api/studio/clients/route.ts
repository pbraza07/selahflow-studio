import {deleteClientPermanently} from '../../../../server/delete-client.mjs';
import {issueMemberId} from '../../../../server/member-id-policy.mjs';
import {replaceLegacyMemberId} from '../../../../server/replace-legacy-member-id.mjs';
import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {buildClientDirectory,clientWorkbookSheets,pendingBookingAsAppointment} from '../../../../server/client-history.mjs';
import {applyClientProfiles,findClientForEdit,sameClientContact,validateClientInput} from '../../../../server/client-profile-logic.mjs';
import {createClientXlsx} from '../../../../server/client-xlsx.mjs';
import {resolveTheme} from '../../../../server/themes.mjs';
import {registrationAnswerRows,dateOnly} from '../../../../server/client-registration-fields.mjs';
import {customRegistrationFields,validateStandardRegistration} from '../../../../server/registration-questions.mjs';
import {sanitizeBookingAnswers} from '../../../../server/booking-custom-fields.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const validId=(id:unknown)=>typeof id==='string'&&/^[a-f0-9-]{32,36}$/i.test(id);
const membershipClientId=(id:unknown)=>typeof id==='string'&&/^membership-[a-f0-9-]{36}$/i.test(id);
const validClientId=(id:unknown)=>validId(id)||membershipClientId(id);
async function businessFor(owner: string,db:{query:(sql:string,values:unknown[])=>Promise<{rows:any[]}>}){
 const result=await db.query(
  "SELECT b.id,b.slug,b.name,b.status,b.brand_primary,b.brand_background,s.data AS settings_data FROM businesses b JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1",
  [owner]);
 const business=result.rows[0];
 if(!business||business.status!=='active')throw new Error('BUSINESS_UNAVAILABLE');
 return business;
}
async function directory(owner:string,db:{query:(sql:string,values:unknown[])=>Promise<{rows:any[]}>},settings:Record<string,unknown>){
 const [appointments,profiles,requests]=await Promise.all([
  db.query('SELECT id,date,start,duration,staff,status,data FROM appointments WHERE owner=$1 ORDER BY date DESC,start DESC',[owner]),
  db.query('SELECT id,source_key,anchor_appointment_id,name,email,phone,notes,archived,import_columns,registration_answers,registration_field_labels,member_number,date_of_birth,deleted_at FROM business_client_profiles WHERE owner=$1 ORDER BY created_at,id',[owner]),
  db.query("SELECT id,date,staff_id,start_minute,duration,details,status,created_at FROM booking_requests WHERE owner_id=$1 AND status IN ('pending','declined') ORDER BY created_at DESC",[owner])
 ]);
 const derived=buildClientDirectory([...appointments.rows,...requests.rows.map(pendingBookingAsAppointment)],settings,owner);
 const combined=applyClientProfiles(derived,profiles.rows);
 const fields=Array.isArray(settings.bookingCustomFields)?settings.bookingCustomFields:[];
 const members=(await db.query("SELECT m.id,m.customer_name,m.customer_email,m.customer_phone,m.date_of_birth::text AS date_of_birth,m.registration_answers,m.registration_field_labels,m.created_at,m.last_paid_at,m.paid_through,m.price_cents,m.sessions_included,m.sessions_used,m.member_number,m.status,p.name AS membership_name,p.interval_unit,COALESCE(p.badge,g.badge) AS membership_badge FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id LEFT JOIN membership_groups g ON g.id=p.group_id AND g.business_id=m.business_id WHERE b.owner_id=$1 ORDER BY m.created_at DESC",[owner])).rows;
 const memberData=(m:any,client:any={})=>{
  const legacy=client.notes==='Membership registration'&&m.registration_answers&&Object.keys(m.registration_answers).length===0?client.importColumns||{}:{};
  const submitted=Object.keys(m.registration_answers||{}).length?m.registration_answers:legacy;
  return {
   memberNumber:m.member_number||client.memberNumber,
   membershipName:m.membership_name,membershipStatus:m.status,membershipBadge:m.membership_badge||null,
   membershipRegistration:{name:m.customer_name,firstName:String(m.customer_name||'').trim().split(/\s+/)[0]||'',lastName:String(m.customer_name||'').trim().split(/\s+/).slice(1).join(' '),email:m.customer_email,phone:m.customer_phone||'',dateOfBirth:dateOnly(m.date_of_birth),memberNumber:m.member_number||''},
   membershipAnswers:registrationAnswerRows(submitted,m.registration_field_labels,fields),
   membershipDetails:{registeredAt:m.created_at,paidThrough:dateOnly(m.paid_through),lastPaidAt:m.last_paid_at,
    interval:m.interval_unit,priceCents:Number(m.price_cents)||0,
    sessionsIncluded:Number(m.sessions_included)||0,sessionsUsed:Number(m.sessions_used)||0},
   dateOfBirth:client.dateOfBirth||dateOnly(m.date_of_birth),
   phone:client.phone||m.customer_phone||''
  };
 };
 const clients=combined.clients.map((c:any)=>{
  const m=members.find((x:any)=>(x.member_number&&x.member_number===c.memberNumber)||
   (x.customer_name?.trim().toLowerCase()===c.name?.trim().toLowerCase()&&x.customer_email?.toLowerCase()===c.email?.toLowerCase()&&(!c.memberNumber||c.memberNumber===x.member_number)));
  return m?{...c,...memberData(m,c)}:c;
 });
 for(const m of members){
  const virtualId='membership-'+m.id;
  const profile=profiles.rows.find((p:any)=>p.source_key===virtualId);
  // A membership without appointments is still a client card. Its persisted
  // profile is the source of truth when the owner archives/restores it.
  if(profile?.archived&&!profile.deleted_at)continue;
  if(!clients.some((c:any)=>c.memberNumber===m.member_number||(c.name?.trim().toLowerCase()===m.customer_name?.trim().toLowerCase()&&c.email?.toLowerCase()===m.customer_email?.toLowerCase())))
   clients.push({id:profile?.id||virtualId,name:m.customer_name,email:m.customer_email,bookedSessions:0,attendedSessions:0,attendanceDays:[],serviceTypes:[],serviceNames:[],latestDate:'',history:[],firstBooking:null,latestBookingAnswers:[],...memberData(m)});
 }
 return {derived,profiles:profiles.rows,clients,formFields:fields.map((f:any)=>({id:f.id,label:f.label,type:f.type,options:Array.isArray(f.options)?f.options:[]})),registrationConfig:{bookingStandardFields:settings.bookingStandardFields,bookingQuestionOrder:settings.bookingQuestionOrder,bookingCustomFields:settings.bookingCustomFields},archived:combined.archived.filter((c:{id:string})=>!profiles.rows.some((p:any)=>p.id===c.id&&p.deleted_at))};
}
function failure(error:unknown){
 const message=(error as Error).message||'Client operation could not be completed.';
 const status=message==='AUTH_REQUIRED'?401:message==='BUSINESS_UNAVAILABLE'?403:
  /already exists|another client|restore this client|changed|no longer|not found|cancel .*subscription|expire .*checkout|currently being sent|confirm permanent/i.test(message)?409:
  /enter |invalid |exceed|cannot |required|client name/i.test(message)?400:503;
 return Response.json({error:status===503?'Client operation could not be completed.':message==='AUTH_REQUIRED'?'Sign in to manage your clients.':message==='BUSINESS_UNAVAILABLE'?'Business workspace unavailable.':message},{status,headers:noStore});
}
export async function GET(req:Request){
 try{
  const owner=await requireOwner(req);
  const pool=getPool(),business=await businessFor(owner,pool);
  const settings=JSON.parse(business.settings_data||'{}');
  const {clients,archived,formFields,registrationConfig}=await directory(owner,pool,settings);
  const url=new URL(req.url);
  if(url.searchParams.get('export')!=='xlsx')
   return Response.json({clients,archived,formFields,registrationConfig,total:clients.length},{headers:noStore});
  const id=url.searchParams.get('clientId');
  if(id&&!validId(id))return Response.json({error:'Invalid client.'},{status:400,headers:noStore});
  const selected=id?clients.filter(c=>c.id===id):clients;
  if(id&&!selected.length)return Response.json({error:'This client is not in the current business.'},{status:404,headers:noStore});
  const theme=resolveTheme(settings.theme,business.brand_primary,business.brand_background);
  const xlsx=createClientXlsx(clientWorkbookSheets(selected),theme.colors);
  const slug=String(business.slug||'business').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);
  const suffix=id?'client-'+id.slice(0,10):'all-clients';
  const date=new Date().toISOString().slice(0,10);
  return new Response(new Uint8Array(xlsx),{headers:{
   ...noStore,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
   'Content-Disposition':'attachment; filename="SelahFlow-'+slug+'-'+suffix+'-'+date+'.xlsx"'
  }});
 }catch(error){return failure(error);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403,headers:noStore});
 let raw='';
 try{
  raw=await req.text();
  if(raw.length>5000)throw Error('Client request exceeds the allowed size.');
  const body=JSON.parse(raw);
  if(!['create','update','archive','restore','deleteArchived','delete','replaceLegacyId'].includes(body?.action))throw Error('Invalid client action.');
  const owner=await requireOwner(req),pool=getPool(),db=await pool.connect();
  try{
   await db.query('BEGIN');
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':clients']);
   const business=await businessFor(owner,db);
   const settings=JSON.parse(business.settings_data||'{}');
   const result=await directory(owner,db,settings);
   const id=body.clientId;
   const selected=validClientId(id)?result.clients.find(c=>c.id===id):null;
   const archived=validId(id)?result.archived.find(c=>c.id===id):null;
   const profile=validId(id)?result.profiles.find(p=>p.id===id):null;
   const client=selected||archived;
   let responseId=id;
   if(body.action==='replaceLegacyId'){
    if(!selected||body.oldMemberNumber!==selected.memberNumber)throw Error('This registration changed. Refresh before continuing.');
    const replacement=await replaceLegacyMemberId(db,{owner,businessId:business.id,client:selected});
    await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'member_id_replaced',$4)",[randomUUID(),owner,new Date().toISOString(),JSON.stringify(replacement)]);
   }else if(body.action==='create'||body.action==='update'){
    if(body.action==='update'&&!selected)throw Error('This client was changed or no longer exists. Refresh your directory.');
    validateStandardRegistration(settings,'booking',body);
    const input=validateClientInput({...body,name:(String(body.firstName||'').trim()+' '+String(body.lastName||'').trim()).trim()});
    const dateOfBirth=String(body.dateOfBirth||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)||!Number.isFinite(Date.parse(dateOfBirth))||dateOfBirth>new Date().toISOString().slice(0,10))throw Error('Enter a valid date of birth.');
    const requested=String(body.memberNumber||'').trim().toUpperCase();
    if(body.action==='update'&&selected?.memberNumber&&requested&&requested!==selected.memberNumber)throw Error('Existing membership IDs cannot be changed.');
    const memberNumber=body.action==='update'&&selected?.memberNumber?selected.memberNumber:await issueMemberId(db,{businessId:business.id,name:input.name,dateOfBirth,requested});
    const fields=customRegistrationFields(settings,'booking',null);
    const registrationAnswers=sanitizeBookingAnswers(fields,body.customAnswers||{});
    const registrationFieldLabels=Object.fromEntries(fields.map((field:any)=>[field.id,field.label]));
    const duplicate=result.clients.find(c=>c.id!==id&&sameClientContact(c,input));
    if(duplicate)throw Error('Another client with that same name and email or phone already exists. Edit that client instead.');
    if(body.action==='create'){
     const removed=result.archived.find(c=>sameClientContact(c,input));
     if(removed)throw Error('This client was previously removed. Restore this client from the Removed clients section.');
     responseId=randomUUID();
     await db.query('INSERT INTO business_client_profiles(id,owner,name,email,phone,notes,member_number,date_of_birth,registration_answers,registration_field_labels) VALUES($1,$2,$3,$4,$5,$6,$7,$8::date,$9::jsonb,$10::jsonb)',
      [responseId,owner,input.name,input.email,input.phone,input.notes,memberNumber||null,dateOfBirth,JSON.stringify(registrationAnswers),JSON.stringify(registrationFieldLabels)]);
    }else if(profile){
     await db.query('UPDATE business_client_profiles SET name=$1,email=$2,phone=$3,notes=$4,member_number=$5,date_of_birth=$6::date,registration_answers=$7::jsonb,registration_field_labels=$8::jsonb,updated_at=now() WHERE owner=$9 AND id=$10',
      [input.name,input.email,input.phone,input.notes,memberNumber||null,dateOfBirth,JSON.stringify(registrationAnswers),JSON.stringify(registrationFieldLabels),owner,id]);
    }else{
     // An appointment-derived card is now a managed profile. Anchor by a
     // historical appointment ID so updating its name never changes history.
     responseId=randomUUID();
     const sourceAnchor=selected.history?.[selected.history.length-1]?.id||null;
     await db.query(
      'INSERT INTO business_client_profiles(id,owner,source_key,anchor_appointment_id,name,email,phone,notes,member_number,date_of_birth,registration_answers,registration_field_labels) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::jsonb,$12::jsonb)',
      [responseId,owner,id,sourceAnchor,input.name,input.email,input.phone,input.notes,memberNumber||null,dateOfBirth,JSON.stringify(registrationAnswers),JSON.stringify(registrationFieldLabels)]);
    }
   }else if(body.action==='archive'||body.action==='delete'){
    if(!client||body.confirmPhrase!=='DELETE CLIENT')throw Error('Confirm permanent client deletion.');
    await deleteClientPermanently(db,{owner,businessId:business.id,client});
   }else if(body.action==='deleteArchived'){
    const ids=body.clientIds;
    if(!Array.isArray(ids)||ids.length<1||ids.length>2000||ids.some((value:unknown)=>!validId(value))||new Set(ids).size!==ids.length)throw Error('Select valid removed clients.');
    if(body.confirmPhrase!=='DELETE REMOVED CLIENTS')throw Error('Enter DELETE REMOVED CLIENTS to confirm.');
    if(ids.some((value:string)=>!result.archived.some((item:{id:string})=>item.id===value)))throw Error('One or more selected clients are not in the removed list.');
    for(const value of ids){
     const saved=result.profiles.find((p:any)=>p.id===value);
     const history=result.derived.filter((c:any)=>c.id===saved?.source_key||c.history?.some((r:any)=>r.id===saved?.anchor_appointment_id)||saved?.member_number&&c.memberNumber===saved.member_number||sameClientContact(c,saved)).flatMap((c:any)=>c.history||[]);
     await deleteClientPermanently(db,{owner,businessId:business.id,client:{...result.archived.find((c:any)=>c.id===value),memberNumber:saved?.member_number,dateOfBirth:dateOnly(saved?.date_of_birth),history}});
    }
    responseId='deleted';
   }else if(body.action==='restore'){
    if(!profile||!profile.archived||!archived)throw Error('Removed client not found.');
    const duplicate=result.clients.find(c=>sameClientContact(c,profile));
    if(duplicate)throw Error('Another client with that name and contact already exists.');
    await db.query('UPDATE business_client_profiles SET archived=FALSE,updated_at=now() WHERE owner=$1 AND id=$2',[owner,id]);
   }
   await db.query('COMMIT');
   return Response.json({ok:true,clientId:responseId},{headers:noStore});
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }catch(error){return failure(error);}
}
