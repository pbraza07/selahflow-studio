import {accrueCashCommission} from './cash-commission-billing.mjs';
import {assertClientAppointment} from './team-portal.mjs';
import {bookingServicePaymentOptions} from './service-payment-options.mjs';
import {assertBookingWaiver} from './participation-waivers.mjs';
const read=v=>typeof v==='string'?JSON.parse(v):v||{};
/** Record received cash atomically; linking is explicit and never inferred from a client name. */
export async function recordCashSale(pool,{owner,eventId,bookingId,memberNumber=/** @type {string|null} */ (null),lines=[],taxRate=0,onsiteConfirmed=false,teamAccountId=null}){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  if(onsiteConfirmed){
   if(teamAccountId){
    const team=(await db.query("SELECT a.*,b.owner_id FROM team_accounts a JOIN businesses b ON b.id=a.business_id WHERE a.id=$1 AND b.owner_id=$2 AND b.status='active' AND a.active=true AND a.must_change_password=false FOR SHARE OF a",[teamAccountId,owner])).rows[0];
    if(!team)throw Error('Your team access changed. Sign in again.');
    await assertClientAppointment(db,team,bookingId);
   }
   const saved=(await db.query("SELECT a.data,b.id AS business_id,s.data AS config FROM appointments a JOIN businesses b ON b.owner_id=a.owner AND b.status='active' JOIN settings s ON s.owner=a.owner WHERE a.id=$1 AND a.owner=$2 FOR UPDATE OF a",[bookingId,owner])).rows[0];
   if(!saved)throw Error('Appointment unavailable.');const d=read(saved.data),config=read(saved.config);
   if(!bookingServicePaymentOptions(config,d).onsite)throw Error('Pay on Site is not enabled for this service.');
   if(d.bookingRequestId){const review=(await db.query('SELECT status,appointment_id FROM booking_requests WHERE id=$1 AND business_id=$2',[d.bookingRequestId,saved.business_id])).rows[0];if(review?.status!=='accepted'||review.appointment_id!==bookingId)throw Error('Approve this booking before recording cash.');}
   await assertBookingWaiver(db,{owner,config,serviceIds:d.serviceIds||[],memberNumber:d.memberNumber});
   const ids=d.serviceIds||[],names=d.services||[];
   lines=Array.isArray(d.paymentLines)&&d.paymentLines.length?d.paymentLines:ids.length===1||names.length===1?[{id:ids[0]||'',name:names[0]||'Appointment',price:Number(d.price),qty:1,type:'service'}]:null;
   if(!lines)throw Error('This appointment needs itemized payment lines. Record its exact services from Sales.');
   taxRate=0;
  }
  const total=lines.reduce((n,l)=>n+Math.round(Number(l.price)*100)*l.qty,0);
  if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid sale total.');
  let cashClient=null;
  if(!bookingId&&lines.some(l=>l.type==='service')){
   const business=(await db.query("SELECT b.id,p.booking_enabled,p.accepted_at FROM businesses b LEFT JOIN business_commission_policies p ON p.business_id=b.id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
   if(memberNumber){
    const profile=(await db.query('SELECT member_number,name FROM business_client_profiles WHERE owner=$1 AND member_number=$2 AND archived=false AND deleted_at IS NULL',[owner,memberNumber])).rows[0];
    if(!profile||!business)throw Error('Choose a client ID from this business client directory.');
    cashClient={...profile,business_id:business.id};
   }
   if(business?.booking_enabled&&business.accepted_at&&!cashClient)throw Error('Enter the client ID for this cash service sale so first-purchase eligibility can be checked. Link a booking when this payment settles an existing appointment.');
   if(cashClient)await accrueCashCommission(db,{businessId:cashClient.business_id,kind:'booking',memberNumber:cashClient.member_number,sourceId:eventId,grossCents:lines.filter(l=>l.type==='service').reduce((n,l)=>n+Math.round(Number(l.price)*100)*l.qty,0)});
  }
  let booking;
  if(bookingId){
   booking=(await db.query("SELECT a.id,a.data,a.status,b.id AS business_id FROM appointments a JOIN businesses b ON b.owner_id=a.owner AND b.status='active' WHERE a.owner=$1 AND a.id=$2 FOR UPDATE OF a",[owner,bookingId])).rows[0];
   if(!booking||!['Confirmed','Scheduled','Checked in','Checked-in','Completed','No-show'].includes(booking.status))throw Error('Choose an unpaid booking for this business.');
   const data=read(booking.data);
   const provider=(await db.query('SELECT status,stripe_checkout_session_id,terminal_payment_intent_id FROM booking_payments WHERE booking_id=$1 AND business_id=$2 FOR UPDATE',[bookingId,booking.business_id])).rows[0];
   if(data.paymentStatus==='paid'||provider?.status==='paid')throw Error('This booking is already paid.');
   if((provider?.stripe_checkout_session_id||provider?.terminal_payment_intent_id)&&provider.status!=='expired')throw Error('This booking has a card checkout. Resolve that checkout before linking a cash payment.');
   const prior=(await db.query("SELECT data FROM events WHERE owner=$1 AND kind='cash_sale'",[owner])).rows.some(r=>read(r.data).bookingId===bookingId);
   if(prior)throw Error('Cash has already been recorded for this booking.');
   const expected=Math.round(Number(data.price)*100),services=lines.filter(l=>l.type==='service');
   const ids=Array.isArray(data.serviceIds)&&data.serviceIds.length?data.serviceIds:null;
   const keys=ids||data.services||[],actual=services.map(l=>ids?l.id:l.name);
   if(data.membershipCovered||!Number.isSafeInteger(expected)||expected<=0||services.some(l=>l.qty!==1)||keys.length!==actual.length||keys.some(k=>!actual.includes(k))||services.reduce((n,l)=>n+Math.round(l.price*100)*l.qty,0)!==expected)
    throw Error('To settle this booking, add its exact services and full quoted amount. Retail items may be added separately.');
   if(memberNumber){
    if(data.memberNumber&&data.memberNumber!==memberNumber)throw Error('This booking already belongs to a different client ID.');
    const profile=(await db.query("SELECT member_number,name,email FROM business_client_profiles WHERE owner=$1 AND member_number=$2 AND archived=false AND deleted_at IS NULL",[owner,memberNumber])).rows[0];
    const normalize=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
    if(!profile||normalize(profile.name)!==normalize(data.name)||(data.email&&normalize(profile.email)!==normalize(data.email)))throw Error('Choose a client ID matching this booking name and email in your client directory.');
    data.memberNumber=memberNumber;
   }
   if(!data.memberNumber&&(await db.query('SELECT 1 FROM business_commission_policies WHERE business_id=$1 AND booking_enabled=true AND accepted_at IS NOT NULL',[booking.business_id])).rows.length)throw Error('Enter this booking client ID from the client directory before recording cash so first-purchase eligibility can be verified.');
   booking.data=data;
   await accrueCashCommission(db,{businessId:booking.business_id,kind:'booking',memberNumber:data.memberNumber,sourceId:booking.id,grossCents:expected});
  }
  const data={lines,total:total/100,tax:total/100*taxRate/100,payment:'Cash recorded manually',confirmedBy:teamAccountId||owner,confirmedRole:teamAccountId?'team':'owner',...(booking?{bookingId:booking.id,client:booking.data.name||''}:cashClient?{memberNumber:cashClient.member_number,client:cashClient.name}:{})};
  const saved=await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'cash_sale',$4) ON CONFLICT DO NOTHING RETURNING id",[eventId,owner,new Date().toISOString(),JSON.stringify(data)]);
  if(!saved.rows.length)throw Error('This sale reference was already recorded. Refresh before recording another sale.');
  if(booking){
   await db.query('UPDATE appointments SET data=$1 WHERE id=$2 AND owner=$3',[JSON.stringify({...booking.data,paymentStatus:'paid',paymentProvider:'cash',paymentReference:eventId}),booking.id,owner]);
   await db.query("UPDATE booking_client_messages SET status='superseded',detail='Payment recorded by owner',updated_at=now() WHERE booking_id=$1 AND event_type='payment_link' AND status IN ('queued','failed','not_configured')",[booking.id]);
  }
  await db.query('COMMIT');return {ok:true,bookingSettled:!!booking};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
