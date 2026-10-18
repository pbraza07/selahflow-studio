import {createHash} from 'node:crypto';
const historyKey=r=>createHash('sha256').update(JSON.stringify([r.id,r.at,r.status])).digest('hex');
import {reconcileMembershipPayments} from './report-payments.mjs';
const data=x=>{try{return typeof x==='string'?JSON.parse(x):x||{};}catch{return {};}};
const stamp=x=>x instanceof Date?x.toISOString():String(x||'');
const identity=d=>({client:d.name||d.customerName||d.customer_name||'',email:d.email||d.customerEmail||d.customer_email||'',memberNumber:d.memberNumber||d.member_number||''});
const labels={submission:'Booking submission email',approval:'Booking approval email',payment_link:'Payment link',payment_confirmation:'Payment confirmation',session_used:'Membership session used',session_credit:'Membership sessions credited',adjustment:'Membership adjustment'};
export const HISTORY_CATEGORIES=['all','bookings','sessions','payments','memberships','messages'];
/** Read retained source records only. History never changes billing or attendance. */
export async function loadOwnerHistory(db,owner,filters={}){
 const business=(await db.query("SELECT id FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
 if(!business)throw Error('FORBIDDEN');
 const results=await Promise.all([
  db.query('SELECT id,date,start,duration,staff,status,data FROM appointments WHERE owner=$1',[owner]),
  db.query('SELECT id,date,start_minute,duration,staff_id,status,details,created_at,reviewed_at,appointment_id FROM booking_requests WHERE owner_id=$1',[owner]),
  db.query('SELECT p.booking_id,p.status,p.amount_cents,p.created_at,p.paid_at,p.updated_at FROM booking_payments p JOIN businesses b ON b.id=p.business_id WHERE b.owner_id=$1',[owner]),
  db.query('SELECT m.id,m.customer_name,m.customer_email,m.member_number,m.status,m.created_at,m.sessions_included,m.sessions_used,p.name AS plan_name FROM customer_memberships m JOIN businesses b ON b.id=m.business_id LEFT JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE b.owner_id=$1',[owner]),
  db.query('SELECT l.id,l.membership_id,l.appointment_id,l.event_type,l.session_delta,l.amount_cents,l.created_at FROM membership_session_ledger l JOIN businesses b ON b.id=l.business_id WHERE b.owner_id=$1',[owner]),
  db.query("SELECT id,created,kind,data FROM events WHERE owner=$1 AND kind IN ('status','cash_sale','membership_payment')",[owner]),
  db.query("SELECT m.id,m.booking_id,m.event_type,m.channel,m.destination_masked,m.status,m.detail,m.updated_at,m.message->>'subject' AS subject FROM booking_client_messages m JOIN booking_client_flows f ON f.booking_id=m.booking_id JOIN businesses b ON b.id=f.business_id WHERE b.owner_id=$1",[owner]),
  db.query("SELECT m.booking_key,m.event_type,m.destination_masked,m.status,m.detail,m.updated_at,m.message->>'subject' AS subject FROM booking_receipt_emails m JOIN businesses b ON b.id=m.business_id WHERE b.owner_id=$1",[owner]),
  db.query('SELECT n.id,n.request_id,n.channel,n.destination_masked,n.status,n.detail,n.attempted_at FROM booking_notification_attempts n JOIN booking_requests r ON r.id=n.request_id WHERE r.owner_id=$1',[owner]),
  db.query('SELECT r.id,r.details,r.status,r.created_at,r.reviewed_at,p.name AS plan_name FROM membership_requests r JOIN businesses b ON b.id=r.business_id LEFT JOIN membership_plans p ON p.id=r.plan_id AND p.business_id=r.business_id WHERE b.owner_id=$1',[owner])
 ]);
 const [appointments,requests,payments,members,ledger,audit,messages,receipts,attempts,membershipRequests]=results.map(r=>r.rows);
 const bookings=new Map(),memberMap=new Map(members.map(m=>[m.id,m]));
 for(const a of appointments)bookings.set(a.id,{...identity(data(a.data)),data:data(a.data),date:a.date});
 for(const r of requests){const context={...identity(data(r.details)),data:data(r.details),date:r.date};bookings.set(r.id,context);if(r.appointment_id&&!bookings.has(r.appointment_id))bookings.set(r.appointment_id,context);}
 const rows=[];
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const localKey=at=>{const value=stamp(at);if(!/(?:Z|[+-]\d\d:\d\d)$/.test(value)||Number.isNaN(Date.parse(value)))return value;const p=Object.fromEntries(formatter.formatToParts(new Date(value)).map(v=>[v.type,v.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;};
 const add=(row,context={})=>rows.push({client:context.client||'',memberNumber:context.memberNumber||'',email:context.email||'',details:[],...row,date:localKey(row.at).slice(0,10),order:localKey(row.at)});
 for(const a of appointments){const d=data(a.data);add({id:'booking:'+a.id,category:'bookings',at:a.date+'T'+String(Math.floor(a.start/60)).padStart(2,'0')+':'+String(a.start%60).padStart(2,'0')+':00',title:(d.services||[]).join(', ')||'Appointment',status:a.status,reference:a.id,session:!!d.sessionId,quoteCents:Math.round(Number(d.price||0)*100),details:[`${a.duration} minutes`,d.membershipCovered?'Membership covered':'Quoted amount is not proof of payment',...(d.sessionId?['Group session '+d.sessionId]:[])]},bookings.get(a.id));}
 for(const r of requests)add({id:'request:'+r.id,category:'bookings',at:stamp(r.created_at),title:'Booking request · '+(data(r.details).services||[]).join(', '),status:r.status,reference:r.id,details:['Requested visit: '+r.date, ...(r.reviewed_at?['Reviewed: '+stamp(r.reviewed_at)]:[])]},bookings.get(r.id));
 for(const p of payments)add({id:'stripe:'+p.booking_id,category:'payments',at:stamp(p.paid_at||p.updated_at||p.created_at),title:'Stripe booking payment',status:p.status,reference:p.booking_id,amountCents:Number(p.amount_cents),details:[p.status==='paid'?'Verified payment recorded':'Checkout amount; payment has not been verified']},bookings.get(p.booking_id));
 for(const m of members)add({id:'member:'+m.id,category:'memberships',at:stamp(m.created_at),title:'Membership registration · '+(m.plan_name||'Retained membership'),status:m.status,reference:m.id,details:['Current snapshot: '+Math.max(0,m.sessions_included-m.sessions_used)+' sessions left; '+m.sessions_used+' used.']},identity(m));
 for(const l of ledger)if(l.event_type!=='payment_confirmed')add({id:'ledger:'+l.id,category:l.event_type==='session_used'?'sessions':'memberships',at:stamp(l.created_at),title:labels[l.event_type]||l.event_type,status:'recorded',reference:l.appointment_id||l.membership_id,sessionDelta:Number(l.session_delta),details:[memberMap.get(l.membership_id)?.plan_name||'Membership ledger']},identity(memberMap.get(l.membership_id)||{}));
 const events=audit.map(e=>({...data(e.data),id:e.id,kind:e.kind,created:stamp(e.created)}));
 const membershipPayments=reconcileMembershipPayments(events,ledger.filter(l=>l.event_type==='payment_confirmed').map(l=>({...l,created:stamp(l.created_at)})));
 for(const p of membershipPayments)add({id:'membership-payment:'+p.id,category:'payments',at:p.created,title:p.renewal?'Membership renewal payment':'Membership payment',status:'paid',reference:p.membershipId,amountCents:p.amountCents,details:['Recorded membership payment; audit and ledger copies reconciled once.']},identity(memberMap.get(p.membershipId)||{member_number:p.memberNumber}));
 for(const e of events){if(e.kind==='status')add({id:'attendance:'+e.id,category:'sessions',at:e.created,title:e.attendanceCorrection?'Attendance correction':'Attendance / status change',status:e.status,reference:e.appointment,details:[e.previousStatus?'Previously: '+e.previousStatus:'',e.membershipDeducted?'One membership session deducted':e.alreadyDeducted?'Session previously deducted; no second deduction':'No session deducted'].filter(Boolean)},bookings.get(e.appointment));
  if(e.kind==='cash_sale')add({id:'cash:'+e.id,category:'payments',at:e.created,title:'Recorded cash sale',status:'recorded',reference:e.id,amountCents:Math.round(Number(e.total||0)*100),details:[(e.lines||[]).map(l=>`${l.qty} × ${l.name}`).join(', '),'Original recorded sale; history is not the filtered revenue report.']},identity(e));}
 for(const r of membershipRequests)add({id:'membership-request:'+r.id,category:'memberships',at:stamp(r.created_at),title:'Membership request · '+(r.plan_name||'Membership'),status:r.status,reference:r.id,details:r.reviewed_at?['Reviewed: '+stamp(r.reviewed_at)]:[]},identity(data(r.details)));
 const addMessage=(m,key,context)=>add({id:key,category:'messages',at:stamp(m.updated_at||m.attempted_at),title:labels[m.event_type]||'Owner approval notification',status:m.status,reference:m.booking_id||m.booking_key||m.request_id,retryable:!!m.updated_at&&['failed','not_configured'].includes(m.status),details:[(m.channel||'email')+' · '+(m.destination_masked||'No recipient'),m.subject?'Subject: '+m.subject:'',m.detail||'',m.attempted_at?'Recorded delivery attempt':'Latest saved delivery outcome; submitted means provider acceptance.'].filter(Boolean)},context);
 for(const m of messages)addMessage(m,'message:'+m.id,bookings.get(m.booking_id));
 for(const m of receipts)addMessage(m,'receipt:'+m.booking_key+':'+m.event_type,bookings.get(m.booking_key));
 for(const m of attempts)addMessage(m,'attempt:'+m.id,bookings.get(m.request_id));
 const q=String(filters.q||'').trim().toLowerCase().slice(0,100),category=HISTORY_CATEGORIES.includes(filters.category)?filters.category:'all';
 const aliases=new Set([filters.member]);
 if(filters.member)for(const r of (await db.query('SELECT member_number FROM business_member_ids WHERE business_id=$1 AND identity_key=(SELECT identity_key FROM business_member_ids WHERE business_id=$1 AND member_number=$2)',[business.id,filters.member])).rows)aliases.add(r.member_number);
 const hidden=new Set((await db.query('SELECT history_id FROM owner_history_hidden WHERE owner=$1',[owner])).rows.map(r=>r.history_id));
 const scoped=rows.filter(r=>!hidden.has(historyKey(r))).filter(r=>(!filters.member||aliases.has(r.memberNumber))&&(!filters.clientEmail||r.email.toLowerCase()===filters.clientEmail.toLowerCase())&&(!filters.clientName||r.client.toLowerCase()===filters.clientName.toLowerCase()));
 const matching=scoped.filter(r=>(!filters.from||r.date>=filters.from)&&(!filters.to||r.date<=filters.to)&&(!q||[r.client,r.memberNumber,r.email,r.title,r.status,r.reference,...r.details].join(' ').toLowerCase().includes(q)));
 const counts=Object.fromEntries(HISTORY_CATEGORIES.map(c=>[c,matching.filter(r=>c==='all'||r.category===c||c==='sessions'&&r.session).length]));
 const filtered=matching.filter(r=>category==='all'||r.category===category||category==='sessions'&&r.session).sort((a,b)=>b.order.localeCompare(a.order)||a.id.localeCompare(b.id));
 const pageSize=30,page=Math.min(Math.max(1,Math.floor(Number(filters.page)||1)),Math.max(1,Math.ceil(filtered.length/pageSize)));
 if(filters.clear===true){
  for(const r of rows)await db.query('INSERT INTO owner_history_hidden(owner,history_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[owner,historyKey(r)]);
  return {cleared:rows.length};
 }
 return {items:filtered.slice((page-1)*pageSize,page*pageSize).map(({email,order,...safe})=>safe),total:filtered.length,page,pageSize,counts};
}
