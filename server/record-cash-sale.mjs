const read=v=>typeof v==='string'?JSON.parse(v):v||{};
/** Record received cash atomically; linking is explicit and never inferred from a client name. */
export async function recordCashSale(pool,{owner,eventId,bookingId,lines,taxRate}){
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const total=lines.reduce((n,l)=>n+Math.round(Number(l.price)*100)*l.qty,0);
  if(!Number.isSafeInteger(total)||total<0)throw Error('Invalid sale total.');
  let booking;
  if(bookingId){
   booking=(await db.query("SELECT a.id,a.data,a.status,b.id AS business_id FROM appointments a JOIN businesses b ON b.owner_id=a.owner AND b.status='active' WHERE a.owner=$1 AND a.id=$2 FOR UPDATE OF a",[owner,bookingId])).rows[0];
   if(!booking||!['Confirmed','Scheduled','Checked in','Checked-in','Completed','No-show'].includes(booking.status))throw Error('Choose an unpaid booking for this business.');
   const data=read(booking.data);
   const provider=(await db.query('SELECT status,stripe_checkout_session_id,terminal_payment_intent_id FROM booking_payments WHERE booking_id=$1 AND business_id=$2 FOR UPDATE',[bookingId,booking.business_id])).rows[0];
   if(data.paymentStatus==='paid'||provider?.status==='paid')throw Error('This booking is already paid.');
   if(provider?.stripe_checkout_session_id||provider?.terminal_payment_intent_id)throw Error('This booking has a card checkout. Resolve that checkout before linking a cash payment.');
   const prior=(await db.query("SELECT data FROM events WHERE owner=$1 AND kind='cash_sale'",[owner])).rows.some(r=>read(r.data).bookingId===bookingId);
   if(prior)throw Error('Cash has already been recorded for this booking.');
   const expected=Math.round(Number(data.price)*100),services=lines.filter(l=>l.type==='service');
   const ids=Array.isArray(data.serviceIds)&&data.serviceIds.length?data.serviceIds:null;
   const keys=ids||data.services||[],actual=services.map(l=>ids?l.id:l.name);
   if(data.membershipCovered||!Number.isSafeInteger(expected)||expected<=0||services.some(l=>l.qty!==1)||keys.length!==actual.length||keys.some(k=>!actual.includes(k))||services.reduce((n,l)=>n+Math.round(l.price*100)*l.qty,0)!==expected)
    throw Error('To settle this booking, add its exact services and full quoted amount. Retail items may be added separately.');
   booking.data=data;
  }
  const data={lines,total:total/100,tax:total/100*taxRate/100,payment:'Cash recorded manually',...(booking?{bookingId:booking.id,client:booking.data.name||''}:{})};
  const saved=await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'cash_sale',$4) ON CONFLICT DO NOTHING RETURNING id",[eventId,owner,new Date().toISOString(),JSON.stringify(data)]);
  if(!saved.rows.length)throw Error('This sale reference was already recorded. Refresh before recording another sale.');
  if(booking){
   await db.query('UPDATE appointments SET data=$1 WHERE id=$2 AND owner=$3',[JSON.stringify({...booking.data,paymentStatus:'paid',paymentProvider:'cash',paymentReference:eventId}),booking.id,owner]);
   await db.query("UPDATE booking_client_messages SET status='superseded',detail='Payment recorded by owner',updated_at=now() WHERE booking_id=$1 AND event_type='payment_link' AND status IN ('queued','failed','not_configured')",[booking.id]);
  }
  await db.query('COMMIT');return {ok:true,bookingSettled:!!booking};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
