import {trackingDateRange} from './calendar-team-tracking.mjs';
const obj=v=>typeof v==='string'?JSON.parse(v):v||{};
export async function servicePercentageReport(pool,{owner,from,to}){
 trackingDateRange(from,to);
 const b=(await pool.query("SELECT b.id,s.data FROM businesses b JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1 AND b.status='active'",[owner])).rows[0];
 if(!b)throw Error('Business unavailable.');
 const config=obj(b.data),rates=(await pool.query('SELECT staff_id,service_id,rate_bps FROM team_service_rates WHERE business_id=$1',[b.id])).rows;
 const rows=(await pool.query(`SELECT l.*,s.amount_cents AS settled_cents,s.reference,s.created_at AS settled_at,
 COALESCE(p.status,a.data::jsonb->>'paymentStatus',l.payment_status) AS customer_payment,
 a.id IS NULL AS source_removed FROM team_service_ledger l
 LEFT JOIN team_service_settlements s ON s.ledger_id=l.id AND s.business_id=l.business_id
 LEFT JOIN businesses b ON b.id=l.business_id
 LEFT JOIN appointments a ON a.id=l.appointment_id AND a.owner=b.owner_id
 LEFT JOIN booking_payments p ON p.business_id=l.business_id AND p.booking_id=l.appointment_id
 WHERE l.business_id=$1 AND l.service_date BETWEEN $2 AND $3 ORDER BY l.service_date DESC,l.id DESC`,[b.id,from,to])).rows;
 // Removed members retain their own bucket and immutable transaction snapshots.
 const buckets=new Map((config.staff||[]).map(s=>[s.id,{staffId:s.id,name:s.name,serviceCents:0,ownerCents:0,settledCents:0,balanceCents:0,count:0}]));
 for(const r of rows){let b=buckets.get(r.staff_id);if(!b){b={staffId:r.staff_id,name:r.staff_name,serviceCents:0,ownerCents:0,settledCents:0,balanceCents:0,count:0};buckets.set(r.staff_id,b);}if(!r.voided){b.serviceCents+=r.amount_cents;b.ownerCents+=r.owner_cents;b.count++;}b.settledCents+=r.settled_cents||0;b.balanceCents=b.ownerCents-b.settledCents;}
 return {from,to,staff:(config.staff||[]).map(s=>({id:s.id,name:s.name})),services:(config.services||[]).map(s=>({id:s.id,name:s.name})),rates,rows,buckets:[...buckets.values()]};
}
export async function saveServicePercentage(pool,{owner,input}){
 const db=await pool.connect();try{await db.query('BEGIN');
 const b=(await db.query("SELECT b.id,s.data FROM businesses b JOIN settings s ON s.owner=b.owner_id WHERE b.owner_id=$1 AND b.status='active' FOR SHARE OF b,s",[owner])).rows[0];
 if(!b)throw Error('Business unavailable.');
 if(input.action==='rate'){
  const config=obj(b.data),sid=input.serviceId||'*';
  if(!(config.staff||[]).some(s=>s.id===input.staffId)||sid!=='*'&&!(config.services||[]).some(s=>s.id===sid))throw Error('Choose a saved team member and service from this business.');
  if(input.rateBps===null&&sid!=='*')await db.query('DELETE FROM team_service_rates WHERE business_id=$1 AND staff_id=$2 AND service_id=$3',[b.id,input.staffId,sid]);
  else{
   if(!Number.isInteger(input.rateBps)||input.rateBps<0||input.rateBps>10000)throw Error('Enter a percentage from 0 to 100 with at most two decimals.');
   await db.query('INSERT INTO team_service_rates(business_id,staff_id,service_id,rate_bps) VALUES($1,$2,$3,$4) ON CONFLICT(business_id,staff_id,service_id) DO UPDATE SET rate_bps=excluded.rate_bps,updated_at=now()',[b.id,input.staffId,sid,input.rateBps]);
  }
 }else if(input.action==='settle'){
  if(input.confirmed!==true||typeof input.reference!=='string'||!input.reference.trim()||input.reference.length>200||!/^\d+$/.test(String(input.ledgerId)))throw Error('Confirm receipt and enter a payment reference (up to 200 characters).');
  const row=(await db.query('SELECT * FROM team_service_ledger WHERE business_id=$1 AND id=$2 FOR UPDATE',[b.id,input.ledgerId])).rows[0];
  if(!row||row.voided||row.owner_cents<=0)throw Error('Choose an outstanding transaction from this business.');
  await db.query('INSERT INTO team_service_settlements(business_id,ledger_id,amount_cents,reference,recorded_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(ledger_id) DO NOTHING',[b.id,row.id,row.owner_cents,input.reference.trim(),owner]);
 }else throw Error('Choose a service percentage action.');
 await db.query("INSERT INTO events(id,owner,created,kind,data) VALUES($1,$2,$3,'team_service_percentage',$4)",[crypto.randomUUID(),owner,new Date().toISOString(),JSON.stringify({action:input.action,staffId:input.staffId,serviceId:input.serviceId,rateBps:input.rateBps,ledgerId:input.ledgerId,reference:input.reference})]);
 await db.query('COMMIT');return {ok:true};
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
