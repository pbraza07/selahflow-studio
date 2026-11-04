/** A verified full charge refund disables package credits without deleting history. */
export async function applyPackageRefund(db,{businessId,account,charge}){
 if(typeof charge?.payment_intent!=='string'||charge.refunded!==true||!Number.isSafeInteger(charge.amount)||charge.amount<=0||!Number.isSafeInteger(charge.amount_refunded)||charge.amount_refunded<charge.amount)return false;
 const result=await db.query("UPDATE customer_memberships m SET status='canceled',updated_at=now() FROM stripe_payment_receipts r WHERE m.id=r.membership_id AND m.business_id=r.business_id AND m.business_id=$1 AND m.stripe_account_id=$2 AND r.stripe_account_id=$2 AND r.provider_reference=$3 AND m.billing_type='package' RETURNING m.id",[businessId,account,charge.payment_intent]);
 return result.rowCount>0;
}
