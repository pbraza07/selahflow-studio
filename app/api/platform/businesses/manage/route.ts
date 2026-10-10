import {randomBytes,randomUUID} from 'node:crypto';
import {getPool} from '../../../../../server/database.mjs';
import {requireOwner} from '../../../../../lib/auth';
import {hashPassword,validOrigin} from '../../../../../server/security.mjs';
import {getPlatformRole} from '../../../../../server/platform-roles.mjs';
import {isReservedBusinessSlug} from '../../../../../server/route-slugs.mjs';
import {BUSINESS_INDUSTRIES,canonicalState} from '../../../../../lib/business-options';
import {defaultSettings} from '../../../../../lib/defaults';
import {validateManagedBusiness,canChangeManagedStatus,canArchiveBusiness,validateEmailChangeConfirmation} from '../../../../../server/platform-business-management.mjs';

export const runtime='nodejs';export const dynamic='force-dynamic';
const h={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const industries=BUSINESS_INDUSTRIES.map(([id])=>id) as string[];
const idOk=(v:unknown)=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
const loggable=(row:any)=>row?{
 id:row.id,name:row.name,slug:row.slug,industry:row.industry,description:row.description,
 city:row.city,region:row.region,status:row.status,is_listed:row.is_listed,owner_id:row.owner_id
}:null;
function failure(e:unknown){
 const msg=(e as Error).message||'Unable to manage business.';
 const status=msg==='AUTH_REQUIRED'?401:msg==='FORBIDDEN'?403:
  /already|exists|reserved|active paid|payment|archiv|conflict|changed/i.test(msg)?409:
  /invalid|enter|choose|requires|cannot|only|confirm|valid|not found/i.test(msg)?400:503;
 return Response.json({error:msg==='AUTH_REQUIRED'?'Please sign in.':msg==='FORBIDDEN'?'Platform administrator access required.':status===503?'Business operation unavailable.':msg},{status,headers:h});
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers:h});
 let client:any;
 try{
  const pool=getPool(),actor=await requireOwner(req),role=await getPlatformRole(pool,actor);
  if(!role)throw Error('FORBIDDEN');
  const raw=await req.text();if(raw.length>8000)throw Error('Invalid business request size.');
  const payload=JSON.parse(raw),action=payload.action;
  if(!['create','edit','archive','restore','resetPassword','changeOwnerEmail'].includes(action))throw Error('Invalid business operation.');
  client=await pool.connect();
  await client.query('BEGIN');
  if(action==='create'){
   const input=validateManagedBusiness(payload,industries,[]);
   if(isReservedBusinessSlug(input.slug))throw Error('This business booking URL is reserved.');
   const ownerEmail=String(payload.ownerEmail||'').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)||ownerEmail.length>254)throw Error('Enter a valid owner email.');
   const collision=await client.query('SELECT id FROM users WHERE email=$1',[ownerEmail]);
   if(collision.rowCount)throw Error('This owner email already exists. Use a new business owner email or the existing business account.');
   const ownerId=randomUUID(),businessId=randomUUID(),tempPassword=randomBytes(18).toString('base64url');
   const pending=role!=='primary'||payload.activateImmediately!==true;
   const status=pending?'pending':'active';
   const config={...structuredClone(defaultSettings),name:input.name,tagline:input.industry,
    services:[],staff:[],products:[],phone:'',address:'',timezone:'America/New_York',
    greeting:'Welcome! How can we help?'};
   await client.query('INSERT INTO users(id,email,password_hash,must_change_password) VALUES($1,$2,$3,TRUE)',
    [ownerId,ownerEmail,hashPassword(tempPassword)]);
   await client.query(
    'INSERT INTO businesses(id,owner_id,slug,name,industry,description,city,region,status,is_listed,listing_requested) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE)',
    [businessId,ownerId,input.slug,input.name,input.industry,input.description,input.city,input.region,status,!pending]);
   await client.query("INSERT INTO business_memberships(business_id,user_id,role) VALUES($1,$2,'owner')",[businessId,ownerId]);
   await client.query("INSERT INTO business_subscriptions(business_id,plan_code,status) VALUES($1,'free','active')",[businessId]);
   await client.query('INSERT INTO settings(owner,data) VALUES($1,$2)',[ownerId,JSON.stringify(config)]);
   const after={...input,id:businessId,owner_id:ownerId,status,is_listed:!pending};
   await client.query('INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES($1,$2,$3,$4,NULL,$5::jsonb)',
    [randomUUID(),businessId,actor,'create',JSON.stringify(after)]);
   await client.query('COMMIT');client.release();client=null;
   return Response.json({ok:true,id:businessId,status,slug:input.slug,ownerEmail,temporaryPassword:tempPassword,
    message:pending?'Created pending business approval. Share the new owner credentials securely.':'Business is active. Share new owner credentials securely; the owner should change the password.'},{headers:h,status:201});
  }
  if(!idOk(payload.id))throw Error('Invalid business identifier.');
  const loaded=await client.query('SELECT * FROM businesses WHERE id=$1 FOR UPDATE',[payload.id]);
  const before=loaded.rows[0];if(!before)throw Error('Business not found.');
  let after:any={...before},kind=action;
  if(action==='changeOwnerEmail'){
   // A platform administrator may update a business owner's sign-in address,
   // but cannot change credentials for any platform administrator account.
   if(payload.confirmName!==before.name)throw Error('Confirm the exact business name before changing the owner login.');
   const target=(await client.query('SELECT id,email FROM users WHERE id=$1 FOR UPDATE',[before.owner_id])).rows[0];
   if(!target)throw Error('Business owner account not found.');
   const privileged=(await client.query('SELECT 1 FROM platform_admins WHERE user_id=$1',[target.id])).rowCount;
   if(privileged)throw Error('Platform administrator login emails cannot be changed through business management.');
   const {oldEmail,newEmail}=validateEmailChangeConfirmation(payload,before.name,target.email);
   const taken=await client.query('SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2',[newEmail,target.id]);
   if(taken.rowCount)throw Error('The new login email is already registered to another account.');
   await client.query('UPDATE users SET email=$1 WHERE id=$2',[newEmail,target.id]);
   // Expire old sign-ins. The owner must sign in again using the new email,
   // while keeping the same user ID and all linked business records.
   await client.query('DELETE FROM sessions WHERE user_id=$1',[target.id]);
   await client.query('INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
    [randomUUID(),before.id,actor,'change_owner_email',
     JSON.stringify({owner_id:target.id,email:oldEmail}),
     JSON.stringify({owner_id:target.id,email:newEmail,sessions_revoked:true,owner_identity_preserved:true})]);
   await client.query('COMMIT');client.release();client=null;
   return Response.json({ok:true,ownerEmail:newEmail,previousEmail:oldEmail,
    message:'Owner login email updated. The owner was signed out on every device and must use the new email to sign in. All business records were preserved. Inform the owner securely.'},{headers:h});
  }
  if(action==='resetPassword'){
   if(payload.confirmName!==before.name)throw Error('Confirm the exact business name before resetting the owner password.');
   const target=(await client.query(
    'SELECT u.id,u.email,u.must_change_password FROM users u WHERE u.id=$1 FOR UPDATE',
    [before.owner_id])).rows[0];
   if(!target)throw Error('Business owner account not found.');
   const platformRole=(await client.query('SELECT role FROM platform_admins WHERE user_id=$1',[target.id])).rows[0]?.role;
   if(platformRole)throw Error('Administrator accounts must change their own passwords through account settings.');
   if(payload.expectedEmail!==target.email)throw Error('Owner email has changed. Refresh the business directory before resetting credentials.');
   const tempPassword=randomBytes(24).toString('base64url');
   await client.query('UPDATE users SET password_hash=$1,must_change_password=TRUE WHERE id=$2',
    [hashPassword(tempPassword),target.id]);
   await client.query('DELETE FROM sessions WHERE user_id=$1',[target.id]);
   await client.query(
    'INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
    [randomUUID(),before.id,actor,'reset_password',
     JSON.stringify({owner_id:target.id,email:target.email}),
     JSON.stringify({owner_id:target.id,email:target.email,sessions_revoked:true,password_change_required:true})]);
   await client.query('COMMIT');client.release();client=null;
   return Response.json({ok:true,ownerEmail:target.email,temporaryPassword:tempPassword,
    message:'Owner password reset. Existing owner sessions were revoked. Share this temporary password securely; it must be changed at next sign-in.'},{headers:h});
  }
  if(action==='edit'){
   const data=validateManagedBusiness(payload,industries,[]);
   if(isReservedBusinessSlug(data.slug)&&data.slug!==before.slug)throw Error('This business booking URL is reserved.');
   if(payload.status!==undefined&&typeof payload.status!=='string')throw Error('Invalid business status.');
   const status=payload.status===undefined?before.status:payload.status;
   if(!canChangeManagedStatus(role,before.status,status))throw Error('Only the primary administrator can approve unapproved businesses or alter pending registration status.');
   if(before.status==='archived'&&status!=='archived')throw Error('Restore an archived business before editing its status.');
   const listed=status==='active' && payload.listed!==false;
   const changed=await client.query(
    'UPDATE businesses SET name=$1,slug=$2,industry=$3,description=$4,city=$5,region=$6,status=$7,is_listed=$8,listing_requested=FALSE,updated_at=now() WHERE id=$9 RETURNING *',
    [data.name,data.slug,data.industry,data.description,data.city,data.region,status,listed,payload.id]);
   after=changed.rows[0];kind=before.status!==status?(status==='active'?'activate':'suspend'):'edit';
   // Business owner details and customized settings continue to be the same tenant.
   const settings=(await client.query('SELECT data FROM settings WHERE owner=$1 FOR UPDATE',[before.owner_id])).rows[0];
   if(settings){
    const cfg=JSON.parse(settings.data||'{}');cfg.name=data.name;cfg.tagline=data.industry;
    await client.query('UPDATE settings SET data=$1 WHERE owner=$2',[JSON.stringify(cfg),before.owner_id]);
   }
  }else if(action==='archive'){
   if(before.status==='archived')throw Error('Business is already archived.');
   if(payload.confirmName!==before.name)throw Error('Confirm the exact business name before removal.');
   // Stop the application access, but avoid leaving connected customer recurring
   // charges behind by requiring owner/admin to end paid contracts first.
   const pay=await client.query(
    "SELECT COUNT(*)::int AS count FROM customer_memberships WHERE business_id=$1 AND status IN ('active','past_due','pending_payment')",
    [before.id]);
   const platformSub=await client.query('SELECT stripe_subscription_id,status FROM business_subscriptions WHERE business_id=$1',[before.id]);
   const subscribed=!!platformSub.rows[0]?.stripe_subscription_id&&platformSub.rows[0]?.status==='active';
   if(!canArchiveBusiness({members:pay.rows[0]?.count||0,subscribed}))
    throw Error('Cannot remove a business with active or pending paid memberships/subscriptions. Resolve recurring billing first.');
   // Archive instead of deleting. Re-registration uses the same unchanged
   // owner ID, business ID, URL, settings, customers and historical records.
   const snapshot=(await client.query(
    "SELECT (SELECT COUNT(*)::int FROM appointments WHERE owner=$1) AS appointments, (SELECT COUNT(*)::int FROM business_client_profiles WHERE owner=$1) AS client_profiles, (SELECT COUNT(*)::int FROM booking_requests WHERE business_id=$2) AS booking_requests, (SELECT COUNT(*)::int FROM customer_memberships WHERE business_id=$2) AS memberships, (SELECT COUNT(*)::int FROM settings WHERE owner=$1) AS settings_records",
    [before.owner_id,before.id])).rows[0];
   const changed=await client.query(
    "UPDATE businesses SET status='archived',is_listed=FALSE,listing_requested=FALSE,archived_at=now(),restored_at=NULL,updated_at=now() WHERE id=$1 RETURNING *",
    [before.id]);after=changed.rows[0];
   after.archive_record_counts=snapshot;
  }else if(action==='restore'){
   if(before.status!=='archived')throw Error('Only archived businesses can be restored.');
   // Restore privately as suspended, so no public booking is re-enabled
   // before the platform administrator reviews the old record.
   const changed=await client.query(
    "UPDATE businesses SET status='suspended',is_listed=FALSE,listing_requested=FALSE,restored_at=now(),archived_at=NULL,updated_at=now() WHERE id=$1 RETURNING *",
    [before.id]);after=changed.rows[0];
  }
  await client.query(
   'INSERT INTO platform_business_audit(id,business_id,actor_id,action,before_record,after_record) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
   [randomUUID(),before.id,actor,kind,JSON.stringify(loggable(before)),JSON.stringify({
     ...loggable(after),...(action==='archive'?{retained_record_counts:after.archive_record_counts,archive_method:'non_destructive_status_change'}:{})
   })]);
  await client.query('COMMIT');client.release();client=null;
  return Response.json({ok:true,business:loggable(after),
   message:action==='archive'?'Business archived, not deleted. All business data and history remain stored for future restoration.':action==='restore'?'Business restored with its original owner, settings, services, customers and history. Review and reactivate when ready.':'Business information saved.'},{headers:h});
 }catch(e){
  if(client){try{await client.query('ROLLBACK')}catch{}client.release();}
  if((e as {code?:string})?.code==='23505')return Response.json({error:'Business URL or owner email is already in use.'},{status:409,headers:h});
  return failure(e);
 }
}
