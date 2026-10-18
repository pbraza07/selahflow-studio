import {loadMembershipReportPayments} from './report-payments.mjs';
export const reportPaymentKey=p=>p.kind+':'+p.id;
export async function visibleReportPayments(db,owner,events){
 const hidden=new Set((await db.query('SELECT payment_key FROM owner_report_hidden_payments WHERE owner=$1',[owner])).rows.map(r=>r.payment_key));
 return events.filter(e=>!['cash_sale','membership_payment'].includes(e.kind)||!hidden.has(reportPaymentKey(e)));
}
/** Caller owns the transaction. Resets only currently recorded payments, across all dates. */
export async function resetPaidRevenue(db,owner,{businessName,confirmPhrase}){
 const business=(await db.query("SELECT name FROM businesses WHERE owner_id=$1 AND status='active'",[owner])).rows[0];
 if(!business)throw Error('Business unavailable.');
 if(confirmPhrase!=='RESET PAID REVENUE'||businessName!==business.name)throw Error('Enter the business name and RESET PAID REVENUE to confirm.');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner+':report-reset']);
 const sales=(await db.query("SELECT id,kind FROM events WHERE owner=$1 AND kind='cash_sale'",[owner])).rows;
 const memberships=await loadMembershipReportPayments(db,owner,{includeDeleted:true});
 const targets=await visibleReportPayments(db,owner,[...sales,...memberships]);
 for(const row of targets)await db.query('INSERT INTO owner_report_hidden_payments(owner,payment_key) VALUES($1,$2) ON CONFLICT DO NOTHING',[owner,reportPaymentKey(row)]);
 return {cleared:targets.length};
}
