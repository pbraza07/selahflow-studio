import {createHash} from 'node:crypto';
const obj=x=>typeof x==='string'?JSON.parse(x):x||{};
/** Accounting facts survive operational deletion; provider receipts remain separately reconcilable. */
export async function retainDeletedClientFinancials(db,{businessId,specs}){
 const rows=table=>specs.find(s=>s.table===table)?.rows||[];
 let retained=0;
 const save=async(kind,key,cents,tax,at)=>{
  if(!Number.isSafeInteger(cents)||cents<0)throw Error('Financial retention amount requires review. Deletion stopped.');
  const hash=createHash('sha256').update(businessId+'|'+kind+'|'+key).digest('hex');
  const r=await db.query('INSERT INTO client_financial_retention(business_id,source_digest,entry_kind,amount_cents,tax_cents,occurred_at) VALUES($1,$2,$3,$4,$5,$6::timestamptz) ON CONFLICT DO NOTHING RETURNING id',[businessId,hash,kind,cents,Number.isSafeInteger(tax)?tax:0,at||new Date().toISOString()]);
  retained+=r.rows.length;
 };
 const receipts=rows('stripe_payment_receipts');
 for(const r of receipts)await save('stripe_receipt',r.stripe_account_id+'|'+r.provider_reference,Number(r.amount_cents),0,r.created_at);
 for(const r of rows('booking_payments'))if(r.status==='paid'&&!receipts.some(p=>p.booking_id===r.booking_id))await save('booking_payment',r.booking_id,Number(r.amount_cents),0,r.paid_at||r.created_at);
 const ledger=rows('membership_session_ledger').filter(r=>r.event_type==='payment_confirmed');
 for(const r of ledger)if(!receipts.some(p=>'stripe:'+p.provider_reference===r.appointment_id))await save('membership_payment',r.id,Number(r.amount_cents),0,r.created_at);
 for(const event of rows('events')){
  const data=obj(event.data);
  if(event.kind==='cash_sale'){
   if(receipts.some(r=>r.provider_reference===data.providerReference)||rows('booking_payments').some(r=>r.status==='paid'&&r.booking_id===data.bookingId))continue;
   await save('cash_sale',event.id,Math.round(Number(data.total)*100),Math.round(Number(data.tax||0)*100),event.created);
  }else if(event.kind==='membership_payment'){
   // Ambiguous legacy audit/ledger pairs require reconciliation, never guessing.
   if(ledger.some(r=>r.membership_id===(data.membershipId||data.membership_id))){
    if(!ledger.some(r=>r.appointment_id===data.requestId||r.id===data.paymentId))throw Error('Legacy membership accounting requires reconciliation before deletion.');
    continue;
   }
   if(receipts.some(r=>r.membership_id===(data.membershipId||data.membership_id)))throw Error('Legacy membership accounting requires reconciliation before deletion.');
   await save('membership_payment',event.id,Number.isFinite(Number(data.amountCents))?Number(data.amountCents):Math.round(Number(data.amount||data.total||0)*100),0,event.created);
  }
 }
 return retained;
}
