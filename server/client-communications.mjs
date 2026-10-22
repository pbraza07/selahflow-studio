import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {buildClientDirectory,pendingBookingAsAppointment} from './client-history.mjs';
import {applyClientProfiles} from './client-profile-logic.mjs';
import {loadBusinessEmailBrand} from './business-email-branding.mjs';
import {brandedEmailHtml} from './branded-email.mjs';
import {sendNotificationChannel,validEmail} from './notification-delivery.mjs';
import {tokenHash} from './security.mjs';
const obj=x=>typeof x==='string'?JSON.parse(x):x||{};
export const communicationContactId=(businessId,email)=>createHash('sha256').update(businessId+'|'+String(email).trim().toLowerCase()).digest('hex');
const validId=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x);
export async function communicationBusiness(db,owner){
 const b=(await db.query("SELECT b.id,b.owner_id,b.name,b.slug,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
 if(!b)throw Error('Business workspace unavailable.');return b;
}
/** Current Clients data is the source of truth: no copied address book can restore deleted records. */
export async function communicationContacts(db,business){
 const owner=business.owner_id;
 const [appointments,profiles,requests,members,suppressed]=await Promise.all([
  db.query('SELECT id,date,start,duration,staff,status,data FROM appointments WHERE owner=$1',[owner]),
  db.query('SELECT * FROM business_client_profiles WHERE owner=$1',[owner]),
  db.query("SELECT * FROM booking_requests WHERE owner_id=$1 AND status IN ('pending','declined')",[owner]),
  db.query('SELECT id,member_number,customer_name,customer_email,customer_phone FROM customer_memberships WHERE business_id=$1',[business.id]),
  db.query('SELECT contact_id FROM business_communication_suppressions WHERE business_id=$1',[business.id])
 ]);
 const derived=buildClientDirectory([...appointments.rows,...requests.rows.map(pendingBookingAsAppointment)],obj(business.data),owner);
 // Deleted/archived profiles participate in matching to suppress stale history.
 const records=profiles.rows.map(p=>({...p,archived:p.archived||!!p.deleted_at}));
 const clients=applyClientProfiles(derived,records).clients;
 for(const m of members.rows){
  const virtual='membership-'+m.id;
  const profile=records.find(p=>p.source_key===virtual||p.member_number&&p.member_number===m.member_number);
  if(profile?.archived)continue;
  if(!clients.some(c=>c.id===profile?.id||c.memberNumber&&c.memberNumber===m.member_number||c.name?.trim().toLowerCase()===m.customer_name?.trim().toLowerCase()&&c.email?.trim().toLowerCase()===m.customer_email?.trim().toLowerCase()))
   clients.push({id:profile?.id||virtual,name:profile?.name||m.customer_name,email:profile?profile.email:m.customer_email});
 }
 const groups=new Map(),blocked=new Set(suppressed.rows.map(r=>r.contact_id));let missingEmail=0;
 for(const client of clients){
  const email=String(client.email||'').trim().toLowerCase();if(!validEmail(email)){missingEmail++;continue;}
  const id=communicationContactId(business.id,email),entry=groups.get(id)||{id,email,names:[],sourceIds:[],unsubscribed:blocked.has(id)};
  entry.names=[...new Set([...entry.names,String(client.name||'Client').replace(/[\r\n\u0000-\u001f]/g,' ').trim().slice(0,100)])];entry.sourceIds=[...new Set([...entry.sourceIds,client.id])];groups.set(id,entry);
 }
 return {contacts:[...groups.values()].sort((a,b)=>a.names.join(', ').localeCompare(b.names.join(', '))),clientCount:clients.length,missingEmail,syncedAt:new Date().toISOString()};
}
export function validateCommunication(input){
 const subject=String(input.subject||'').trim(),body=String(input.body||'').trim(),actionLabel=String(input.actionLabel||'').trim(),actionUrl=String(input.actionUrl||'').trim();
 if(!subject||subject.length>180||/[\r\n\u0000-\u001f]/.test(subject))throw Error('Enter an email subject up to 180 characters on one line.');
 if(!body||body.length>10000||/\u0000/.test(body))throw Error('Enter a message up to 10,000 characters.');
 if(actionLabel.length>60||actionUrl.length>2000||!!actionLabel!==!!actionUrl)throw Error('Enter both a button label and secure URL, or leave both blank.');
 if(actionUrl){try{const u=new URL(actionUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{throw Error('Use an HTTPS URL for the email button.');}}
 return {subject,body,actionLabel,actionUrl};
}
const digestBrand=brand=>tokenHash(JSON.stringify({...brand,logo:brand.logo?.toString('base64')||null}));
export function communicationMessage(campaign,recipient,business){
 const personalize=s=>String(s).replace(/\{\{client_name\}\}/g,()=>recipient.names).replace(/\{\{business_name\}\}/g,()=>business.name);
 return {subject:personalize(campaign.subject).replace(/[\r\n\u0000-\u001f]/g,' ').slice(0,180),text:personalize(campaign.body)+'\n\n'+business.name+'\n'+String(obj(business.data).address||'')+'\nYou received this message as a client of '+business.name+'.\nUnsubscribe from business communications: '+recipient.unsubscribe_url,
  actions:[...(campaign.action_url?[{label:campaign.action_label,url:campaign.action_url}]:[]),{label:'Unsubscribe from communications',url:recipient.unsubscribe_url}]};
}
export async function previewCommunication(pool,{owner,input,origin}){
 const content=validateCommunication(input),ids=input.contactIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>500||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)))throw Error('Select between 1 and 500 client email contacts.');
 const host=new URL(origin);if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('Secure application URL required.');
 const db=await pool.connect();try{
  await db.query('BEGIN');const business=await communicationBusiness(db,owner),directory=await communicationContacts(db,business);
  const recipients=ids.map(id=>directory.contacts.find(c=>c.id===id&&!c.unsubscribed));if(recipients.some(c=>!c))throw Error('Selected contacts changed or unsubscribed. Sync contacts and try again.');
  const brand=await loadBusinessEmailBrand(db,{businessId:business.id}),id=randomUUID();
  await db.query('INSERT INTO business_email_campaigns(id,business_id,subject,body,action_label,action_url,brand_digest) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,business.id,content.subject,content.body,content.actionLabel,content.actionUrl,digestBrand(brand)]);
  const campaign={subject:content.subject,body:content.body,action_label:content.actionLabel,action_url:content.actionUrl};let example=null;
  for(const r of recipients){
   const token=randomBytes(32).toString('base64url'),recipient={...r,names:r.names.join(', '),unsubscribe_url:host.origin+'/communications/unsubscribe/'+token};
   await db.query('INSERT INTO business_communication_recipients(id,campaign_id,business_id,contact_id,email,names,source_ids,unsubscribe_hash,unsubscribe_url) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)',[randomUUID(),id,business.id,r.id,r.email,recipient.names,JSON.stringify(r.sourceIds),tokenHash(token),recipient.unsubscribe_url]);
   example??=communicationMessage(campaign,recipient,business);
  }
  await db.query('COMMIT');
  return {id,recipientCount:recipients.length,recipients:recipients.map(r=>({email:r.email,names:r.names})),html:brandedEmailHtml({...example,emailBrand:brand},{logoSrc:brand.logo?'data:image/png;base64,'+brand.logo.toString('base64'):undefined})};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function queueCommunication(pool,{owner,campaignId}){
 if(!validId(campaignId))throw Error('Choose a valid campaign.');const db=await pool.connect();try{
  await db.query('BEGIN');const business=await communicationBusiness(db,owner);
  const c=(await db.query('SELECT * FROM business_email_campaigns WHERE id=$1 AND business_id=$2 FOR UPDATE',[campaignId,business.id])).rows[0];if(!c)throw Error('Campaign not found.');
  if(c.status==='queued'){await db.query('COMMIT');return {ok:true,alreadyQueued:true};}if(c.status!=='draft')throw Error('This campaign was cancelled.');
  if(Date.now()-new Date(c.created_at).getTime()>24*3600000)throw Error('Preview expired. Create a new preview before sending.');
  const brand=await loadBusinessEmailBrand(db,{businessId:business.id});if(digestBrand(brand)!==c.brand_digest)throw Error('Business branding changed. Create a new preview before sending.');
  const current=(await communicationContacts(db,business)).contacts,rows=(await db.query('SELECT * FROM business_communication_recipients WHERE campaign_id=$1 AND business_id=$2',[c.id,business.id])).rows;
  if(!rows.length||rows.some(r=>!current.some(x=>x.id===r.contact_id&&!x.unsubscribed&&x.email===r.email&&x.names.join(', ')===r.names&&JSON.stringify([...x.sourceIds].sort())===JSON.stringify([...obj(r.source_ids)].sort()))))throw Error('Contacts changed. Sync and create a new preview before sending.');
  await db.query("UPDATE business_email_campaigns SET status='queued',queued_at=now() WHERE id=$1",[c.id]);
  await db.query("UPDATE business_communication_recipients SET status='queued',updated_at=now() WHERE campaign_id=$1 AND status='draft'",[c.id]);await db.query('COMMIT');return {ok:true,queued:rows.length};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function communicationCampaigns(db,businessId){return (await db.query(`SELECT c.id,c.subject,c.status,c.created_at,c.queued_at,
 count(r.id)::int AS total,count(r.id) FILTER(WHERE r.status='submitted')::int AS submitted,
 count(r.id) FILTER(WHERE r.status IN ('queued','processing') OR r.status IN ('failed','not_configured') AND r.attempts<3)::int AS pending,
 count(r.id) FILTER(WHERE r.status IN ('failed','not_configured','invalid_destination'))::int AS failed,
 count(r.id) FILTER(WHERE r.status='unknown')::int AS unknown,count(r.id) FILTER(WHERE r.status='skipped')::int AS skipped
 FROM business_email_campaigns c LEFT JOIN business_communication_recipients r ON r.campaign_id=c.id AND r.business_id=c.business_id
 WHERE c.business_id=$1 GROUP BY c.id ORDER BY c.created_at DESC LIMIT 30`,[businessId])).rows;}
export async function cancelCommunication(db,{owner,campaignId}){
 if(!validId(campaignId))throw Error('Choose a valid campaign.');const b=await communicationBusiness(db,owner);
 const result=await db.query("UPDATE business_email_campaigns SET status='cancelled' WHERE id=$1 AND business_id=$2 RETURNING id",[campaignId,b.id]);if(!result.rows.length)throw Error('Campaign not found.');
 await db.query("UPDATE business_communication_recipients SET status='skipped',detail='Cancelled by owner',updated_at=now() WHERE campaign_id=$1 AND business_id=$2 AND status IN ('draft','queued','failed','not_configured')",[campaignId,b.id]);return {ok:true};
}
export async function unsubscribeCommunication(db,token){
 if(typeof token!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(token))return null;
 const r=(await db.query('SELECT business_id,contact_id FROM business_communication_recipients WHERE unsubscribe_hash=$1',[tokenHash(token)])).rows[0];if(!r)return null;
 await db.query('INSERT INTO business_communication_suppressions(business_id,contact_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[r.business_id,r.contact_id]);
 await db.query("UPDATE business_communication_recipients SET status='skipped',detail='Unsubscribed',updated_at=now() WHERE business_id=$1 AND contact_id=$2 AND status IN ('draft','queued','failed','not_configured')",[r.business_id,r.contact_id]);return {ok:true};
}
export async function processCommunicationEmails(pool,{send=sendNotificationChannel,limit=5}={}){
 await pool.query("UPDATE business_communication_recipients SET status='unknown',detail='Delivery outcome unknown; check provider before retrying',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '10 minutes'");
 for(let i=0;i<limit;i++){
  const r=(await pool.query("UPDATE business_communication_recipients SET status='processing',updated_at=now() WHERE id=(SELECT r.id FROM business_communication_recipients r JOIN business_email_campaigns c ON c.id=r.campaign_id AND c.business_id=r.business_id WHERE c.status='queued' AND r.status IN ('queued','failed','not_configured') AND r.attempts<3 AND r.next_attempt_at<=now() ORDER BY r.next_attempt_at,r.id FOR UPDATE OF r SKIP LOCKED LIMIT 1) RETURNING *")).rows[0];if(!r)break;
  try{
   const business=(await pool.query("SELECT b.id,b.owner_id,b.name,s.data FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.id=$1 AND b.status='active'",[r.business_id])).rows[0];
   const c=(await pool.query('SELECT * FROM business_email_campaigns WHERE id=$1 AND business_id=$2',[r.campaign_id,r.business_id])).rows[0];
   const contact=business&&(await communicationContacts(pool,business)).contacts.find(x=>x.id===r.contact_id&&!x.unsubscribed&&x.email===r.email&&x.names.join(', ')===r.names&&JSON.stringify([...x.sourceIds].sort())===JSON.stringify([...obj(r.source_ids)].sort()));
   let result={status:'skipped',detail:'Client removed, edited, archived, unsubscribed or campaign cancelled'};
   if(contact&&c?.status==='queued')result=await send('email',r.email,{...communicationMessage(c,r,business),idempotencyKey:'business-communication-'+r.id,trackAmbiguous:true},undefined,undefined,{businessId:r.business_id});
   const status=['submitted','failed','not_configured','invalid_destination','unknown','skipped'].includes(result.status)?result.status:'unknown';
   await pool.query("UPDATE business_communication_recipients SET status=$1,detail=$2,attempts=attempts+1,next_attempt_at=now()+interval '15 minutes',updated_at=now() WHERE id=$3 AND status='processing'",[status,String(result.detail||'').slice(0,300),r.id]);
  }catch{await pool.query("UPDATE business_communication_recipients SET status='unknown',detail='Delivery outcome unknown; no automatic replay',updated_at=now() WHERE id=$1 AND status='processing'",[r.id]);}
 }
}
