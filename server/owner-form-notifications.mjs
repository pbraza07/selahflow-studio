import {registrationNotificationLines} from './registration-questions.mjs';
import {notificationRecipient,sendNotificationChannel} from './notification-delivery.mjs';
import {isStaging} from './staging-safety.mjs';
import {sendWebPush} from './push-crypto.mjs';
const obj=x=>typeof x==='string'?JSON.parse(x):x||{};
/** Caller owns registration transaction; no sends occur before it commits. */
export async function queueOwnerFormNotification(db,{businessId,sourceId,form,values,answers={}}){
 const business=(await db.query("SELECT b.name,b.slug,b.owner_id,u.email,s.data FROM businesses b JOIN users u ON u.id=b.owner_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.id=$1 AND b.status='active'",[businessId])).rows[0];
 if(!business)return;
 values={...values,firstName:values.firstName||String(values.name||'').split(' ')[0],lastName:values.lastName||String(values.name||'').split(' ').slice(1).join(' '),email:values.email||values.customerEmail,phone:values.phone||values.customerPhone};
 const config=obj(business.data),lines=registrationNotificationLines(config,form,values,answers);
 if(!lines.length)return;
 const recipient=notificationRecipient(config,business.email),title=form==='membership'?'New membership registration':'New booking';
 const message={subject:title+' — '+business.name,text:title+' at '+business.name+'\n'+lines.join('\n'),sms:title+' · '+lines.join(' · ').slice(0,350),title,body:lines.join(' · ').slice(0,220),url:'/studio/'+encodeURIComponent(business.slug),businessId};
 const destinations=[];
 if(config.bookingNotifyEmail===true&&recipient.email)destinations.push(['email',recipient.email]);
 if(config.bookingNotifySms===true&&recipient.phone)destinations.push(['sms',recipient.phone]);
 if(config.bookingApprovalEnabled===true){
  const reviewers=recipient.reviewer==='owner'?['owner']:['owner',recipient.reviewer];
  const subs=(await db.query('SELECT id FROM business_push_subscriptions WHERE business_id=$1 AND reviewer=ANY($2::text[]) LIMIT 40',[businessId,reviewers])).rows;
  for(const sub of subs)destinations.push(['push',sub.id]);
 }
 for(const [channel,destination] of destinations)await db.query('INSERT INTO owner_form_notifications(business_id,source_id,form,channel,destination,message) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING',[businessId,sourceId,form,channel,destination,JSON.stringify(message)]);
}
export async function processOwnerFormNotifications(pool,{send=sendNotificationChannel,push=sendWebPush,limit=10}={}){
 await pool.query("UPDATE owner_form_notifications SET status='unknown',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '2 minutes'");
 for(let n=0;n<limit;n++){
  const row=(await pool.query("UPDATE owner_form_notifications SET status='processing',updated_at=now() WHERE id=(SELECT id FROM owner_form_notifications WHERE status IN ('queued','failed','not_configured') AND attempts<3 AND next_attempt_at<=now() ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *")).rows[0];
  if(!row)break;
  try{
   const business=(await pool.query("SELECT s.data,b.owner_id,u.email FROM businesses b JOIN users u ON u.id=b.owner_id LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.id=$1 AND b.status='active'",[row.business_id])).rows[0];
   const config=obj(business?.data),recipient=notificationRecipient(config,business?.email);
   const exists=business&&(row.form==='membership'?(await pool.query('SELECT 1 FROM membership_requests WHERE business_id=$1 AND id=$2',[row.business_id,row.source_id])).rows.length:(await pool.query('SELECT 1 FROM appointments WHERE owner=$1 AND id=$2',[business.owner_id,row.source_id])).rows.length);
   let result={status:'superseded'};
   if(exists){
    if(row.channel==='push'&&config.bookingApprovalEnabled===true&&(!isStaging()||process.env.STAGING_NOTIFICATIONS_ENABLED==='true')){
     const sub=(await pool.query('SELECT endpoint,p256dh,auth,reviewer FROM business_push_subscriptions WHERE business_id=$1 AND id=$2',[row.business_id,row.destination])).rows[0];
     if(sub&&['owner',recipient.reviewer].includes(sub.reviewer))result=await push({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},{...obj(row.message),tag:'form-'+row.id});
    }else if(row.channel==='email'&&config.bookingNotifyEmail===true&&recipient.email===row.destination||row.channel==='sms'&&config.bookingNotifySms===true&&recipient.phone===row.destination){
     result=await send(row.channel,row.destination,{...obj(row.message),idempotencyKey:'owner-form-'+row.id,trackAmbiguous:true});
    }
   }
   await pool.query("UPDATE owner_form_notifications SET status=$1,attempts=attempts+CASE WHEN $1='failed' THEN 1 ELSE 0 END,next_attempt_at=now()+interval '5 minutes',updated_at=now() WHERE id=$2 AND status='processing'",[result.status,row.id]);
  }catch{await pool.query("UPDATE owner_form_notifications SET status='unknown',updated_at=now() WHERE id=$1 AND status='processing'",[row.id]);}
 }
}
