import {randomUUID,randomInt} from 'node:crypto';
import {sanitizeBookingAnswers} from '../../../../server/booking-custom-fields.mjs';
import {getPool} from '../../../../server/database.mjs';
import {requireOwner} from '../../../../lib/auth';
import {validOrigin,trustedOrigin} from '../../../../server/security.mjs';
import {paymentConfigured,validateMembershipPlan,stripeApi} from '../../../../server/membership-payments.mjs';
import {planEntitlements,activeMembershipLimit} from '../../../../server/plan-entitlements.mjs';
// Manual payment confirmation and session usage are maintained in an auditable ledger.
// Stripe integration remains optional and can be revisited separately.
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
async function ctx(req:Request){
 const owner=await requireOwner(req),pool=getPool();
 const row=(await pool.query("SELECT b.id,b.slug,b.name,s.plan_code,s.status AS subscription_status FROM businesses b JOIN business_subscriptions s ON s.business_id=b.id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
 if(!row)throw Error('Business unavailable.');
 return {owner,pool,business:row};
}
function error(err:unknown){
 const msg=(err as Error).message||'Memberships unavailable.';
 return Response.json({error:msg==='AUTH_REQUIRED'?'Please sign in to manage memberships.':msg},
  {status:msg==='AUTH_REQUIRED'?401:/limit|allows up to|only |exceed/i.test(msg)?409:/invalid|enter |choose |required/i.test(msg)?400:503,headers});
}
export async function GET(req:Request){
 try{
  const {pool,business}=await ctx(req);
  const [plans,members,merchant,visits,ledger]=await Promise.all([
   pool.query('SELECT id,name,description,interval_unit AS interval,price_cents AS "priceCents",sessions_included AS "sessionsIncluded",active FROM membership_plans WHERE business_id=$1 ORDER BY created_at DESC',[business.id]),
   pool.query("SELECT m.id,m.customer_name,m.customer_email,m.customer_phone,m.date_of_birth::text AS date_of_birth,m.registration_answers,m.registration_field_labels,m.created_at,m.member_number,m.sessions_included,m.sessions_used,m.plan_id,m.status,m.last_paid_at,m.paid_through,p.name AS plan_name,p.interval_unit FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.business_id=$1 ORDER BY m.created_at DESC LIMIT 200",[business.id]),
   pool.query("SELECT external_account_id,charges_enabled,onboarding_complete FROM merchant_accounts WHERE business_id=$1",[business.id]),
   pool.query("SELECT a.id,a.date,a.data,a.status FROM appointments a JOIN businesses b ON b.owner_id=a.owner WHERE b.id=$1 AND a.status IN ('Completed','Attended')",[business.id]),
   pool.query('SELECT membership_id,appointment_id,event_type,session_delta,amount_cents,created_at FROM membership_session_ledger WHERE business_id=$1 ORDER BY created_at DESC LIMIT 500',[business.id])
  ]);
  const account=merchant.rows[0]||{};
  const individual=(await pool.query('SELECT limits FROM business_entitlement_overrides WHERE business_id=$1',[business.id])).rows[0]?.limits||{};
  const benefits=planEntitlements(business.plan_code,business.subscription_status);
  if(Number.isInteger(individual.membershipPlans))benefits.limits.membershipPlans=individual.membershipPlans;
  return Response.json({businessName:business.name,plans:plans.rows,members:members.rows.map((m:any)=>{const actual=visits.rows.filter((v:any)=>{try{const d=typeof v.data==='string'?JSON.parse(v.data):v.data||{};return !!m.member_number&&String(d.memberNumber||'').toUpperCase()===String(m.member_number).toUpperCase();}catch{return false;}}).length;return {...m,recorded_sessions:actual,history:ledger.rows.filter((e:any)=>e.membership_id===m.id)};}),planBenefits:benefits,
   payments:{configured:paymentConfigured(),connected:!!account.external_account_id,
    ready:paymentConfigured()&&account.charges_enabled===true&&account.onboarding_complete===true}}, {headers});
 }catch(e){return error(e);}
}
export async function POST(req:Request){
 if(!validOrigin(req))return Response.json({error:'Invalid origin.'},{status:403,headers});
 try{
  const {pool,business}=await ctx(req);
  const raw=await req.text();if(raw.length>8000)throw Error('Request too large.');
  const input=JSON.parse(raw);
  if(input.action==='save'||input.action==='toggle'){
   // Serialize membership offer modifications for this business. Quotas are
   // enforced by the server against the persisted plan and existing offers.
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[business.id+':membership-offers']);
    const record=(await client.query(
     'SELECT s.plan_code,s.status FROM business_subscriptions s WHERE s.business_id=$1',
     [business.id])).rows[0];
    const individual=(await client.query('SELECT limits FROM business_entitlement_overrides WHERE business_id=$1',[business.id])).rows[0]?.limits||{};
    const limit=Number.isInteger(individual.membershipPlans)?individual.membershipPlans:activeMembershipLimit(record?.plan_code,record?.status);
    const count=Number((await client.query(
     'SELECT COUNT(*)::int AS count FROM membership_plans WHERE business_id=$1 AND active=TRUE',
     [business.id])).rows[0]?.count||0);
    if(input.action==='save'){
     const plan=validateMembershipPlan(input);
     const active=input.active!==false;
     const sessionsIncluded=Number(input.sessionsIncluded??0);
     if(!Number.isInteger(sessionsIncluded)||sessionsIncluded<0||sessionsIncluded>100000)throw Error('Enter a valid session allowance.');
     if(input.id){
      if(!/^[a-f0-9-]{36}$/i.test(input.id))throw Error('Invalid membership offer.');
      const old=(await client.query(
       'SELECT active FROM membership_plans WHERE id=$1 AND business_id=$2 FOR UPDATE',
       [input.id,business.id])).rows[0];
      if(!old)throw Error('Membership offer not found for this business.');
      if(active&&!old.active&&count>=limit)
       throw Error('Your '+planEntitlements(record?.plan_code,record?.status).name+' plan allows up to '+limit+' active customer membership offers. Existing offers are preserved.');
      await client.query(
       'UPDATE membership_plans SET name=$1,description=$2,interval_unit=$3,price_cents=$4,active=$5,updated_at=now(),sessions_included=$8 WHERE id=$6 AND business_id=$7',
       [plan.name,plan.description,plan.interval,plan.price,active,input.id,business.id,sessionsIncluded]);
     }else{
      if(active&&count>=limit)
       throw Error('Your '+planEntitlements(record?.plan_code,record?.status).name+' plan allows up to '+limit+' active customer membership offers. Existing offers are preserved.');
      await client.query(
       'INSERT INTO membership_plans(id,business_id,name,description,interval_unit,price_cents,active,sessions_included) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
       [randomUUID(),business.id,plan.name,plan.description,plan.interval,plan.price,active,sessionsIncluded]);
     }
    }else{
     if(!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Error('Invalid membership offer.');
     const old=(await client.query(
      'SELECT active FROM membership_plans WHERE id=$1 AND business_id=$2 FOR UPDATE',
      [input.id,business.id])).rows[0];
     if(!old)throw Error('Membership offer not found for this business.');
     if(input.active===true&&!old.active&&count>=limit)
      throw Error('Your '+planEntitlements(record?.plan_code,record?.status).name+' plan allows up to '+limit+' active customer membership offers. Existing offers are preserved.');
     await client.query(
      'UPDATE membership_plans SET active=$1,updated_at=now() WHERE id=$2 AND business_id=$3',
      [input.active===true,input.id,business.id]);
    }
    await client.query('COMMIT');
    return Response.json({ok:true,planLimit:limit},{headers});
   }catch(e){await client.query('ROLLBACK');throw e;}
   finally{client.release();}
  }
  if(input.action==='confirmManualPayment'||input.action==='renewMembership'){
   const id=String(input.id||'');
   if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid member.');
   const requestId=String(input.requestId||'');
   const selectedPlanId=String(input.planId||'');
   if(!/^[a-f0-9-]{36}$/i.test(requestId))throw Error('Invalid payment request.');
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const member=(await client.query("SELECT m.id,m.status,m.sessions_included,m.sessions_used,m.member_number,p.sessions_included AS plan_sessions,p.price_cents FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.business_id=$1 AND m.id=$2 FOR UPDATE",[business.id,id])).rows[0];
    if(!member)throw Error('Member not found.');
    if(input.action==='renewMembership'&&String(input.memberNumber||'').trim().toUpperCase()!==String(member.member_number||'').toUpperCase())throw Error('Enter the player membership number to renew.');
    if(input.action==='renewMembership'&&member.status!=='active')throw Error('Confirm the initial payment before renewing this membership.');
    if(input.action==='confirmManualPayment'&&member.status==='active')throw Error('This membership is already active. Use Renew to add another package of sessions.');
    if(!member.member_number)throw Error('Assign a member number before confirming payment.');
    const selectedPlan=input.action==='renewMembership'?(await client.query('SELECT id,sessions_included,price_cents FROM membership_plans WHERE business_id=$1 AND id=$2 AND active=true',[business.id,selectedPlanId])).rows[0]:null;
    if(input.action==='renewMembership'&&!selectedPlan)throw Error('Choose an available membership package to renew.');
    const credits=Number(selectedPlan?selectedPlan.sessions_included:member.plan_sessions);
    if(!Number.isInteger(credits)||credits<1)throw Error('Membership package must include at least one session.');
    const existing=(await client.query("SELECT 1 FROM membership_session_ledger WHERE business_id=$1 AND membership_id=$2 AND appointment_id=$3 AND event_type='payment_confirmed'",[business.id,id,requestId])).rowCount;
    if(existing){await client.query('COMMIT');return Response.json({ok:true,credited:0,alreadyProcessed:true},{headers});}
    await client.query("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta,amount_cents) VALUES($1,$2,$3,$4,'payment_confirmed',$5,$6)",[randomUUID(),business.id,id,requestId,credits,selectedPlan?selectedPlan.price_cents:member.price_cents]);
    await client.query("UPDATE customer_memberships SET sessions_included=sessions_included+$1,status='active',last_paid_at=now(),updated_at=now(),plan_id=COALESCE($4,plan_id),price_cents=COALESCE($5,price_cents) WHERE business_id=$2 AND id=$3",[credits,business.id,id,selectedPlan?.id||null,selectedPlan?.price_cents??null]);
    await client.query('COMMIT');
    return Response.json({ok:true,credited:credits},{headers});
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  if(input.action==='recordSession'){
   const id=String(input.id||''),appointmentId=String(input.appointmentId||'').trim();
   if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Choose a member.');
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const member=(await client.query('SELECT id,member_number,sessions_included,sessions_used,status FROM customer_memberships WHERE business_id=$1 AND id=$2 FOR UPDATE',[business.id,id])).rows[0];
    if(!member||member.status!=='active'||!member.member_number)throw Error('An active member is required.');
    if(member.sessions_used>=member.sessions_included)throw Error('No sessions remaining.');
    const visits=(await client.query("SELECT a.id,a.data FROM appointments a JOIN businesses b ON b.owner_id=a.owner WHERE b.id=$1 AND a.status IN ('Completed','Attended') AND ($2='' OR a.id=$2) ORDER BY a.date ASC",[business.id,appointmentId])).rows;
    const unrecorded=[] as typeof visits;
    for(const v of visits){try{const d=typeof v.data==='string'?JSON.parse(v.data):v.data||{};if(String(d.memberNumber||'').toUpperCase()===String(member.member_number).toUpperCase()){const found=await client.query("SELECT 1 FROM membership_session_ledger WHERE business_id=$1 AND membership_id=$2 AND appointment_id=$3 AND event_type='session_used'",[business.id,id,v.id]);if(!found.rowCount)unrecorded.push(v);}}catch{}}
    const selected=unrecorded[0];
    if(!selected)throw Error('No unrecorded completed visits found for this member.');
    const info=typeof selected.data==='string'?JSON.parse(selected.data):selected.data||{};
    if(info.memberNumber!==member.member_number)throw Error('Appointment member number does not match.');
    await client.query("INSERT INTO membership_session_ledger(id,business_id,membership_id,appointment_id,event_type,session_delta) VALUES($1,$2,$3,$4,'session_used',-1)",[randomUUID(),business.id,id,selected.id]);
    await client.query('UPDATE customer_memberships SET sessions_used=sessions_used+1,updated_at=now() WHERE id=$1 AND business_id=$2',[id,business.id]);
    await client.query('COMMIT');return Response.json({ok:true},{headers});
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  if(input.action==='deleteMember'){
   const id=String(input.id||'');
   if(!/^[a-f0-9-]{36}$/i.test(id))throw Error('Invalid member.');
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const member=(await client.query('SELECT id,customer_name,member_number FROM customer_memberships WHERE business_id=$1 AND id=$2 FOR UPDATE',[business.id,id])).rows[0];
    if(!member)throw Error('Member not found.');
    await client.query('DELETE FROM membership_session_ledger WHERE business_id=$1 AND membership_id=$2',[business.id,id]);
    await client.query('DELETE FROM customer_memberships WHERE business_id=$1 AND id=$2',[business.id,id]);
    await client.query('COMMIT');
    return Response.json({ok:true,deleted:member.customer_name},{headers});
   }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  if(input.action==='assignMember'){
   const name=String(input.name||'').trim(),email=String(input.email||'').trim().toLowerCase(),planId=String(input.planId||'');
   if(name.length<2||name.length>100||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid member name and email.');
   const phone=String(input.phone||'').trim().slice(0,40);
   const dob=String(input.dateOfBirth||'');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>new Date().toISOString().slice(0,10))throw Error('Enter a valid date of birth.');
   const settings=(await pool.query('SELECT data FROM settings WHERE owner=(SELECT owner_id FROM businesses WHERE id=$1)',[business.id])).rows[0]?.data;
   const config=typeof settings==='string'?JSON.parse(settings):settings||{};
   const customAnswers=sanitizeBookingAnswers(config.bookingCustomFields||[],input.customAnswers||{});
   const fieldLabels=Object.fromEntries((config.bookingCustomFields||[]).map((field:any)=>[field.id,field.label]));
   const parts=name.split(/\s+/),initials=(parts[0][0]+(parts.length>1?parts[parts.length-1][0]:'X')).toUpperCase().replace(/[^A-Z]/g,'X');
   const plan=(await pool.query('SELECT id,price_cents,sessions_included FROM membership_plans WHERE business_id=$1 AND id=$2',[business.id,planId])).rows[0];
   if(!plan)throw Error('Choose a membership package for this business.');
   // A player has one permanent ID per business, independent of their membership package.
   // Serialize enrollment checks by business and normalized identity to avoid concurrent duplicate IDs.
   const normalizedName=name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
   const identityKey=business.id+'|'+normalizedName+'|'+dob;
   const identityLock=await pool.connect();
   try{
    await identityLock.query('BEGIN');
    await identityLock.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[business.id,identityKey]);
    const prior=await identityLock.query("SELECT id,member_number,status,customer_name,customer_email,date_of_birth FROM customer_memberships WHERE business_id=$1 AND ((lower(trim(regexp_replace(customer_name,'\\s+',' ','g')))=$2 AND date_of_birth=$3::date) OR (lower(trim(regexp_replace(customer_name,'\\s+',' ','g')))=$2 AND lower(trim(customer_email))=$4)) ORDER BY created_at ASC NULLS LAST,id ASC LIMIT 1",[business.id,normalizedName,dob,email]);
    if(prior.rows[0]){
     if(prior.rows[0].date_of_birth&&new Date(prior.rows[0].date_of_birth).toISOString().slice(0,10)!==dob)throw Error('A member with this name and email already exists with a different birth date. Review the existing profile.');
     await identityLock.query("UPDATE customer_memberships SET customer_phone=CASE WHEN $1<>'' THEN $1 ELSE customer_phone END,registration_answers=CASE WHEN registration_answers='{}'::jsonb THEN $2::jsonb ELSE registration_answers END,registration_field_labels=CASE WHEN registration_field_labels='{}'::jsonb THEN $3::jsonb ELSE registration_field_labels END,updated_at=now() WHERE id=$4 AND business_id=$5",[phone,JSON.stringify(customAnswers),JSON.stringify(fieldLabels),prior.rows[0].id,business.id]);
     await identityLock.query('COMMIT');
     return Response.json({ok:true,existingMember:true,memberNumber:prior.rows[0].member_number,paymentStatus:prior.rows[0].status,message:'This player is already registered. Use their existing membership ID for activation or renewal.'},{headers});
    }
   for(let attempt=0;attempt<1;attempt++){
    const requested=String(input.memberNumber||'').trim().toUpperCase();
    const initials=(name.trim().split(/\s+/)[0]?.[0]||'X').toUpperCase()+(name.trim().split(/\s+/).slice(-1)[0]?.[0]||'X').toUpperCase();
    if(requested&&!new RegExp('^'+initials+dob.slice(5,7)+dob.slice(8,10)+'$').test(requested))throw Error('Membership ID must match initials and birth month/day.');
    const number=requested||initials+dob.slice(5,7)+dob.slice(8,10);
    const bookingId=(await identityLock.query("SELECT member_number,first_name,last_name,date_of_birth FROM customer_booking_ids WHERE business_id=$1 AND member_number=$2 LIMIT 1",[business.id,number])).rows[0];
    if(bookingId&&(String(bookingId.first_name+' '+bookingId.last_name).trim().toLowerCase()!==normalizedName||new Date(bookingId.date_of_birth).toISOString().slice(0,10)!==dob))throw Error('This six-character ID belongs to another customer. The initials and birth month/day combination is not unique; registration requires a different ID policy.');
    const existingId=(await identityLock.query("SELECT 1 FROM customer_memberships WHERE business_id=$1 AND member_number=$2 LIMIT 1",[business.id,number])).rowCount;
    if(existingId)throw Error('This six-character ID already belongs to another member. The ID format cannot distinguish customers sharing initials and birthday.');
    const result=await identityLock.query("INSERT INTO customer_memberships(id,business_id,plan_id,price_cents,customer_name,customer_email,status,stripe_account_id,member_number,sessions_included,sessions_used,date_of_birth,customer_phone,registration_answers,registration_field_labels) VALUES($1,$2,$3,$4,$5,$6,'pending_payment','',$7,$8,0,$9,$10,$11::jsonb,$12::jsonb) ON CONFLICT DO NOTHING RETURNING id,member_number",[randomUUID(),business.id,plan.id,plan.price_cents,name,email,number,0,dob,phone,JSON.stringify(customAnswers),JSON.stringify(fieldLabels)]);
    if(result.rows[0]){
     const matchingProfile=(await identityLock.query(
      "SELECT id FROM business_client_profiles WHERE owner=(SELECT owner_id FROM businesses WHERE id=$1) AND deleted_at IS NULL AND (member_number=$2 OR (member_number IS NULL AND lower(trim(name))=$3 AND lower(trim(email))=$4)) ORDER BY CASE WHEN member_number=$2 THEN 0 ELSE 1 END,created_at ASC LIMIT 1 FOR UPDATE",
      [business.id,number,normalizedName,email]
     )).rows[0];
     if(matchingProfile){
      await identityLock.query("UPDATE business_client_profiles SET member_number=$1,date_of_birth=COALESCE(date_of_birth,$2::date),phone=CASE WHEN trim(phone)='' THEN $3 ELSE phone END,updated_at=now() WHERE id=$4",[number,dob,phone,matchingProfile.id]);
     }else{
      await identityLock.query("INSERT INTO business_client_profiles(id,owner,name,email,phone,notes,import_columns,member_number,date_of_birth) VALUES($1,(SELECT owner_id FROM businesses WHERE id=$2),$3,$4,$5,$6,$7::jsonb,$8,$9::date)",[randomUUID(),business.id,name,email,phone,'Membership registration',JSON.stringify({}),number,dob]);
     }
     await identityLock.query('COMMIT');
     return Response.json({ok:true,memberNumber:number,paymentStatus:'pending_payment'},{headers});
    }
    if(requested)throw Error('This membership number is already in use.');
   }
   throw Error('Unable to allocate a unique membership number.');
   }catch(e){await identityLock.query('ROLLBACK');throw e;}finally{identityLock.release();}
  }
  if(input.action==='updateMember'){
   const id=String(input.id||''),planId=String(input.planId||'');
   const plan=(await pool.query('SELECT id,sessions_included FROM membership_plans WHERE business_id=$1 AND id=$2',[business.id,planId])).rows[0];
   if(!plan)throw Error('Choose a valid membership package.');
   const member=(await pool.query('SELECT id,sessions_used FROM customer_memberships WHERE business_id=$1 AND id=$2',[business.id,id])).rows[0];
   if(!member)throw Error('Member not found.');
   const used=Number(input.sessionsUsed),included=Number(input.sessionsIncluded);
   if(!Number.isInteger(used)||!Number.isInteger(included)||used<0||included<0||included>100000||used>included)throw Error('Enter valid sessions used and included.');
   await pool.query('UPDATE customer_memberships SET plan_id=$1,sessions_used=$2,sessions_included=$3,updated_at=now() WHERE business_id=$4 AND id=$5',[planId,used,included,business.id,id]);
   return Response.json({ok:true},{headers});
  }
  if(input.action==='connect'){
   if(!paymentConfigured())throw Error('Stripe payments require STRIPE_SECRET_KEY and STRIPE_CONNECT_WEBHOOK_SECRET in the SelahFlow Render environment before enrollment can accept money.');
   const current=(await pool.query('SELECT external_account_id FROM merchant_accounts WHERE business_id=$1',[business.id])).rows[0];
   let accountId=current?.external_account_id;
   if(!accountId){
    const created=await stripeApi('accounts',{params:{
     type:'express',country:'US',email:input.email||undefined,
     'business_profile[name]':business.name,
     'capabilities[card_payments][requested]':'true',
     'capabilities[transfers][requested]':'true',
     'metadata[selahflow_business_id]':business.id
    },idempotencyKey:'selahflow-connect-'+business.id});
    accountId=created.id;
    await pool.query("INSERT INTO merchant_accounts(business_id,provider,external_account_id) VALUES($1,'stripe',$2) ON CONFLICT(business_id) DO UPDATE SET external_account_id=excluded.external_account_id",
     [business.id,accountId]);
   }
   const origin=trustedOrigin(req);
   const link=await stripeApi('account_links',{params:{
    account:accountId,refresh_url:origin+'/studio/'+business.slug+'?stripe=retry',
    return_url:origin+'/studio/'+business.slug+'?stripe=connected',type:'account_onboarding'
   }});
   return Response.json({url:link.url},{headers});
  }
  if(input.action==='verify'){
   if(!paymentConfigured())throw Error('Stripe payments are not yet configured.');
   const account=(await pool.query('SELECT external_account_id FROM merchant_accounts WHERE business_id=$1',[business.id])).rows[0];
   if(!account?.external_account_id)throw Error('Connect Stripe before verifying payments.');
   const info=await stripeApi('accounts/'+account.external_account_id,{method:'GET'});
   const ready=info.charges_enabled===true&&info.details_submitted===true;
   await pool.query('UPDATE merchant_accounts SET charges_enabled=$1,onboarding_complete=$2,updated_at=now() WHERE business_id=$3',
    [info.charges_enabled===true,info.details_submitted===true,business.id]);
   return Response.json({ok:true,ready},{headers});
  }
  throw Error('Invalid membership action.');
 }catch(e){return error(e);}
}
