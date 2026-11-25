const activeBooking=new Set(['Scheduled','Confirmed','Checked in','Checked-in','Completed','No-show']);
const methodName=value=>{
 const name=String(value||'').trim();
 if(!name||/recorded by|manual/i.test(name))return 'Method not recorded';
 for(const [pattern,label] of [[/stripe/i,'Stripe'],[/zelle/i,'Zelle'],[/cash/i,'Cash'],[/helcim/i,'Helcim']])if(pattern.test(name))return label;
 return name;
};
export async function attachCardPayments(db,business,clients){
 const [appointments,members,orders,sales]=await Promise.all([
  db.query(`SELECT a.id,a.data::jsonb AS details,p.status AS checkout_status,
   EXISTS(SELECT 1 FROM events e WHERE e.owner=a.owner AND e.kind='cash_sale' AND e.data::jsonb->>'bookingId'=a.id) AS cash_paid
   FROM appointments a LEFT JOIN booking_payments p ON p.booking_id=a.id AND p.business_id=$1 WHERE a.owner=$2`,[business.id,business.owner_id]),
  db.query(`SELECT EXISTS(SELECT 1 FROM merchant_accounts ma WHERE ma.business_id=m.business_id AND ma.charges_enabled AND ma.onboarding_complete) AS online_ready,m.id,m.status,m.customer_email,m.stripe_account_id,p.price_cents,m.stripe_subscription_id,m.last_paid_at,m.initial_paid_at,p.name,
   (SELECT e.snapshot->>'paymentMethod' FROM membership_payment_emails e WHERE e.business_id=m.business_id AND e.membership_id=m.id AND (e.snapshot->>'amountCents')::int>0 ORDER BY e.created_at DESC LIMIT 1) AS method,
   EXISTS(SELECT 1 FROM stripe_payment_receipts r WHERE r.business_id=m.business_id AND r.membership_id=m.id) AS stripe_paid
   FROM customer_memberships m JOIN membership_plans p ON p.id=m.plan_id WHERE m.business_id=$1`,[business.id]),
  db.query("SELECT id,member_number,customer_email,payment_method,status,total_cents FROM product_orders WHERE business_id=$1 AND submitted_at IS NOT NULL AND status IN ('pending','paid','partially_refunded')",[business.id]),
  db.query("SELECT data::jsonb AS sale FROM events WHERE owner=$1 AND kind='cash_sale' AND data::jsonb->>'memberNumber' IS NOT NULL AND data::jsonb->>'bookingId' IS NULL",[business.owner_id])
 ]);
 const bookings=new Map(appointments.rows.map(row=>[row.id,row])),plans=new Map(members.rows.map(row=>[row.id,row])),products=new Map();
 for(const row of orders.rows){if(!products.has(row.member_number))products.set(row.member_number,[]);products.get(row.member_number).push(row);}
 for(const c of clients){
  const due=[],methods=new Set();
  if(c.memberNumber&&sales.rows.some(r=>r.sale.memberNumber===c.memberNumber&&!r.sale.productOrderId))methods.add('Cash');
  for(const v of c.history||[]){
   const row=bookings.get(v.id);if(!row||row.details.sample)continue;
   const d=row.details;
   if(row.checkout_status==='paid'||row.cash_paid||d.paymentStatus==='paid')methods.add(methodName(d.paymentProvider|| (row.checkout_status==='paid'?'Stripe':row.cash_paid?'Cash':'')));
   else if(activeBooking.has(v.status)&&!d.membershipCovered&&Number(d.price)>0)due.push({kind:'booking',id:v.id,label:v.serviceNames.join(', ')+' · '+v.date,email:d.email,price:Number(d.price),date:v.date});
  }
  for(const id of c.enrollmentIds||[]){
   const m=plans.get(id);if(!m)continue;
   if(m.method||m.stripe_paid||m.last_paid_at||m.initial_paid_at)methods.add(methodName(m.method||(m.stripe_paid?'Stripe':'')));
   if(['pending_payment','past_due','payment_failed'].includes(m.status))due.push({kind:m.stripe_subscription_id?'invoice':m.online_ready?'membership':'offlineMembership',id,label:m.name,email:m.customer_email,price:Number(m.price_cents)/100,manualMethods:!m.stripe_subscription_id&&!m.stripe_account_id?.startsWith('acct_')?['Cash','Zelle']:[]});
  }
  for(const o of products.get(c.memberNumber)||[]){
   if(o.status==='pending')due.push({kind:'product',id:o.id,label:'Product order · $'+(o.total_cents/100).toFixed(2),email:o.customer_email,price:Number(o.total_cents)/100,manualMethods:o.payment_method==='cash'?['Cash']:o.payment_method==='zelle'?['Zelle']:[]});
   else methods.add(methodName(o.payment_method));
  }
  c.cardPayments={due,methods:[...methods]};
 }
}
