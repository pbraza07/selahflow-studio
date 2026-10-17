import {memberIdMembershipSummary} from './member-id-summary.mjs';
import {bookingConfirmationInstructions} from './booking-confirmation-copy.mjs';
import {sendNotificationChannel,validEmail,maskDestination} from './notification-delivery.mjs';
const clean=x=>String(x??'').replace(/[<>\r\n]/g,' ').slice(0,300);
const obj=x=>typeof x==='string'?JSON.parse(x):x||{};
export function receiptLinks(origin,slug){const host=new URL(origin);if(host.protocol!=='https:'&&host.hostname!=='localhost')throw Error('A secure application URL is required.');const booking=host.origin+'/book/'+encodeURIComponent(slug);return {booking,status:booking+'#registration-status',membership:host.origin+'/membership/'+encodeURIComponent(slug)};}
export async function bookingReceiptSnapshot(db,{owner,bookingId,date,start,duration,staff,data,origin,pending=false}){
 const business=(await db.query("SELECT b.id,b.slug,b.name,s.data AS settings FROM businesses b LEFT JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
 if(!business)throw Error('Business not found.');
 const config=obj(business.settings),d=obj(data),memberNumber=clean(d.memberNumber).toUpperCase();
 const membership=memberNumber?await memberIdMembershipSummary(db,owner,memberNumber):null;
 return {businessId:business.id,business:clean(business.name),reference:d.bookingRequestId||bookingId,memberNumber,
  name:clean(d.name||d.customerName),email:String(d.email||d.customerEmail||'').trim(),date:clean(date),start:Number(start),duration:Number(duration),
  services:(d.services||[]).map(clean),staff:clean(config.staff?.find(s=>s.id===staff)?.name||'Team member'),
  address:clean(config.address),phone:clean(config.phone),price:Number(d.price??d.quotedPrice??0),membershipCovered:d.membershipCovered===true,
  pending,membership:membership?.status==='active'?membership:null,links:receiptLinks(origin,business.slug),instructions:bookingConfirmationInstructions(pending)};
}
export function bookingReceiptMessage(receipt,{event='submission',paymentLink=''}={}){
 const r=receipt,paid=event==='payment_confirmation',approved=event!=='submission'||!r.pending;
 const heading=paid?'Payment received':event==='payment_link'?'Booking approved — payment requested':approved?'Booking approved':'Booking request received';
 const time=`${Math.floor(r.start/60)%12||12}:${String(r.start%60).padStart(2,'0')} ${r.start<720?'AM':'PM'} Eastern`;
 const amount=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(r.price);
 const membership=r.membership?`\nActive membership: ${r.membership.name}\nMembership type: ${r.membership.type}\nSessions left: ${r.membership.sessionsLeft}\nSessions taken / used: ${r.membership.sessionsUsed} (check-ins and no-shows)\nSessions included: ${r.membership.sessionsIncluded}\nBalances are a snapshot at the time of this email. Booking alone does not use a session.\n`:'';
 const payment=paid?`${amount} paid. Thank you! Your Stripe payment has been verified.`:r.price<=0?(r.membershipCovered?'No payment due — covered by your membership.':'No payment due.'):!approved?`${amount} quoted. If payment is due after approval, we will email your payment instructions.`:paymentLink?`${amount} due.\nPay securely with Stripe: ${paymentLink}\nThis private link expires in 30 days. Do not forward it.`:`${amount} due. Check payment options with your registration status: ${r.links.status}`;
 return {subject:`${heading} — ${r.business}`,text:`Hello ${r.name},\n\n${heading} at ${r.business}. ${approved?'We look forward to seeing you!':'Thanks for sending your request!'}\n\nMembership ID: ${r.memberNumber||'Contact the business'}\nBooking reference: ${r.reference}\nServices: ${r.services.join(', ')}\nDate: ${r.date}\nTime: ${time}\nDuration: ${r.duration} minutes\nTeam member: ${r.staff}${r.address?'\nLocation: '+r.address:''}\n\n${payment}\n${membership}\n${bookingConfirmationInstructions(!approved)}\n\nCheck registration & membership details: ${r.links.status}\nBook another visit: ${r.links.booking}\nInterested in a membership? Explore plans and sign up: ${r.links.membership}\n\nQuestions or changes? Contact ${r.business}${r.phone?' at '+r.phone:''}.`,sms:`${r.business}: ${heading}. ${r.date} ${time}. ID ${r.memberNumber||'see email'}. ${paymentLink?'Pay: '+paymentLink:paid?amount+' paid.':'Details: '+r.links.status}`};
}
export async function queueBookingReceipt(db,input,{event='submission'}={}){
 const receipt=await bookingReceiptSnapshot(db,input),message=bookingReceiptMessage(receipt,{event});
 await db.query('INSERT INTO booking_receipt_emails(booking_key,event_type,business_id,destination,destination_masked,message) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING',[input.bookingId,event,receipt.businessId,receipt.email,maskDestination(receipt.email,'email'),JSON.stringify(message)]);
 const {email,...publicReceipt}=receipt;
 return publicReceipt;
}
export async function processBookingReceipts(pool,{send=sendNotificationChannel,limit=10}={}){
 await pool.query("UPDATE booking_receipt_emails SET status='unknown',detail='Delivery outcome unknown; check provider before resending',updated_at=now() WHERE status='processing' AND updated_at<now()-interval '2 minutes'");
 let processed=0;
 for(let i=0;i<limit;i++){
  const item=(await pool.query("UPDATE booking_receipt_emails SET status='processing',updated_at=now() WHERE (booking_key,event_type)=(SELECT m.booking_key,m.event_type FROM booking_receipt_emails m JOIN businesses b ON b.id=m.business_id WHERE b.status='active' AND ((m.status IN ('queued','failed') AND m.attempts<3) OR m.status='not_configured') AND m.next_attempt_at<=now() ORDER BY m.next_attempt_at FOR UPDATE OF m SKIP LOCKED LIMIT 1) RETURNING *")).rows[0];
  if(!item)break;processed++;
  try{
   const exists=(await pool.query("SELECT 1 FROM businesses b WHERE b.id=$1 AND b.status='active' AND (EXISTS(SELECT 1 FROM booking_requests r WHERE r.id=$2 AND r.business_id=b.id) OR EXISTS(SELECT 1 FROM appointments a WHERE a.id=$2 AND a.owner=b.owner_id AND ($3='submission' OR a.status<>'Cancelled')))",[item.business_id,item.booking_key,item.event_type])).rows.length>0;
   const result=!exists?{status:'superseded',detail:'Booking no longer available'}:!validEmail(item.destination)?{status:'invalid_destination',detail:'Registration email missing or invalid'}:await send('email',item.destination,{...obj(item.message),idempotencyKey:'booking-receipt-'+item.booking_key+'-'+item.event_type,trackAmbiguous:true});
   await pool.query("UPDATE booking_receipt_emails SET status=$1,detail=$2,attempts=attempts+CASE WHEN $1='failed' THEN 1 ELSE 0 END,next_attempt_at=now()+interval '5 minutes',updated_at=now() WHERE booking_key=$3 AND event_type=$4 AND status='processing'",[result.status,result.detail,item.booking_key,item.event_type]);
  }catch{await pool.query("UPDATE booking_receipt_emails SET status='unknown',detail='Delivery outcome unknown; check provider before resending',updated_at=now() WHERE booking_key=$1 AND event_type=$2 AND status='processing'",[item.booking_key,item.event_type]);}
 }
 return {processed};
}
