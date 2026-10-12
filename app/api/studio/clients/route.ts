import {randomUUID} from 'node:crypto';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin} from '../../../../server/security.mjs';
import {buildClientDirectory,clientWorkbookSheets,pendingBookingAsAppointment} from '../../../../server/client-history.mjs';
import {applyClientProfiles,findClientForEdit,sameClientContact,validateClientInput} from '../../../../server/client-profile-logic.mjs';
import {createClientXlsx} from '../../../../server/client-xlsx.mjs';
import {resolveTheme} from '../../../../server/themes.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const validId=(id:unknown)=>typeof id==='string'&&/^[a-f0-9-]{32,36}$/i.test(id);
async function businessFor(owner: string,db:{query:(sql:string,values:unknown[])=>Promise<{rows:any[]}>}){
 const result=await db.query(
  "SELECT b.slug,b.name,b.status,b.brand_primary,b.brand_background,s.data AS settings_data FROM businesses b JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1",
  [owner]);
 const business=result.rows[0];
 if(!business||business.status!=='active')throw new Error('BUSINESS_UNAVAILABLE');
 return business;
}
async function directory(owner:string,db:{query:(sql:string,values:unknown[])=>Promise<{rows:any[]}>},settings:Record<string,unknown>){
 const [appointments,profiles,requests]=await Promise.all([
  db.query('SELECT id,date,start,duration,staff,status,data FROM appointments WHERE owner=$1 ORDER BY date DESC,start DESC',[owner]),
  db.query('SELECT id,source_key,anchor_appointment_id,name,email,phone,notes,archived,import_columns,deleted_at FROM business_client_profiles WHERE owner=$1 ORDER BY created_at,id',[owner]),
  db.query("SELECT id,date,staff_id,start_minute,duration,details,status,created_at FROM booking_requests WHERE owner_id=$1 AND status IN ('pending','declined') ORDER BY created_at DESC",[owner])
 ]);
 const derived=buildClientDirectory([...appointments.rows,...requests.rows.map(pendingBookingAsAppointment)],settings,owner);
 const combined=applyClientProfiles(derived,profiles.rows);
 const members=(await db.query("SELECT m.id,m.customer_name,m.customer_email,m.member_number,m.status,p.name AS membership_name FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id WHERE b.owner_id=$1",[owner])).rows;
 const clients=combined.clients.map((c:any)=>{const m=members.find((x:any)=>x.customer_email?.toLowerCase()===c.email?.toLowerCase());return m?{...c,memberNumber:m.member_number,membershipName:m.membership_name,membershipStatus:m.status}:c;});
 for(const m of members){if(!clients.some((c:any)=>c.email?.toLowerCase()===m.customer_email?.toLowerCase()))clients.push({id:'membership-'+m.id,name:m.customer_name,email:m.customer_email,phone:'',bookedSessions:0,attendedSessions:0,attendanceDays:[],serviceTypes:[],serviceNames:[],latestDate:'',history:[],memberNumber:m.member_number,membershipName:m.membership_name,membershipStatus:m.status});}
 return {derived,profiles:profiles.rows,clients,archived:combined.archived.filter((c:{id:string})=>!profiles.rows.some((p:any)=>p.id===c.id&&p.deleted_at))};
}
function failure(error:unknown){
 const message=(error as Error).message||'Client operation could not be completed.';
 const status=message==='AUTH_REQUIRED'?401:message==='BUSINESS_UNAVAILABLE'?403:
  /already exists|another client|restore this client|changed|no longer|not found/i.test(message)?409:
  /enter |invalid |exceed|cannot |required|client name/i.test(message)?400:503;
 return Response.json({error:status===503?'Client operation could not be completed.':message==='AUTH_REQUIRED'?'Sign in to manage your clients.':message==='BUSINESS_UNAVAILABLE'?'Business workspace unavailable.':message},{status,headers:noStore});
}
export async function GET(req:Request){
 try{
  const owner=await requireOwner(req);
  const pool=getPool(),business=await businessFor(owner,pool);
  const settings=JSON.parse(business.settings_data||'{}');
  const {clients,archived}=await directory(owner,pool,settings);
  const url=new URL(req.url);
  if(url.searchParams.get('export')!=='xlsx')
   return Response.json({clients,archived,total:clients.length},{headers:noStore});
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
  if(!['create','update','archive','restore','deleteArchived'].includes(body?.action))throw Error('Invalid client action.');
  const owner=await requireOwner(req),pool=getPool(),db=await pool.connect();
  try{
   await db.query('BEGIN');
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':clients']);
   const business=await businessFor(owner,db);
   const settings=JSON.parse(business.settings_data||'{}');
   const result=await directory(owner,db,settings);
   const id=body.clientId;
   const selected=validId(id)?result.clients.find(c=>c.id===id):null;
   const archived=validId(id)?result.archived.find(c=>c.id===id):null;
   const profile=validId(id)?result.profiles.find(p=>p.id===id):null;
   const client=selected||archived;
   let responseId=id;
   if(body.action==='create'||body.action==='update'){
    if(body.action==='update'&&!selected)throw Error('This client was changed or no longer exists. Refresh your directory.');
    const input=validateClientInput(body);
    const duplicate=result.clients.find(c=>c.id!==id&&sameClientContact(c,input));
    if(duplicate)throw Error('Another client with that same name and email or phone already exists. Edit that client instead.');
    if(body.action==='create'){
     const removed=result.archived.find(c=>sameClientContact(c,input));
     if(removed)throw Error('This client was previously removed. Restore this client from the Removed clients section.');
     responseId=randomUUID();
     await db.query('INSERT INTO business_client_profiles(id,owner,name,email,phone,notes) VALUES($1,$2,$3,$4,$5,$6)',
      [responseId,owner,input.name,input.email,input.phone,input.notes]);
    }else if(profile){
     await db.query('UPDATE business_client_profiles SET name=$1,email=$2,phone=$3,notes=$4,updated_at=now() WHERE owner=$5 AND id=$6',
      [input.name,input.email,input.phone,input.notes,owner,id]);
    }else{
     // An appointment-derived card is now a managed profile. Anchor by a
     // historical appointment ID so updating its name never changes history.
     responseId=randomUUID();
     const sourceAnchor=selected.history?.[selected.history.length-1]?.id||null;
     await db.query(
      'INSERT INTO business_client_profiles(id,owner,source_key,anchor_appointment_id,name,email,phone,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [responseId,owner,id,sourceAnchor,input.name,input.email,input.phone,input.notes]);
    }
   }else if(body.action==='archive'){
    if(!selected)throw Error('Client not found or already removed.');
    if(profile){
     await db.query('UPDATE business_client_profiles SET archived=TRUE,updated_at=now() WHERE owner=$1 AND id=$2',[owner,id]);
    }else{
     responseId=randomUUID();
     const sourceAnchor=selected.history?.[selected.history.length-1]?.id||null;
     await db.query(
      'INSERT INTO business_client_profiles(id,owner,source_key,anchor_appointment_id,name,email,phone,notes,archived) VALUES($1,$2,$3,$4,$5,$6,$7,$8,TRUE)',
      [responseId,owner,id,sourceAnchor,selected.name,selected.email,selected.phone,selected.notes||'']);
    }
   }else if(body.action==='deleteArchived'){
    const ids=body.clientIds;
    if(!Array.isArray(ids)||ids.length<1||ids.length>2000||ids.some((value:unknown)=>!validId(value))||new Set(ids).size!==ids.length)throw Error('Select valid removed clients.');
    if(body.confirmPhrase!=='DELETE REMOVED CLIENTS')throw Error('Enter DELETE REMOVED CLIENTS to confirm.');
    if(ids.some((value:string)=>!result.archived.some((item:{id:string})=>item.id===value)))throw Error('One or more selected clients are not in the removed list.');
    await db.query("UPDATE business_client_profiles SET deleted_at=now(),name='Deleted client',email='',phone='',notes='',import_columns='{}'::jsonb,updated_at=now() WHERE owner=$1 AND id=ANY($2::text[]) AND archived=TRUE AND deleted_at IS NULL",[owner,ids]);
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
