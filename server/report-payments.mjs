// Audit payment totals before v1.3.79 were cents despite being named `total`.
// Preserve source history; reconcile ledger copies
// one-to-one before applying any report date filter.
export function reconcileMembershipPayments(events, ledger) {
 const payments=events.filter(e=>e.kind==='membership_payment').map(e=>({...e,
  amountCents:Number(e.amountCents??e.total??0),
 }));
 const unmatched=new Set(payments.map((_,i)=>i));
 for(const row of ledger){
  const cents=Number(row.amount_cents||0);
  const matches=[...unmatched].filter(i=>{
   const p=payments[i];
   if(p.membershipId!==row.membership_id||p.amountCents!==cents)return false;
   if(p.requestId)return p.requestId===row.appointment_id;
   // Old manual writes used separate timestamps within the same transaction.
   return Math.abs(Date.parse(p.created)-Date.parse(row.created))<=5000;
  }).sort((a,b)=>Math.abs(Date.parse(payments[a].created)-Date.parse(row.created))-Math.abs(Date.parse(payments[b].created)-Date.parse(row.created)));
  if(matches.length){unmatched.delete(matches[0]);continue;}
  payments.push({id:row.id,kind:'membership_payment',created:row.created,
   membershipId:row.membership_id,amountCents:cents});
 }
 return payments.filter(p=>Number.isSafeInteger(p.amountCents)&&p.amountCents>=0)
  .map(p=>({...p,total:p.amountCents/100}));
}

export async function loadMembershipReportPayments(db,owner){
 const [audit,ledger,members]=await Promise.all([
  db.query("SELECT id,created,kind,data FROM events WHERE owner=$1 AND kind='membership_payment' ORDER BY created,id",[owner]),
  db.query("SELECT l.id,l.created_at::text AS created,l.amount_cents,l.membership_id,l.appointment_id FROM membership_session_ledger l JOIN businesses b ON b.id=l.business_id WHERE b.owner_id=$1 AND l.event_type='payment_confirmed' ORDER BY l.created_at,l.id",[owner]),
  db.query('SELECT m.id FROM customer_memberships m JOIN businesses b ON b.id=m.business_id JOIN membership_plans p ON p.id=m.plan_id AND p.business_id=m.business_id WHERE b.owner_id=$1',[owner])
 ]);
 const retained=new Set(members.rows.map(m=>m.id));
 return reconcileMembershipPayments(audit.rows.map(r=>({...JSON.parse(r.data),id:r.id,created:r.created,kind:r.kind})),ledger.rows)
  .filter(p=>retained.has(p.membershipId));
}

// Only remove deleted service lines from a mixed sale; retain the original
// recorded price/quantity of every remaining line, including retail products.
export function reportSaleEvents(events,services){
 const retained=new Set(services.map(s=>s.id));
 return events.flatMap(event=>{
  if(event.kind!=='cash_sale')return [event];
  const lines=(event.lines||[]).filter(l=>l.type!=='service'||retained.has(l.id));
  if(!lines.length)return [];
  const total=lines.reduce((sum,l)=>sum+Math.round(Number(l.price)*100)*Number(l.qty),0)/100;
  return [{...event,lines,total}];
 });
}
