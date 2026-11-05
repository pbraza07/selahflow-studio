import {randomUUID} from 'node:crypto';
import {getPool} from './database.mjs';
import {validEmail,maskDestination,sendNotificationChannel} from './notification-delivery.mjs';
import {listBookingReminderCandidates,prepareBookingReminder} from './payment-reminder-bookings.mjs';
import {listMembershipReminderCandidates,prepareMembershipReminder} from './payment-reminder-memberships.mjs';

const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
const address=x=>String(x||'').trim().toLowerCase();
const object=x=>typeof x==='string'?JSON.parse(x):x;
const stamp=x=>x?new Date(x).getTime():NaN;
const sourceKey=x=>(x.kind==='booking'?'booking':'membership')+':'+x.sourceId;
const safe=x=>String(x||'').replace(/[\r\n<>]/g,' ').slice(0,180);
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export function reminderClock(now=new Date()){
 const fields=Object.fromEntries(dayFormat.formatToParts(now).map(x=>[x.type,x.value]));
 return {day:`${fields.year}-${fields.month}-${fields.day}`,open:Number(fields.hour)>=9};
}
export function reminderDue(item,now=new Date()){
 const due=stamp(item.eligibleSince),notice=stamp(item.lastNoticeAt);
 return validEmail(address(item.destination))&&Number.isFinite(due)&&now.getTime()-Math.max(due,Number.isFinite(notice)?notice:due)>=86400000;
}
export function paymentReminderMessage(items,businessName){
 const names=[...new Set(items.map(x=>safe(x.clientName)).filter(Boolean))];
 const total=items.reduce((sum,x)=>sum+x.amountCents,0);
 const lines=items.map((x,i)=>`${i+1}. ${safe(x.label)}${x.date?' · '+safe(x.date):''}\nAmount pending: ${money(x.amountCents)}${x.note?'\n'+safe(x.note):''}\n${x.url?(x.actionLabel||'View payment details')+': '+x.url:'Please contact '+safe(businessName)+' to arrange payment.'}`);
 return {subject:'Pending payment reminder — '+safe(businessName),
  text:`Hello${names.length===1?' '+names[0]:''},\n\nThe following payments are still pending with ${safe(businessName)}:\n\n${lines.join('\n\n')}\n\nTotal pending: ${money(total)}\n\nUse the secure payment links in this email to review your options. If payment is due onsite, your existing payment choice is unchanged.\n\nDaily reminders stop when payment is recorded. If you have already paid outside SelahFlow, please contact ${safe(businessName)} so they can update the balance.`,
  actions:items.filter(x=>x.url).slice(0,4).map(x=>({label:(x.actionLabel||'View payment details')+' — '+safe(x.label)+(x.date?' · '+safe(x.date):'')+' · '+money(x.amountCents),url:x.url}))};
}
async function candidates(pool,businessId,destination,now,listBookings,listMemberships){
 const bookings=await listBookings(pool,{businessId,destination,now});
 const memberships=await listMemberships(pool,{businessId,destination,now});
 return [...bookings,...memberships].filter(x=>x.businessId===businessId&&(!destination||address(x.destination)===destination)&&reminderDue(x,now));
}
/** A daily scan can resume after failure; unique digests make partial scans safe. */
export async function enqueueDailyPaymentReminders(pool,{now=new Date(),limit=5,listBookings=listBookingReminderCandidates,listMemberships=listMembershipReminderCandidates}={}){
 const clock=reminderClock(now);if(!clock.open)return {businesses:0,queued:0};
 const at=now.toISOString();
 await pool.query("UPDATE payment_reminder_runs SET status='failed',updated_at=$1 WHERE status='processing' AND updated_at<$1::timestamptz-interval '15 minutes'",[at]);
 await pool.query("INSERT INTO payment_reminder_runs(business_id,reminder_day,next_attempt_at,updated_at) SELECT b.id,$1::date,$2,$2 FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.status='active' AND (s.data::jsonb->>'dailyPaymentReminders') IS DISTINCT FROM 'false' ON CONFLICT DO NOTHING",[clock.day,at]);
 let businesses=0,queued=0;
 for(let i=0;i<limit;i++){
  const run=(await pool.query("UPDATE payment_reminder_runs SET status='processing',attempts=attempts+1,updated_at=$2 WHERE (business_id,reminder_day) IN (SELECT business_id,reminder_day FROM payment_reminder_runs WHERE reminder_day=$1::date AND status IN ('queued','failed') AND next_attempt_at<=$2 ORDER BY business_id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING business_id",[clock.day,at])).rows[0];
  if(!run)break;businesses++;
  try{
   const groups=new Map();
   for(const item of await candidates(pool,run.business_id,null,now,listBookings,listMemberships)){
    const dest=address(item.destination),sources=groups.get(dest)||new Map();sources.set(sourceKey(item),{kind:item.kind,sourceId:item.sourceId});groups.set(dest,sources);
   }
   for(const [destination,sources] of groups){
    const inserted=await pool.query("INSERT INTO daily_payment_reminders(id,business_id,reminder_day,destination,destination_masked,sources,next_attempt_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$7,$7) ON CONFLICT(business_id,destination,reminder_day) DO NOTHING RETURNING id",[randomUUID(),run.business_id,clock.day,destination,maskDestination(destination,'email'),JSON.stringify([...sources.values()]),at]);queued+=inserted.rows.length;
   }
   await pool.query("UPDATE payment_reminder_runs SET status='complete',updated_at=$3 WHERE business_id=$1 AND reminder_day=$2::date",[run.business_id,clock.day,at]);
  }catch{
   await pool.query("UPDATE payment_reminder_runs SET status='failed',next_attempt_at=$3::timestamptz+interval '15 minutes',updated_at=$3 WHERE business_id=$1 AND reminder_day=$2::date",[run.business_id,clock.day,at]);
   console.warn('Daily payment reminder scan temporarily unavailable.');
  }
 }
 return {businesses,queued};
}
/** Rebuild eligibility immediately before sending; never replay yesterday's queue. */
export async function processDailyPaymentReminders(pool,{now=new Date(),origin=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL,limit=10,send=sendNotificationChannel,listBookings=listBookingReminderCandidates,listMemberships=listMembershipReminderCandidates,prepareBooking=prepareBookingReminder,prepareMembership=prepareMembershipReminder}={}){
 const clock=reminderClock(now),at=now.toISOString();
 const startedAt=Date.now(),currentTime=()=>new Date(now.getTime()+Math.max(0,Date.now()-startedAt));
 await pool.query("UPDATE daily_payment_reminders SET status='unknown',detail='Delivery outcome unknown; not retried today',updated_at=$1 WHERE status='processing' AND updated_at<$1::timestamptz-interval '2 minutes'",[at]);
 await pool.query("UPDATE daily_payment_reminders SET status='superseded',detail='Previous daily reminder expired',updated_at=$2 WHERE reminder_day<$1::date AND status IN ('queued','failed','not_configured')",[clock.day,at]);
 if(!clock.open)return {processed:0};
 const host=new URL(origin);if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('A secure application URL is required.');
 let processed=0;
 for(let i=0;i<limit;i++){
  const claimedAt=currentTime();
  if(reminderClock(claimedAt).day!==clock.day)break;
  const item=(await pool.query("UPDATE daily_payment_reminders SET status='processing',updated_at=$2 WHERE id=(SELECT d.id FROM daily_payment_reminders d JOIN businesses b ON b.id=d.business_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE d.reminder_day=$1::date AND b.status='active' AND (s.data::jsonb->>'dailyPaymentReminders') IS DISTINCT FROM 'false' AND d.status IN ('queued','failed','not_configured') AND d.attempts<3 AND d.next_attempt_at<=$2 ORDER BY d.created_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1) RETURNING *",[clock.day,claimedAt.toISOString()])).rows[0];
  if(!item)break;processed++;
  let sendStarted=false;
  try{
   const sourceSet=new Set(object(item.sources).map(sourceKey));
   const current=await candidates(pool,item.business_id,item.destination,claimedAt,listBookings,listMemberships);
   let prepared=[];
   for(const candidate of current.filter(x=>sourceSet.has(sourceKey(x)))){
    const value=await (candidate.kind==='booking'?prepareBooking:prepareMembership)(pool,{businessId:item.business_id,sourceId:candidate.sourceId,destination:item.destination,origin:host.origin,now:currentTime()});
    prepared.push(...(Array.isArray(value)?value:value?[value]:[]));
   }
   // Preparation can involve Stripe. Re-read local payment/destination state after it.
   const recheckedAt=currentTime();
   const latest=new Map((await candidates(pool,item.business_id,item.destination,recheckedAt,listBookings,listMemberships)).map(x=>[sourceKey(x),x]));
   prepared=prepared.filter(x=>x.businessId===item.business_id&&address(x.destination)===item.destination&&reminderDue(x,recheckedAt)&&Number.isSafeInteger(x.amountCents)&&x.amountCents>0&&latest.has(sourceKey(x))&&(x.kind==='membership_invoice'||(x.kind==='booking'?Number(latest.get(sourceKey(x)).amountCents)===x.amountCents:Number(latest.get(sourceKey(x)).sourceAmountCents??latest.get(sourceKey(x)).amountCents)===Number(x.sourceAmountCents??x.amountCents))));
   const business=(await pool.query("SELECT b.name FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.id=$1 AND b.status='active' AND (s.data::jsonb->>'dailyPaymentReminders') IS DISTINCT FROM 'false'",[item.business_id])).rows[0];
   if(!business||!prepared.length){await finish(pool,item,{status:'superseded',detail:'No eligible pending payments remain'},currentTime().toISOString());continue;}
   // Slow invoice preparation can outlive the claim or its calendar day. Do not
   // send after a recovery sweep has marked it unknown or a newer day has begun.
   const deliveryAt=currentTime(),deliveryClock=reminderClock(deliveryAt);
   if(!deliveryClock.open||deliveryClock.day!==clock.day){await finish(pool,item,{status:'superseded',detail:'Previous daily reminder expired'},deliveryAt.toISOString());continue;}
   const owned=(await pool.query("UPDATE daily_payment_reminders SET updated_at=$4 WHERE id=$1 AND business_id=$2 AND reminder_day=$3::date AND status='processing' RETURNING id",[item.id,item.business_id,deliveryClock.day,deliveryAt.toISOString()])).rows[0];
   if(!owned)continue;
   sendStarted=true;
   const result=await send('email',item.destination,{...paymentReminderMessage(prepared,business.name),idempotencyKey:'daily-payment-reminder-'+item.id,trackAmbiguous:true},undefined,undefined,{businessId:item.business_id,kind:'payment-reminder',clientEmail:true,brandingDb:pool});
   await finish(pool,item,result,currentTime().toISOString());
   console.log('Daily payment reminder:',JSON.stringify({status:result.status}));
  }catch{
   await finish(pool,item,{status:sendStarted?'unknown':'failed',detail:sendStarted?'Delivery outcome unknown; not retried today':'Payment eligibility temporarily unavailable'},currentTime().toISOString());
  }
 }
 return {processed};
}
async function finish(pool,item,result,at){
 const allowed=['submitted','failed','not_configured','invalid_destination','unknown','superseded'];
 const status=allowed.includes(result?.status)?result.status:'unknown';
 await pool.query("UPDATE daily_payment_reminders SET status=$2,detail=$3,attempts=attempts+CASE WHEN $2='failed' THEN 1 ELSE 0 END,provider=$4,provider_message_id=$5,next_attempt_at=$6::timestamptz+interval '15 minutes',updated_at=$6 WHERE id=$1 AND status='processing'",[item.id,status,safe(result?.detail),result?.provider||null,result?.providerMessageId||null,at]);
}
export function startDailyPaymentReminderWorker(){
 const key=Symbol.for('selahflow.daily.payment.reminders');if(globalThis[key])return;
 let busy=false;
 const run=async()=>{if(busy||process.env.SELAHFLOW_DAILY_PAYMENT_REMINDERS==='false')return;busy=true;try{const pool=getPool();await enqueueDailyPaymentReminders(pool);await processDailyPaymentReminders(pool);}catch{console.warn('Daily payment reminder worker temporarily unavailable.');}finally{busy=false;}};
 console.log(process.env.SELAHFLOW_DAILY_PAYMENT_REMINDERS==='false'?'Daily payment reminders: disabled by environment.':'Daily payment reminders: scheduled after 09:00 America/New_York.');
 globalThis[key]=setInterval(run,60000);globalThis[key].unref?.();setTimeout(run,5000).unref?.();
}
