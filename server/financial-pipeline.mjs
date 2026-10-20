const dataOf=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
const centsOf=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v),c=Math.round(n*100);return Number.isFinite(n)&&Number.isSafeInteger(c)&&c>=0?c:null;};
const centsInteger=v=>v!==null&&v!==undefined&&Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):null;
export function bookingQuote(data,services=[]){
 if(data.membershipCovered===true)return {amountCents:0,basis:'Covered by membership'};
 const retained=new Set(services.map(s=>s.id));
 const lines=Array.isArray(data.paymentLines)?data.paymentLines:null;
 if(lines?.length){
  const kept=lines.filter(l=>l.type!=='service'||retained.has(l.id));
  if(!kept.length)return null;
  const values=kept.map(l=>{const c=centsOf(l.price),q=Number(l.qty);return c!==null&&Number.isInteger(q)&&q>0?c*q:null;});
  return {amountCents:values.some(v=>v===null)?null:values.reduce((a,b)=>a+b,0),basis:'Saved service quote'};
 }
 const ids=Array.isArray(data.serviceIds)?data.serviceIds:[];
 if(ids.length&&ids.every(id=>!retained.has(id)))return null;
 const names=Array.isArray(data.services)?data.services:[];
 const matches=services.filter(s=>ids.length?ids.includes(s.id):names.includes(s.name));
 if(!ids.length&&names.length&&!matches.length)return null;
 const saved=centsOf(data.price??data.quotedPrice);
 if(saved!==null)return {amountCents:saved,basis:'Saved service quote'};
 const values=matches.map(s=>centsOf(s.price));
 return {amountCents:values.length&&values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null,basis:'Current catalog estimate'};
}
/** Mutually exclusive unpaid stages. Paid receipts remain in the existing reconciled payment report. */
export function financialPipeline({appointments=[],requests=[],memberships=[],membershipRequests=[],sales=[],services=[]}){
 const paidBookings=new Set(sales.filter(e=>e.kind==='cash_sale'&&e.bookingId).map(e=>e.bookingId));
 const booked=new Set(appointments.map(a=>a.id)),rows=[];
 for(const a of appointments){
  const d=dataOf(a.data);
  if(!['Confirmed','Scheduled','Checked in','Checked-in','Completed'].includes(a.status)||a.verified_paid||d.paymentStatus==='paid'||paidBookings.has(a.id))continue;
  const quote=bookingQuote(d,services);if(!quote)continue;
  rows.push({id:'booking:'+a.id,reference:a.id,source:'Booking',category:quote.amountCents===0?'approved':a.payment_requested?'pending_payment':'approved',date:a.date,created:d.created||a.date,client:d.name||'Client',memberNumber:d.memberNumber||'',description:(d.services||[]).join(', ')||'Appointment',...quote});
 }
 for(const r of requests){
  if(r.status!=='pending'||r.appointment_id&&booked.has(r.appointment_id))continue;
  const d=dataOf(r.details),quote=bookingQuote(d,services);if(!quote)continue;
  rows.push({id:'request:'+r.id,reference:r.id,source:'Booking request',category:'submitted',date:r.date,created:r.created_at,client:d.name||d.customerName||'Client',memberNumber:d.memberNumber||'',description:(d.services||[]).map(s=>typeof s==='string'?s:s.name).join(', ')||'Booking request',...quote});
 }
 const memberIds=new Set(memberships.map(m=>m.id));
 for(const m of memberships){
  if(!['pending_payment','past_due','payment_failed'].includes(m.status))continue;
  rows.push({id:'membership:'+m.id,reference:m.id,source:'Membership',category:'pending_payment',date:m.created_at,created:m.created_at,client:m.customer_name,memberNumber:m.member_number||'',description:m.plan_name,amountCents:centsInteger(m.price_cents),basis:m.status==='past_due'?'Past-due period estimate; confirm provider invoice':'Registered package awaiting payment'});
 }
 for(const r of membershipRequests){
  if(r.status!=='pending'||r.membership_id&&memberIds.has(r.membership_id))continue;
  const d=dataOf(r.details),saved=centsInteger(d.quotedPriceCents);
  rows.push({id:'membership-request:'+r.id,reference:r.id,source:'Membership request',category:'submitted',date:r.created_at,created:r.created_at,client:d.name||'Client',memberNumber:d.memberNumber||'',description:d.quotedPlanName||r.plan_name,amountCents:saved??centsInteger(r.price_cents),basis:saved===null?'Current package estimate':'Submitted package quote'});
 }
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.id.localeCompare(b.id));
}
export async function loadFinancialPipeline(db,owner){
 const [business,appointments,requests,memberships,membershipRequests,sales]=await Promise.all([
  db.query("SELECT s.data FROM businesses b JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1 AND b.status='active'",[owner]),
  db.query(`SELECT a.id,a.date,a.status,a.data,(p.status='paid' AND p.stripe_payment_intent_id IS NOT NULL) AS verified_paid,
   (p.status IN ('pending','expired') OR f.booking_id IS NOT NULL) AS payment_requested
   FROM appointments a JOIN businesses b ON b.owner_id=a.owner AND b.status='active'
   LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=b.id
   LEFT JOIN booking_client_flows f ON f.booking_id=a.id AND f.business_id=b.id WHERE a.owner=$1`,[owner]),
  db.query("SELECT r.id,r.date,r.status,r.details,r.appointment_id,r.created_at::text FROM booking_requests r JOIN businesses b ON b.id=r.business_id AND b.owner_id=r.owner_id WHERE b.owner_id=$1 AND b.status='active'",[owner]),
  db.query("SELECT m.id,m.status,m.price_cents,m.customer_name,m.member_number,m.created_at::text,p.name AS plan_name FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=b.id WHERE b.owner_id=$1 AND b.status='active'",[owner]),
  db.query("SELECT r.id,r.status,r.details,r.membership_id,r.created_at::text,p.name AS plan_name,p.price_cents FROM membership_requests r JOIN businesses b ON b.id=r.business_id JOIN membership_plans p ON p.id=r.plan_id AND p.business_id=b.id WHERE b.owner_id=$1 AND b.status='active'",[owner]),
  db.query("SELECT id,data FROM events WHERE owner=$1 AND kind='cash_sale'",[owner])
 ]);
 if(!business.rows.length)throw Error('Business unavailable.');
 const config=dataOf(business.rows[0].data);
 return financialPipeline({appointments:appointments.rows,requests:requests.rows,memberships:memberships.rows,membershipRequests:membershipRequests.rows,sales:sales.rows.map(r=>({...dataOf(r.data),id:r.id,kind:'cash_sale'})),services:config.services||[]});
}
export function financialDate(raw,timezone='America/New_York'){
 if(!raw)return '';const text=String(raw);if(/^\d{4}-\d{2}-\d{2}$/.test(text))return text;const d=new Date(text);if(Number.isNaN(d.valueOf()))return '';
 try{return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}catch{return financialDate(raw,'America/New_York');}
}
export function financialRowsForRange(rows,range,date,timezone='America/New_York'){
 return rows.filter(r=>range==='All time'||(range==='Today'?financialDate(r.date,timezone)===date:financialDate(r.date,timezone).slice(0,7)===date.slice(0,7)));
}
export function financialStageTotals(rows){
 const result=Object.fromEntries(['submitted','approved','pending_payment','paid'].map(k=>[k,{amountCents:0,count:0,unpriced:0}]));
 for(const row of rows){const total=result[row.category];if(!total)continue;total.count++;if(row.amountCents===null||!Number.isSafeInteger(row.amountCents)||row.amountCents<0)total.unpriced++;else total.amountCents+=row.amountCents;}
 return result;
}
